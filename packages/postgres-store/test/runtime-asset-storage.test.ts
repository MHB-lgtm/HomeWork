import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type MockStorageBucket = {
  upload: ReturnType<typeof vi.fn>;
  download: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
};

const mockBucket: MockStorageBucket = {
  upload: vi.fn(),
  download: vi.fn(),
  remove: vi.fn(),
};

const mockCreateClient = vi.fn(() => ({
  storage: {
    from: vi.fn(() => mockBucket),
  },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
}));

describe('runtime asset storage', () => {
  let dataDir: string;

  beforeEach(async () => {
    dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hg-storage-test-'));
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_STORAGE_BUCKET;
    process.env.HG_DATA_DIR = dataDir;
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(async () => {
    await fs.rm(dataDir, { recursive: true, force: true });
    delete process.env.HG_DATA_DIR;
  });

  it('uses local-file storage when Supabase env vars are missing', async () => {
    const {
      createRuntimeAssetStorage,
    } = await import('../src/storage/runtime-asset-storage');

    const storage = createRuntimeAssetStorage({ dataDir });
    const stored = await storage.putObject({
      assetKey: 'exam-asset:test',
      logicalBucket: 'exams',
      objectKey: 'exams/exam-1/assets/test.pdf',
      bytes: Buffer.from('pdf-bytes'),
      mimeType: 'application/pdf',
      originalName: 'test.pdf',
      dataDir,
    });

    expect(stored.storageKind).toBe('LOCAL_FILE');
    expect(stored.path).toContain(path.join('exams', 'exam-1', 'assets', 'test.pdf'));
    await expect(fs.readFile(stored.path, 'utf-8')).resolves.toBe('pdf-bytes');
  });

  it('uses Supabase object storage and can materialize downloaded assets locally', async () => {
    process.env.SUPABASE_URL = 'https://supabase.example.test';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.SUPABASE_STORAGE_BUCKET = 'runtime-assets';

    mockBucket.upload.mockResolvedValue({ error: null });
    mockBucket.download.mockResolvedValue({
      data: new Blob([Buffer.from('cloud-bytes')], { type: 'application/pdf' }),
      error: null,
    });
    mockBucket.remove.mockResolvedValue({ error: null });

    const {
      createRuntimeAssetStorage,
    } = await import('../src/storage/runtime-asset-storage');

    const storage = createRuntimeAssetStorage({ dataDir });
    const stored = await storage.putObject({
      assetKey: 'exam-asset:test',
      logicalBucket: 'exams',
      objectKey: 'exams/exam-1/assets/test.pdf',
      bytes: Buffer.from('cloud-bytes'),
      mimeType: 'application/pdf',
      originalName: 'test.pdf',
      dataDir,
    });

    expect(stored.storageKind).toBe('OBJECT_STORAGE');
    expect(stored.path).toBe('exams/exam-1/assets/test.pdf');
    expect(mockCreateClient).toHaveBeenCalled();
    expect(mockBucket.upload).toHaveBeenCalledWith(
      'exams/exam-1/assets/test.pdf',
      expect.any(Buffer),
      expect.objectContaining({
        upsert: true,
        contentType: 'application/pdf',
      })
    );

    const materializedPath = await storage.materializeToLocalPath({
      asset: stored,
      dataDir,
      preferredPath: path.join(dataDir, 'runtime-materialized', 'exam.pdf'),
    });

    await expect(fs.readFile(materializedPath, 'utf-8')).resolves.toBe('cloud-bytes');
  });
});
