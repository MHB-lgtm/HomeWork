import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { spawn } from 'child_process';
import { PrismaClient } from '@prisma/client';
import { createRuntimeAssetStorage } from '../src/storage/runtime-asset-storage';

type CliOptions = {
  dataDir: string;
  fromDatabaseUrl?: string;
  toDatabaseUrl?: string;
  dumpFile?: string;
  skipDbTransfer: boolean;
  skipAssetUpload: boolean;
  keepDumpFile: boolean;
  dryRun: boolean;
};

type AssetMigrationSummary = {
  scannedAssets: number;
  uploadedAssets: number;
  skippedAssets: number;
  failedAssets: number;
  uploadedAssetIds: string[];
  skippedAssetIds: string[];
  failedAssetIds: string[];
};

const getCliArgs = (): string[] => process.argv.slice(2);

const parseArgValue = (flag: string): string | undefined => {
  const args = getCliArgs();
  const index = args.findIndex((arg) => arg === flag);
  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
};

const hasFlag = (flag: string): boolean => getCliArgs().includes(flag);

const resolveDataDir = (): string => {
  const value = parseArgValue('--data-dir') ?? process.env.HG_DATA_DIR;
  if (!value) {
    throw new Error('HG_DATA_DIR is required for Supabase cutover (or pass --data-dir)');
  }

  return path.resolve(value);
};

const parseCliOptions = (): CliOptions => ({
  dataDir: resolveDataDir(),
  fromDatabaseUrl: parseArgValue('--from-database-url') ?? process.env.NEON_DATABASE_URL,
  toDatabaseUrl:
    parseArgValue('--to-database-url') ??
    process.env.DATABASE_URL_UNPOOLED ??
    process.env.DATABASE_URL,
  dumpFile: parseArgValue('--dump-file'),
  skipDbTransfer: hasFlag('--skip-db-transfer'),
  skipAssetUpload: hasFlag('--skip-asset-upload'),
  keepDumpFile: hasFlag('--keep-dump-file'),
  dryRun: hasFlag('--dry-run'),
});

const assertSupabaseEnv = () => {
  if (!process.env.SUPABASE_URL) {
    throw new Error('SUPABASE_URL is required for Supabase Storage cutover');
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is required for Supabase Storage cutover'
    );
  }
  if (!process.env.SUPABASE_STORAGE_BUCKET) {
    throw new Error('SUPABASE_STORAGE_BUCKET is required for Supabase Storage cutover');
  }
};

