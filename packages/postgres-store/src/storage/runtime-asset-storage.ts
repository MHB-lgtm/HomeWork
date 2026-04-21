/// <reference lib="dom" />

import { createHash } from 'crypto';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { RuntimeStoredAssetRecord, StoredAssetStorageKindValue } from '../types';

type PutObjectArgs = {
  assetKey: string;
  logicalBucket: string;
  objectKey: string;
  bytes: Buffer;
  mimeType?: string | null;
  originalName?: string | null;
  metadata?: unknown;
  dataDir?: string | null;
  localAbsolutePath?: string | null;
};

type ReplaceObjectArgs = {
  current?: RuntimeStoredAssetRecord | null;
  next: PutObjectArgs;
};

type MaterializeToLocalPathArgs = {
  asset: RuntimeStoredAssetRecord;
  dataDir?: string | null;
  preferredPath?: string | null;
};

type ResolveAssetLocationArgs = {
  asset: RuntimeStoredAssetRecord;
  dataDir?: string | null;
  preferredPath?: string | null;
  materialize?: boolean;
};

type ResolveAssetLocationResult =
  | { kind: 'local_file'; path: string }
  | { kind: 'object_storage'; objectKey: string };

type RuntimeAssetStorage = {
  getWriteStorageKind(): StoredAssetStorageKindValue;
  isObjectStorageEnabled(): boolean;
  putObject(args: PutObjectArgs): Promise<RuntimeStoredAssetRecord>;
  getObjectBytes(asset: RuntimeStoredAssetRecord): Promise<Buffer>;
  materializeToLocalPath(args: MaterializeToLocalPathArgs): Promise<string>;
  deleteObject(asset: RuntimeStoredAssetRecord): Promise<void>;
  replaceObject(args: ReplaceObjectArgs): Promise<RuntimeStoredAssetRecord>;
  resolveAssetLocation(args: ResolveAssetLocationArgs): Promise<ResolveAssetLocationResult>;
};

type RuntimeAssetStorageEnv = {
  dataDir?: string | null;
  supabaseUrl?: string | null;
  supabaseServiceRoleKey?: string | null;
  supabaseStorageBucket?: string | null;
};

const writeBufferAtomic = async (absolutePath: string, bytes: Buffer) => {
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  const tempPath = `${absolutePath}.tmp`;
  await fs.writeFile(tempPath, bytes);
  await fs.rename(tempPath, absolutePath);
};

const resolveLocalPath = (
  dataDir: string | null | undefined,
  objectKey: string,
  explicitPath?: string | null
): string => {
  if (explicitPath) {
    return path.resolve(explicitPath);
  }

  if (!dataDir) {
    throw new Error('HG_DATA_DIR is required for local-file asset storage');
  }

  return path.resolve(dataDir, objectKey);
};

const getDefaultMaterializationDir = (dataDir?: string | null): string =>
  dataDir
    ? path.resolve(dataDir, 'runtime-materialized')
    : path.resolve(os.tmpdir(), 'hg-runtime-materialized');

let cachedSupabaseClient:
  | { key: string; client: SupabaseClient }
  | null
  | undefined;

const createSupabaseStorageClient = (
  url: string,
  serviceRoleKey: string
): SupabaseClient =>
  createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

const getSupabaseStorageClient = (
  env: RuntimeAssetStorageEnv
): SupabaseClient => {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for object storage'
    );
  }

  const cacheKey = `${env.supabaseUrl}::${env.supabaseServiceRoleKey}`;
  if (!cachedSupabaseClient || cachedSupabaseClient.key !== cacheKey) {
    cachedSupabaseClient = {
      key: cacheKey,
      client: createSupabaseStorageClient(
        env.supabaseUrl,
        env.supabaseServiceRoleKey
      ),
    };
  }

  return cachedSupabaseClient.client;
};

const normalizeStoredAsset = (
  asset: RuntimeStoredAssetRecord
): RuntimeStoredAssetRecord => ({
  ...asset,
  originalName: asset.originalName ?? null,
  mimeType: asset.mimeType ?? null,
  assetKey: asset.assetKey ?? null,
  sizeBytes: asset.sizeBytes ?? null,
  metadata: asset.metadata ?? null,
});

const inferMimeType = (...names: Array<string | null | undefined>): string | null => {
  const name = names.find((candidate) => candidate && path.extname(candidate));
  const ext = name ? path.extname(name).toLowerCase() : '';
  switch (ext) {
    case '.pdf':
      return 'application/pdf';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.json':
      return 'application/json';
    case '.txt':
      return 'text/plain';
    default:
      return null;
  }
};

