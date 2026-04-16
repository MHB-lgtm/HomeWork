import * as path from 'path';
import type { PrismaClient } from '@prisma/client';
import { StoredAssetStorageKind } from '@prisma/client';
import { getRuntimeAssetStorage } from '../storage/runtime-asset-storage';
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

const createAssetPath = (examId: string, originalName: string) => {
  const ext = path.extname(originalName);
  const baseName = path.basename(originalName, ext) || 'exam';
  const uniqueName = `${baseName}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}${ext}`;
  const relativePath = ['exams', examId, 'assets', uniqueName].join('/');
  return {
    relativePath,
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
      where: {
        assignmentBacking: {
          is: null,
        },
      },
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
    const row = await this.prisma.exam.findFirst({
      where: {
        domainId: examId,
        assignmentBacking: {
          is: null,
        },
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

    if (!row) {
      return null;
    }

    return mapExamRow(row);
  }

  async createExam(args: {
    dataDir?: string;
    title: string;
    originalName: string;
    buffer: Buffer;
    mimeType?: string;
  }): Promise<{ exam: LegacyExamRecord; assetPath: string }> {
    const examId = createExamId();
    const asset = createAssetPath(examId, args.originalName);
    const storage = getRuntimeAssetStorage({
      dataDir: args.dataDir ? path.resolve(args.dataDir) : undefined,
    });
    const uploadedAsset = await storage.putObject({
      assetKey: `exam-asset:${examId}`,
      logicalBucket: 'exams',
      objectKey: asset.relativePath,
      bytes: args.buffer,
      mimeType: args.mimeType ?? null,
      originalName: path.basename(args.originalName),
      metadata: {
        relativeDataPath: asset.relativePath,
      },
      dataDir: args.dataDir ? path.resolve(args.dataDir) : undefined,
    });

    try {
      const created = await this.prisma.$transaction(async (tx: any) => {
        const storedAsset = await tx.storedAsset.create({
          data: {
            assetKey: `exam-asset:${examId}`,
            storageKind: uploadedAsset.storageKind as StoredAssetStorageKind,
            logicalBucket: uploadedAsset.logicalBucket,
            path: uploadedAsset.path,
            mimeType: uploadedAsset.mimeType || undefined,
            sizeBytes: uploadedAsset.sizeBytes ?? undefined,
            originalName: path.basename(args.originalName),
            metadata: uploadedAsset.metadata as never,
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
        assetPath: uploadedAsset.path,
      };
    } catch (error) {
      await storage.deleteObject(uploadedAsset);
      throw error;
    }
  }
}