const runCommand = async (
  command: string,
  args: string[],
  env?: NodeJS.ProcessEnv
): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...env,
      },
      stdio: 'inherit',
      shell: false,
      windowsHide: true,
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${path.basename(command)} failed with exit code ${code}`));
    });
  });
};

const resolvePostgresCommand = (command: 'pg_dump' | 'psql'): string => {
  if (command === 'pg_dump' && process.env.PG_DUMP_BIN) {
    return process.env.PG_DUMP_BIN;
  }
  if (command === 'psql' && process.env.PSQL_BIN) {
    return process.env.PSQL_BIN;
  }
  return command;
};

const runDatabaseTransfer = async (options: CliOptions): Promise<string> => {
  if (!options.fromDatabaseUrl || !options.toDatabaseUrl) {
    throw new Error(
      'Both source and target database URLs are required unless --skip-db-transfer is used'
    );
  }

  const dumpFile =
    options.dumpFile ??
    path.resolve(
      os.tmpdir(),
      `hg-supabase-cutover-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}.sql`
    );

  await runCommand(resolvePostgresCommand('pg_dump'), [
    '--dbname',
    options.fromDatabaseUrl,
    '--no-owner',
    '--no-privileges',
    '--file',
    dumpFile,
  ]);

  if (!options.dryRun) {
    await runCommand(resolvePostgresCommand('psql'), [
      '--dbname',
      options.toDatabaseUrl,
      '--file',
      dumpFile,
    ]);
  }

  return dumpFile;
};

const normalizeObjectKey = (value: string): string =>
  value.split(/[\\/]+/).filter(Boolean).join('/');

const deriveObjectKeyFromPath = (
  logicalBucket: string,
  storedPath: string,
  metadata: unknown,
  assetKey: string,
  originalName: string | null
): string => {
  const metadataRecord =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : null;
  const relativeDataPath = metadataRecord?.relativeDataPath;
  if (typeof relativeDataPath === 'string' && relativeDataPath.trim()) {
    return normalizeObjectKey(relativeDataPath);
  }

  if (!path.isAbsolute(storedPath)) {
    return normalizeObjectKey(storedPath);
  }

  const normalizedPath = normalizeObjectKey(storedPath);
  const marker = `${logicalBucket}/`;
  const markerIndex = normalizedPath.lastIndexOf(marker);
  if (markerIndex !== -1) {
    return normalizedPath.slice(markerIndex);
  }

  const ext =
    path.extname(originalName ?? '') ||
    path.extname(storedPath) ||
    '.bin';
  return normalizeObjectKey(
    [logicalBucket, `${assetKey.replace(/[:]/g, '_')}${ext}`].join('/')
  );
};

const resolveSourcePath = (
  dataDir: string,
  storedPath: string,
  metadata: unknown
): string => {
  if (path.isAbsolute(storedPath)) {
    return storedPath;
  }

  const metadataRecord =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : null;
  const relativeDataPath = metadataRecord?.relativeDataPath;
  if (typeof relativeDataPath === 'string' && relativeDataPath.trim()) {
    return path.resolve(dataDir, relativeDataPath);
  }

  return path.resolve(dataDir, storedPath);
};

const migrateStoredAssetsToSupabase = async (
  prisma: PrismaClient,
  options: CliOptions
): Promise<AssetMigrationSummary> => {
  assertSupabaseEnv();
  const storage = createRuntimeAssetStorage({
    dataDir: options.dataDir,
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    supabaseStorageBucket: process.env.SUPABASE_STORAGE_BUCKET,
  });

  const rows = await prisma.storedAsset.findMany({
    where: {
      storageKind: {
        in: ['LOCAL_FILE', 'UNKNOWN'],
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
    select: {
      id: true,
      assetKey: true,
      storageKind: true,
      logicalBucket: true,
      path: true,
      mimeType: true,
      sizeBytes: true,
      originalName: true,
      metadata: true,
    },
  });

  const summary: AssetMigrationSummary = {
    scannedAssets: rows.length,
    uploadedAssets: 0,
    skippedAssets: 0,
    failedAssets: 0,
    uploadedAssetIds: [],
    skippedAssetIds: [],
    failedAssetIds: [],
  };

  for (const row of rows) {
    const objectKey = deriveObjectKeyFromPath(
      row.logicalBucket,
      row.path,
      row.metadata,
      row.assetKey,
      row.originalName ?? null
    );

    if (row.storageKind === 'OBJECT_STORAGE' && row.path === objectKey) {
      summary.skippedAssets += 1;
      summary.skippedAssetIds.push(row.id);
      continue;
    }

    const sourcePath = resolveSourcePath(options.dataDir, row.path, row.metadata);
    try {
      await fs.access(sourcePath);
    } catch {
      summary.failedAssets += 1;
      summary.failedAssetIds.push(row.id);
      console.warn(
        `[supabase-cutover] skipping missing asset id=${row.id} sourcePath=${sourcePath}`
      );
      continue;
    }

    if (options.dryRun) {
      summary.uploadedAssets += 1;
      summary.uploadedAssetIds.push(row.id);
      continue;
    }

    const bytes = await fs.readFile(sourcePath);
    const uploaded = await storage.putObject({
      assetKey: row.assetKey,
      logicalBucket: row.logicalBucket,
      objectKey,
      bytes,
      mimeType: row.mimeType ?? null,
      originalName: row.originalName ?? path.basename(sourcePath),
      metadata: {
        ...(row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
          ? row.metadata
          : {}),
        relativeDataPath: objectKey,
        migratedFromPath: row.path,
        migratedAt: new Date().toISOString(),
      },
      dataDir: options.dataDir,
    });

    await prisma.storedAsset.update({
      where: { id: row.id },
      data: {
        storageKind: uploaded.storageKind,
        logicalBucket: uploaded.logicalBucket,
        path: uploaded.path,
        mimeType: uploaded.mimeType ?? undefined,
        sizeBytes: uploaded.sizeBytes ?? undefined,
        originalName: uploaded.originalName ?? undefined,
        metadata: uploaded.metadata as never,
      },
    });

    summary.uploadedAssets += 1;
    summary.uploadedAssetIds.push(row.id);
  }

  return summary;
};

const main = async () => {
  const options = parseCliOptions();

  let dumpFile: string | null = null;
  if (!options.skipDbTransfer) {
    dumpFile = await runDatabaseTransfer(options);
  }

  let prisma: PrismaClient | null = null;
  try {
    if (!options.skipAssetUpload) {
      const assetDatabaseUrl =
        options.dryRun && !options.skipDbTransfer
          ? options.fromDatabaseUrl
          : options.toDatabaseUrl;

      if (!assetDatabaseUrl) {
        throw new Error(
          'A database URL is required for asset migration unless --skip-asset-upload is used'
        );
      }

      prisma = new PrismaClient({
        datasources: {
          db: {
            url: assetDatabaseUrl,
          },
        },
      });

      const summary = await migrateStoredAssetsToSupabase(prisma, options);
      console.log(JSON.stringify(summary, null, 2));
    }
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }

    if (dumpFile && !options.keepDumpFile && !options.dumpFile) {
      await fs.rm(dumpFile, { force: true });
    }
  }
};

main().catch((error) => {
  console.error(
    '[postgres-store] supabase cutover failed:',
    error instanceof Error ? error.message : error
  );
  process.exitCode = 1;
});