const normalizeMimeType = (
  mimeType: string | null | undefined,
  objectKey: string,
  originalName?: string | null
): string => {
  const trimmed = mimeType?.trim();
  if (trimmed && /^[^\s/]+\/[^\s;]+(?:; ?[^\s=]+=[^\s;]+)*$/.test(trimmed)) {
    return trimmed;
  }

  return inferMimeType(originalName, objectKey) ?? 'application/octet-stream';
};

const sanitizeObjectKeySegment = (segment: string): string => {
  const ext = path.posix.extname(segment);
  const baseName = ext ? segment.slice(0, -ext.length) : segment;
  const safeBase =
    baseName
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9._-]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'asset';
  const safeExt = ext.replace(/[^A-Za-z0-9.]/g, '');
  const safeSegment = `${safeBase}${safeExt}`;
  if (safeSegment === segment) {
    return segment;
  }

  const hash = createHash('sha1').update(segment).digest('hex').slice(0, 8);
  return `${safeBase}-${hash}${safeExt}`;
};

const normalizeObjectStorageKey = (objectKey: string): string =>
  objectKey
    .split(/[\\/]+/)
    .filter(Boolean)
    .map(sanitizeObjectKeySegment)
    .join('/');

const normalizeObjectMetadata = (
  metadata: unknown,
  objectKey: string
): unknown => ({
  ...(metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? metadata
    : {}),
  relativeDataPath: objectKey,
});

const createObjectStorageBackend = (
  env: RuntimeAssetStorageEnv
): RuntimeAssetStorage => ({
  getWriteStorageKind: () => 'OBJECT_STORAGE',
  isObjectStorageEnabled: () => true,
  async putObject(args) {
    if (!env.supabaseStorageBucket) {
      throw new Error('SUPABASE_STORAGE_BUCKET is required for object storage');
    }

    const client = getSupabaseStorageClient(env);
    const objectKey = normalizeObjectStorageKey(args.objectKey);
    const contentType = normalizeMimeType(
      args.mimeType,
      objectKey,
      args.originalName
    );
    const metadata = normalizeObjectMetadata(args.metadata, objectKey);
    const { error } = await client.storage
      .from(env.supabaseStorageBucket)
      .upload(objectKey, args.bytes, {
        upsert: true,
        contentType,
      });

    if (error) {
      throw new Error(
        `Failed to upload object "${objectKey}" to Supabase Storage: ${error.message}`
      );
    }

    return normalizeStoredAsset({
      assetKey: args.assetKey,
      storageKind: 'OBJECT_STORAGE',
      logicalBucket: args.logicalBucket,
      path: objectKey,
      mimeType: contentType,
      sizeBytes: args.bytes.byteLength,
      originalName: args.originalName ?? null,
      metadata,
    });
  },
  async getObjectBytes(asset) {
    if (!env.supabaseStorageBucket) {
      throw new Error('SUPABASE_STORAGE_BUCKET is required for object storage');
    }

    const client = getSupabaseStorageClient(env);
    const { data, error } = await client.storage
      .from(env.supabaseStorageBucket)
      .download(asset.path);

    if (error || !data) {
      throw new Error(
        `Failed to download object "${asset.path}" from Supabase Storage: ${
          error?.message ?? 'Object not found'
        }`
      );
    }

    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  },
  async materializeToLocalPath({ asset, dataDir, preferredPath }) {
    const targetPath =
      preferredPath ??
      path.resolve(
        getDefaultMaterializationDir(dataDir ?? env.dataDir),
        asset.path.split('/').join(path.sep)
      );

    const bytes = await this.getObjectBytes(asset);
    await writeBufferAtomic(targetPath, bytes);
    return targetPath;
  },
  async deleteObject(asset) {
    if (!env.supabaseStorageBucket) {
      throw new Error('SUPABASE_STORAGE_BUCKET is required for object storage');
    }

    const client = getSupabaseStorageClient(env);
    const { error } = await client.storage
      .from(env.supabaseStorageBucket)
      .remove([asset.path]);

    if (error) {
      throw new Error(
        `Failed to delete object "${asset.path}" from Supabase Storage: ${error.message}`
      );
    }
  },
  async replaceObject({ current, next }) {
    const uploaded = await this.putObject(next);
    if (
      current &&
      (current.storageKind !== uploaded.storageKind || current.path !== uploaded.path)
    ) {
      await this.deleteObject(current);
    }
    return uploaded;
  },
  async resolveAssetLocation({ asset, dataDir, preferredPath, materialize = false }) {
    if (materialize) {
      return {
        kind: 'local_file',
        path: await this.materializeToLocalPath({
          asset,
          dataDir,
          preferredPath,
        }),
      };
    }

    return {
      kind: 'object_storage',
      objectKey: asset.path,
    };
  },
});

