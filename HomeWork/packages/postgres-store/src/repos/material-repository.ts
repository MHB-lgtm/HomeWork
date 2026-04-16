import type { CourseMaterial, MaterialRepository } from '@hg/domain-workflow';
import type { PrismaClient } from '@prisma/client';
import {
  fromPrismaCourseMaterialKind,
  fromPrismaStoredAssetStorageKind,
  toIsoString,
} from '../mappers/domain';

export class PrismaMaterialRepository implements MaterialRepository {
  constructor(private readonly prisma: Pick<PrismaClient, 'courseMaterial'>) {}

  async getMaterial(materialId: string): Promise<CourseMaterial | null> {
    const row = await this.prisma.courseMaterial.findUnique({
      where: { domainId: materialId },
      include: {
        course: { select: { domainId: true } },
        asset: true,
      },
    });

    if (!row) {
      return null;
    }

    return {
      materialId: row.domainId,
      courseId: row.course.domainId,
      kind: fromPrismaCourseMaterialKind(row.kind),
      assetRef: {
        assetId: row.asset.assetKey,
        storageKind: fromPrismaStoredAssetStorageKind(row.asset.storageKind),
        logicalBucket: row.asset.logicalBucket,
        path: row.asset.path,
        mimeType: row.asset.mimeType ?? undefined,
        sizeBytes: row.asset.sizeBytes ?? undefined,
        originalName: row.asset.originalName ?? undefined,
      },
      title: row.title ?? undefined,
      createdAt: toIsoString(row.createdAt),
      updatedAt: toIsoString(row.updatedAt),
    };
  }

  async listMaterialsByCourse(courseId: string): Promise<CourseMaterial[]> {
    const rows = await this.prisma.courseMaterial.findMany({
      where: { course: { domainId: courseId } },
      include: {
        course: { select: { domainId: true } },
        asset: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return rows.map((row) => ({
      materialId: row.domainId,
      courseId: row.course.domainId,
      kind: fromPrismaCourseMaterialKind(row.kind),
      assetRef: {
        assetId: row.asset.assetKey,
        storageKind: fromPrismaStoredAssetStorageKind(row.asset.storageKind),
        logicalBucket: row.asset.logicalBucket,
        path: row.asset.path,
        mimeType: row.asset.mimeType ?? undefined,
        sizeBytes: row.asset.sizeBytes ?? undefined,
        originalName: row.asset.originalName ?? undefined,
      },
      title: row.title ?? undefined,
      createdAt: toIsoString(row.createdAt),
      updatedAt: toIsoString(row.updatedAt),
    }));
  }
}
