import * as fs from 'fs/promises';
import * as path from 'path';
import type { PrismaClient } from '@prisma/client';
import { StoredAssetStorageKind } from '@prisma/client';
import { toIsoString } from '../mappers/domain';
import type { LegacyExamRecord } from '../types';

const toBucketRelativePath = (logicalBucket: string, filePath: string): string => {
  const segments = filePath.split(/[\\/]+/).filter(Boolean);
  const bucketIndex = segments.lastIndexOf(logicalBucket);
  if (bucketIndex === -1) {
    throw new Error(
      `Stored asset path does not include logical bucket "${logicalBucket}": ${filePath}`
    );
  }

  return segments.slice(bucketIndex).join('/');
};

const createExamId = (): string =>
  `exam-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

const createAssetPath = (dataDir: string, examId: string, originalName: string) => {
  const ext = path.extname(originalName);
  const baseName = path.basename(originalName, ext) || 'exam';
  const uniqueName = `${baseName}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}${ext}`;
  const relativePath = path.join('exams', examId, 'assets', uniqueName);
  return {
    relativePath,
    absolutePath: path.resolve(dataDir, relativePath),
    fileName: uniqueName,
  };
};

const mapExamRow = (
  row: {
    domainId: string;
    title: string;
    createdAt: Date;
    updatedAt: Date;
    asset: { path: string; logicalBucket: string };
  }
): LegacyExamRecord => ({
  examId: row.domainId,
  title: row.title,
  createdAt: toIsoString(row.createdAt),
  updatedAt: toIsoString(row.updatedAt),
  examFilePath: toBucketRelativePath(row.asset.logicalBucket, row.asset.path),
});

export class PrismaExamStore {
  constructor(
    private readonly prisma: Pick<PrismaClient, 'exam' | 'storedAsset' | '$transaction'>
  ) {}

  async listExams(): Promise<LegacyExamRecord[]> {
    const rows = await this.prisma.exam.findMany({
      include: {
        asset: {
          select: {
            path: true,
            logicalBucket: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return rows.map(mapExamRow);
  }

  async getExam(examId: string): Promise<LegacyExamRecord | null> {
    const row = await this.prisma.exam.findUnique({
      where: { domainId: examId },
      include: {
        asset: {
          select: {
            path: true,
            logicalBucket: true,
          },
        },
      },
    });

    if (!row) {
      return null;
    }

    return mapExamRow(row);
  }

  async createExam(args: {
    dataDir: string;
    title: string;
    originalName: string;
    buffer: Buffer;
    mimeType?: string;
  }): Promise<{ exam: LegacyExamRecord; assetPath: string }> {
    const examId = createExamId();
    const asset = createAssetPath(args.dataDir, examId, args.originalName);

    await fs.mkdir(path.dirname(asset.absolutePath), { recursive: true });
    const tempAssetPath = `${asset.absolutePath}.tmp`;
    await fs.writeFile(tempAssetPath, args.buffer);
    await fs.rename(tempAssetPath, asset.absolutePath);

    try {
      const created = await this.prisma.$transaction(async (tx: any) => {
        const storedAsset = await tx.storedAsset.create({
          data: {
            assetKey: `exam-asset:${examId}`,
            storageKind: StoredAssetStorageKind.LOCAL_FILE,
            logicalBucket: 'exams',
            path: asset.absolutePath,
            mimeType: args.mimeType || undefined,
            sizeBytes: args.buffer.byteLength,
            originalName: path.basename(args.originalName),
          },
          select: {
            id: true,
          },
        });

        const createdExam = await tx.exam.create({
          data: {
            domainId: examId,
            title: args.title,
            assetId: storedAsset.id,
          },
          include: {
            asset: {
              select: {
                path: true,
                logicalBucket: true,
              },
            },
          },
        });

        return createdExam;
      });

      return {
        exam: mapExamRow(created),
        assetPath: asset.absolutePath,
      };
    } catch (error) {
      await fs.rm(asset.absolutePath, { force: true });
      throw error;
    }
  }
}