const createLocalFileBackend = (
  env: RuntimeAssetStorageEnv
): RuntimeAssetStorage => ({
  getWriteStorageKind: () => 'LOCAL_FILE',
  isObjectStorageEnabled: () => false,
  async putObject(args) {
    const absolutePath = resolveLocalPath(
      args.dataDir ?? env.dataDir,
      args.objectKey,
      args.localAbsolutePath
    );
    const mimeType = normalizeMimeType(
      args.mimeType,
      args.objectKey,
      args.originalName
    );
    await writeBufferAtomic(absolutePath, args.bytes);
    return normalizeStoredAsset({
      assetKey: args.assetKey,
      storageKind: 'LOCAL_FILE',
      logicalBucket: args.logicalBucket,
      path: absolutePath,
      mimeType,
      sizeBytes: args.bytes.byteLength,
      originalName: args.originalName ?? null,
      metadata: args.metadata ?? null,
    });
  },
  async getObjectBytes(asset) {
    return fs.readFile(asset.path);
  },
  async materializeToLocalPath({ asset }) {
    return asset.path;
  },
  async deleteObject(asset) {
    await fs.rm(asset.path, { force: true });
  },
  async replaceObject({ current, next }) {
    const uploaded = await this.putObject(next);
    if (
      current &&
      current.storageKind === 'LOCAL_FILE' &&
      current.path !== uploaded.path
    ) {
      await this.deleteObject(current);
    }
    return uploaded;
  },
  async resolveAssetLocation({ asset }) {
    return {
      kind: 'local_file',
      path: asset.path,
    };
  },
});

export const getRuntimeAssetStorageEnv = (
  overrides?: Partial<RuntimeAssetStorageEnv>
): RuntimeAssetStorageEnv => ({
  dataDir: overrides?.dataDir ?? process.env.HG_DATA_DIR ?? null,
  supabaseUrl: overrides?.supabaseUrl ?? process.env.SUPABASE_URL ?? null,
  supabaseServiceRoleKey:
    overrides?.supabaseServiceRoleKey ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    null,
  supabaseStorageBucket:
    overrides?.supabaseStorageBucket ??
    process.env.SUPABASE_STORAGE_BUCKET ??
    null,
});

export const isSupabaseObjectStorageEnabled = (
  overrides?: Partial<RuntimeAssetStorageEnv>
): boolean => {
  const env = getRuntimeAssetStorageEnv(overrides);
  return Boolean(
    env.supabaseUrl &&
      env.supabaseServiceRoleKey &&
      env.supabaseStorageBucket
  );
};

let cachedStorage:
  | { key: string; storage: RuntimeAssetStorage }
  | null
  | undefined;

export const createRuntimeAssetStorage = (
  overrides?: Partial<RuntimeAssetStorageEnv>
): RuntimeAssetStorage => {
  const env = getRuntimeAssetStorageEnv(overrides);
  if (isSupabaseObjectStorageEnabled(env)) {
    return createObjectStorageBackend(env);
  }

  return createLocalFileBackend(env);
};

export const getRuntimeAssetStorage = (
  overrides?: Partial<RuntimeAssetStorageEnv>
): RuntimeAssetStorage => {
  const env = getRuntimeAssetStorageEnv(overrides);
  const cacheKey = JSON.stringify(env);

  if (!cachedStorage || cachedStorage.key !== cacheKey) {
    cachedStorage = {
      key: cacheKey,
      storage: createRuntimeAssetStorage(env),
    };
  }

  return cachedStorage.storage;
};

export const readStoredAssetBytes = async (
  asset: RuntimeStoredAssetRecord,
  overrides?: Partial<RuntimeAssetStorageEnv>
): Promise<Buffer> =>
  getRuntimeAssetStorage(overrides).getObjectBytes(normalizeStoredAsset(asset));

export const materializeStoredAssetToLocalPath = async (
  asset: RuntimeStoredAssetRecord,
  options?: Partial<MaterializeToLocalPathArgs>
): Promise<string> =>
  getRuntimeAssetStorage({ dataDir: options?.dataDir ?? null }).materializeToLocalPath({
    asset: normalizeStoredAsset(asset),
    dataDir: options?.dataDir ?? null,
    preferredPath: options?.preferredPath ?? null,
  });
