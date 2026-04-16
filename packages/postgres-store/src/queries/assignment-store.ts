import * as path from 'path';
import type { Assignment } from '@hg/shared-schemas';
import { AssignmentSchema } from '@hg/shared-schemas';
import {
  AssignmentMaterialRole,
  AssignmentState as PrismaAssignmentState,
  CourseMaterialKind,
  StoredAssetStorageKind,
  type PrismaClient,
} from '@prisma/client';
import type { RuntimeStoredAssetRecord } from '../types';
import { getRuntimeAssetStorage } from '../storage/runtime-asset-storage';
import { toIsoString } from '../mappers/domain';

type AssignmentStorePrisma = Pick<
  PrismaClient,
  | '$transaction'
  | 'assignment'
  | 'assignmentMaterial'
  | 'course'
  | 'courseMaterial'
  | 'courseMembership'
  | 'exam'
  | 'storedAsset'
  | 'week'
>;

type BinaryUpload = {
  originalName: string;
  buffer: Buffer;
  mimeType?: string;
};

type AssignmentMaterialAssetRecord = {
  path: string;
  storageKind: 'LOCAL_FILE' | 'OBJECT_STORAGE' | 'UNKNOWN';
  logicalBucket: string;
  mimeType: string | null;
  originalName: string | null;
  assetKey: string | null;
  sizeBytes: number | null;
  metadata: unknown | null;
};

const createAssignmentId = (): string =>
  `assignment-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

const createExamId = (): string =>
  `exam-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

const getDefaultWeekDomainId = (courseId: string): string => `week:${courseId}:default`;

const getAssignmentMaterialDomainId = (
  assignmentId: string,
  role: AssignmentMaterialRole
): string =>
  role === AssignmentMaterialRole.PROMPT
    ? `assignment-material:${assignmentId}:prompt`
    : `assignment-material:${assignmentId}:solution`;

const toStoredAssignmentState = (
  state: Assignment['state']
): PrismaAssignmentState => {
  switch (state) {
    case 'draft':
      return PrismaAssignmentState.DRAFT;
    case 'open':
      return PrismaAssignmentState.OPEN;
    case 'closed':
      return PrismaAssignmentState.CLOSED;
    case 'processing':
      return PrismaAssignmentState.PROCESSING;
    case 'reviewed':
      return PrismaAssignmentState.REVIEWED;
    case 'published':
      return PrismaAssignmentState.PUBLISHED;
  }

  throw new Error(`Unsupported assignment state: ${state}`);
};

const fromStoredAssignmentState = (
  state: PrismaAssignmentState
): Assignment['state'] => {
  switch (state) {
    case PrismaAssignmentState.DRAFT:
      return 'draft';
    case PrismaAssignmentState.OPEN:
      return 'open';
    case PrismaAssignmentState.CLOSED:
      return 'closed';
    case PrismaAssignmentState.PROCESSING:
      return 'processing';
    case PrismaAssignmentState.REVIEWED:
      return 'reviewed';
    case PrismaAssignmentState.PUBLISHED:
      return 'published';
  }

  throw new Error(`Unsupported stored assignment state: ${state}`);
};

const resolveMaterialIds = (
  materials: Array<{
    role: AssignmentMaterialRole;
    material: { domainId: string };
  }>
) => {
  let promptMaterialId: string | null = null;
  let solutionMaterialId: string | undefined;

  for (const material of materials) {
    if (material.role === AssignmentMaterialRole.PROMPT) {
      promptMaterialId = material.material.domainId;
    } else if (material.role === AssignmentMaterialRole.REFERENCE_SOLUTION) {
      solutionMaterialId = material.material.domainId;
    }
  }

  if (!promptMaterialId) {
    throw new Error('Assignment prompt material is missing');
  }

  return {
    promptMaterialId,
    solutionMaterialId,
  };
};

const mapAssignmentRow = (row: {
  domainId: string;
  title: string;
  openAt: Date;
  deadlineAt: Date;
  state: PrismaAssignmentState;
  createdAt: Date;
  updatedAt: Date;
  course: { domainId: string };
  week: { domainId: string };
  exam: { domainId: string } | null;
  materials: Array<{
    role: AssignmentMaterialRole;
    material: { domainId: string };
  }>;
}): Assignment => {
  if (!row.exam?.domainId) {
    throw new Error(`Assignment backing exam is missing: ${row.domainId}`);
  }

  const materialIds = resolveMaterialIds(row.materials);

  return AssignmentSchema.parse({
    version: '1.0.0',
    assignmentId: row.domainId,
    courseId: row.course.domainId,
    weekId: row.week.domainId,
    examId: row.exam.domainId,
    title: row.title,
    openAt: toIsoString(row.openAt),
    deadlineAt: toIsoString(row.deadlineAt),
    state: fromStoredAssignmentState(row.state),
    promptMaterialId: materialIds.promptMaterialId,
    solutionMaterialId: materialIds.solutionMaterialId,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  });
};

const validateSchedule = (openAt: string, deadlineAt: string) => {
  const parsedOpenAt = new Date(openAt);
  const parsedDeadlineAt = new Date(deadlineAt);

  if (Number.isNaN(parsedOpenAt.getTime())) {
    throw new Error('openAt must be a valid ISO timestamp');
  }

  if (Number.isNaN(parsedDeadlineAt.getTime())) {
    throw new Error('deadlineAt must be a valid ISO timestamp');
  }

  if (parsedDeadlineAt.getTime() <= parsedOpenAt.getTime()) {
    throw new Error('deadlineAt must be after openAt');
  }

  return {
    openAt: parsedOpenAt,
    deadlineAt: parsedDeadlineAt,
  };
};

const createAssignmentSourceObjectKey = (
  examId: string,
  originalName: string
) => {
  const ext = path.extname(originalName);
  const baseName = path.basename(originalName, ext) || 'assignment';
  const fileName = `${baseName}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}${ext}`;

  return {
    objectKey: ['exams', examId, 'assets', fileName].join('/'),
    originalName: path.basename(originalName) || fileName,
  };
};

export class AssignmentCourseNotFoundError extends Error {
  constructor(courseId: string) {
    super(`Course not found: ${courseId}`);
    this.name = 'AssignmentCourseNotFoundError';
  }
}

export class AssignmentNotFoundError extends Error {
  constructor(assignmentId: string) {
    super(`Assignment not found: ${assignmentId}`);
    this.name = 'AssignmentNotFoundError';
  }
}

export class PrismaAssignmentStore {
  constructor(private readonly prisma: AssignmentStorePrisma) {}

  private async getAssignmentMaterialAsset(
    assignmentId: string,
    role: AssignmentMaterialRole
  ): Promise<AssignmentMaterialAssetRecord | null> {
    const row = await this.prisma.assignment.findUnique({
      where: { domainId: assignmentId },
      select: {
        materials: {
          where: { role },
          take: 1,
          select: {
            material: {
              select: {
                asset: {
                  select: {
                    path: true,
                    storageKind: true,
                    logicalBucket: true,
                    mimeType: true,
                    originalName: true,
                    assetKey: true,
                    sizeBytes: true,
                    metadata: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const asset = row?.materials[0]?.material.asset;
    if (!asset) {
      return null;
    }

    return {
      path: asset.path,
      storageKind: asset.storageKind,
      logicalBucket: asset.logicalBucket,
      mimeType: asset.mimeType ?? null,
      originalName: asset.originalName ?? null,
      assetKey: asset.assetKey ?? null,
      sizeBytes: asset.sizeBytes ?? null,
      metadata: asset.metadata ?? null,
    };
  }

  private async ensureDefaultWeek(tx: any, course: { id: string; domainId: string; createdAt?: Date; updatedAt?: Date }) {
    const domainId = getDefaultWeekDomainId(course.domainId);
    const existing = await tx.week.findUnique({
      where: { domainId },
      select: { id: true, domainId: true },
    });

    if (existing) {
      return existing;
    }

    return tx.week.create({
      data: {
        domainId,
        courseId: course.id,
        order: 1,
        title: 'Default Week',
        createdAt: course.createdAt ?? new Date(),
        updatedAt: course.updatedAt ?? new Date(),
      },
      select: { id: true, domainId: true },
    });
  }

  async listAssignmentsByCourse(courseId: string): Promise<Assignment[]> {
    const course = await this.prisma.course.findUnique({
      where: { domainId: courseId },
      select: { id: true },
    });

    if (!course) {
      throw new AssignmentCourseNotFoundError(courseId);
    }

    const rows = await this.prisma.assignment.findMany({
      where: {
        courseId: course.id,
      },
      orderBy: [{ openAt: 'asc' }, { createdAt: 'asc' }],
      select: {
        domainId: true,
        title: true,
        openAt: true,
        deadlineAt: true,
        state: true,
        createdAt: true,
        updatedAt: true,
        course: { select: { domainId: true } },
        week: { select: { domainId: true } },
        exam: { select: { domainId: true } },
        materials: {
          select: {
            role: true,
            material: {
              select: {
                domainId: true,
              },
            },
          },
        },
      },
    });

    return rows.map(mapAssignmentRow);
  }

  async getAssignment(assignmentId: string): Promise<Assignment | null> {
    const row = await this.prisma.assignment.findUnique({
      where: { domainId: assignmentId },
      select: {
        domainId: true,
        title: true,
        openAt: true,
        deadlineAt: true,
        state: true,
        createdAt: true,
        updatedAt: true,
        course: { select: { domainId: true } },
        week: { select: { domainId: true } },
        exam: { select: { domainId: true } },
        materials: {
          select: {
            role: true,
            material: {
              select: {
                domainId: true,
              },
            },
          },
        },
      },
    });

    return row ? mapAssignmentRow(row) : null;
  }

  async createAssignment(args: {
    dataDir?: string;
    courseId: string;
    title: string;
    openAt: string;
    deadlineAt: string;
    state?: Assignment['state'];
    source: BinaryUpload;
  }): Promise<Assignment> {
    const title = args.title.trim();
    if (!title) {
      throw new Error('title is required');
    }

    const schedule = validateSchedule(args.openAt, args.deadlineAt);
    const state = args.state ?? 'draft';
    const assignmentId = createAssignmentId();
    const course = await this.prisma.course.findUnique({
      where: { domainId: args.courseId },
      select: {
        id: true,
        domainId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!course) {
      throw new AssignmentCourseNotFoundError(args.courseId);
    }

    const examId = createExamId();
    const storage = getRuntimeAssetStorage({
      dataDir: args.dataDir ? path.resolve(args.dataDir) : undefined,
    });
    const sourceAsset = createAssignmentSourceObjectKey(
      examId,
      args.source.originalName
    );
    const uploadedAsset = await storage.putObject({
      assetKey: `exam-asset:${examId}`,
      logicalBucket: 'exams',
      objectKey: sourceAsset.objectKey,
      bytes: args.source.buffer,
      mimeType: args.source.mimeType ?? null,
      originalName: sourceAsset.originalName,
      metadata: {
        relativeDataPath: sourceAsset.objectKey,
        assignmentId,
      },
      dataDir: args.dataDir ? path.resolve(args.dataDir) : undefined,
    });

    try {
      const row = await this.prisma.$transaction(async (tx: any) => {
        const week = await this.ensureDefaultWeek(tx, course);
        const sourceStoredAsset = await tx.storedAsset.create({
          data: {
            assetKey: `exam-asset:${examId}`,
            storageKind:
              uploadedAsset.storageKind as StoredAssetStorageKind,
            logicalBucket: uploadedAsset.logicalBucket,
            path: uploadedAsset.path,
            mimeType: uploadedAsset.mimeType || undefined,
            sizeBytes: uploadedAsset.sizeBytes ?? undefined,
            originalName: sourceAsset.originalName,
            metadata: uploadedAsset.metadata as never,
          },
          select: { id: true },
        });

        const backingExam = await tx.exam.create({
          data: {
            domainId: examId,
            title,
            assetId: sourceStoredAsset.id,
          },
          select: {
            id: true,
            domainId: true,
          },
        });

        const promptMaterial = await tx.courseMaterial.create({
          data: {
            domainId: getAssignmentMaterialDomainId(assignmentId, AssignmentMaterialRole.PROMPT),
            courseId: course.id,
            assetId: sourceStoredAsset.id,
            kind: CourseMaterialKind.ASSIGNMENT_PROMPT,
            title,
          },
          select: { id: true, domainId: true },
        });

        const assignment = await tx.assignment.create({
          data: {
            domainId: assignmentId,
            courseId: course.id,
            weekId: week.domainId,
            examRowId: backingExam.id,
            title,
            openAt: schedule.openAt,
            deadlineAt: schedule.deadlineAt,
            state: toStoredAssignmentState(state),
          },
          select: {
            id: true,
            domainId: true,
            title: true,
            openAt: true,
            deadlineAt: true,
            state: true,
            createdAt: true,
            updatedAt: true,
            course: { select: { domainId: true } },
            week: { select: { domainId: true } },
            exam: { select: { domainId: true } },
          },
        });

        await tx.assignmentMaterial.create({
          data: {
            assignmentId: assignment.id,
            materialId: promptMaterial.id,
            role: AssignmentMaterialRole.PROMPT,
          },
        });

        return tx.assignment.findUnique({
          where: { id: assignment.id },
          select: {
            domainId: true,
            title: true,
            openAt: true,
            deadlineAt: true,
            state: true,
            createdAt: true,
            updatedAt: true,
            course: { select: { domainId: true } },
            week: { select: { domainId: true } },
            exam: { select: { domainId: true } },
            materials: {
              select: {
                role: true,
                material: {
                  select: {
                    domainId: true,
                  },
                },
              },
            },
          },
        });
      });

      if (!row) {
        throw new Error(`Failed to create assignment: ${assignmentId}`);
      }

      return mapAssignmentRow(row);
    } catch (error) {
      await storage.deleteObject(uploadedAsset);
      throw error;
    }
  }

  async updateAssignment(args: {
    assignmentId: string;
    dataDir?: string;
    title?: string;
    openAt?: string;
    deadlineAt?: string;
    state?: Assignment['state'];
    source?: BinaryUpload;
  }): Promise<Assignment> {
    const existing = await this.prisma.assignment.findUnique({
      where: { domainId: args.assignmentId },
      select: {
        id: true,
        title: true,
        openAt: true,
        deadlineAt: true,
        exam: {
          select: {
            id: true,
            domainId: true,
            asset: {
              select: {
                id: true,
                path: true,
                storageKind: true,
                logicalBucket: true,
                mimeType: true,
                originalName: true,
                assetKey: true,
                sizeBytes: true,
                metadata: true,
              },
            },
          },
        },
        materials: {
          where: {
            role: AssignmentMaterialRole.PROMPT,
          },
          take: 1,
          select: {
            material: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (!existing) {
      throw new AssignmentNotFoundError(args.assignmentId);
    }

    const nextTitle = args.title?.trim() ?? existing.title;
    if (!nextTitle) {
      throw new Error('title is required');
    }

    if (args.source && !args.dataDir) {
      throw new Error('dataDir is required when replacing the assignment source');
    }

    const schedule = validateSchedule(
      args.openAt ?? existing.openAt.toISOString(),
      args.deadlineAt ?? existing.deadlineAt.toISOString()
    );

    const storage = getRuntimeAssetStorage({
      dataDir: args.dataDir ? path.resolve(args.dataDir) : undefined,
    });
    const nextSourceAsset =
      args.source && existing.exam?.domainId
        ? createAssignmentSourceObjectKey(existing.exam.domainId, args.source.originalName)
        : null;

    const currentExamAsset: RuntimeStoredAssetRecord | null = existing.exam?.asset
      ? {
          path: existing.exam.asset.path,
          storageKind: existing.exam.asset.storageKind,
          logicalBucket: existing.exam.asset.logicalBucket,
          mimeType: existing.exam.asset.mimeType ?? null,
          originalName: existing.exam.asset.originalName ?? null,
          assetKey: existing.exam.asset.assetKey ?? null,
          sizeBytes: existing.exam.asset.sizeBytes ?? null,
          metadata: existing.exam.asset.metadata ?? null,
        }
      : null;
    const replacedAsset =
      nextSourceAsset && args.source && currentExamAsset
        ? await storage.putObject({
            assetKey:
              currentExamAsset.assetKey ??
              `exam-asset:${existing.exam?.domainId ?? args.assignmentId}`,
            logicalBucket: currentExamAsset.logicalBucket,
            objectKey: nextSourceAsset.objectKey,
            bytes: args.source.buffer,
            mimeType: args.source.mimeType ?? null,
            originalName: nextSourceAsset.originalName,
            metadata: {
              relativeDataPath: nextSourceAsset.objectKey,
              assignmentId: args.assignmentId,
            },
            dataDir: args.dataDir ? path.resolve(args.dataDir) : undefined,
          })
        : null;

    try {
      const row = await this.prisma.$transaction(async (tx: any) => {
        await tx.assignment.update({
          where: { id: existing.id },
          data: {
            title: nextTitle,
            openAt: schedule.openAt,
            deadlineAt: schedule.deadlineAt,
            ...(args.state ? { state: toStoredAssignmentState(args.state) } : {}),
          },
        });

        if (existing.exam?.id) {
          await tx.exam.update({
            where: { id: existing.exam.id },
            data: {
              title: nextTitle,
            },
          });
        }

        if (replacedAsset && existing.exam?.asset?.id) {
          await tx.storedAsset.update({
            where: { id: existing.exam.asset.id },
            data: {
              storageKind: replacedAsset.storageKind as StoredAssetStorageKind,
              logicalBucket: replacedAsset.logicalBucket,
              path: replacedAsset.path,
              mimeType: replacedAsset.mimeType || undefined,
              sizeBytes: replacedAsset.sizeBytes ?? undefined,
              originalName: replacedAsset.originalName ?? undefined,
              metadata: replacedAsset.metadata as never,
            },
          });
        }

        const promptMaterialId = existing.materials[0]?.material.id;
        if (promptMaterialId) {
          await tx.courseMaterial.update({
            where: { id: promptMaterialId },
            data: {
              title: nextTitle,
            },
          });
        }

        return tx.assignment.findUnique({
          where: { id: existing.id },
          select: {
            domainId: true,
            title: true,
            openAt: true,
            deadlineAt: true,
            state: true,
            createdAt: true,
            updatedAt: true,
            course: { select: { domainId: true } },
            week: { select: { domainId: true } },
            exam: { select: { domainId: true } },
            materials: {
              select: {
                role: true,
                material: {
                  select: {
                    domainId: true,
                  },
                },
              },
            },
          },
        });
      });

      if (
        replacedAsset &&
        currentExamAsset &&
        (replacedAsset.storageKind !== currentExamAsset.storageKind ||
          replacedAsset.path !== currentExamAsset.path)
      ) {
        await storage.deleteObject(currentExamAsset);
      }

      return mapAssignmentRow(row);
    } catch (error) {
      if (
        replacedAsset &&
        (!currentExamAsset ||
          replacedAsset.storageKind !== currentExamAsset.storageKind ||
          replacedAsset.path !== currentExamAsset.path)
      ) {
        await storage.deleteObject(replacedAsset);
      }
      throw error;
    }
  }

  async listVisibleAssignmentsForStudent(userId: string): Promise<Assignment[]> {
    const now = new Date();
    const rows = await this.prisma.assignment.findMany({
      where: {
        state: {
          not: PrismaAssignmentState.DRAFT,
        },
        openAt: {
          lte: now,
        },
        course: {
          memberships: {
            some: {
              userId,
              role: 'STUDENT',
              status: 'ACTIVE',
            },
          },
        },
      },
      orderBy: [{ deadlineAt: 'asc' }, { createdAt: 'desc' }],
      select: {
        domainId: true,
        title: true,
        openAt: true,
        deadlineAt: true,
        state: true,
        createdAt: true,
        updatedAt: true,
        course: { select: { domainId: true } },
        week: { select: { domainId: true } },
        exam: { select: { domainId: true } },
        materials: {
          select: {
            role: true,
            material: {
              select: {
                domainId: true,
              },
            },
          },
        },
      },
    });

    return rows.map(mapAssignmentRow);
  }

  async getAssignmentForStudent(userId: string, assignmentId: string): Promise<Assignment | null> {
    const now = new Date();
    const row = await this.prisma.assignment.findFirst({
      where: {
        domainId: assignmentId,
        state: {
          not: PrismaAssignmentState.DRAFT,
        },
        openAt: {
          lte: now,
        },
        course: {
          memberships: {
            some: {
              userId,
              role: 'STUDENT',
              status: 'ACTIVE',
            },
          },
        },
      },
      select: {
        domainId: true,
        title: true,
        openAt: true,
        deadlineAt: true,
        state: true,
        createdAt: true,
        updatedAt: true,
        course: { select: { domainId: true } },
        week: { select: { domainId: true } },
        exam: { select: { domainId: true } },
        materials: {
          select: {
            role: true,
            material: {
              select: {
                domainId: true,
              },
            },
          },
        },
      },
    });

    return row ? mapAssignmentRow(row) : null;
  }

  async getAssignmentPromptAssetForStudent(
    userId: string,
    assignmentId: string
  ): Promise<AssignmentMaterialAssetRecord | null> {
    const now = new Date();
    const row = await this.prisma.assignment.findFirst({
      where: {
        domainId: assignmentId,
        state: {
          not: PrismaAssignmentState.DRAFT,
        },
        openAt: {
          lte: now,
        },
        course: {
          memberships: {
            some: {
              userId,
              role: 'STUDENT',
              status: 'ACTIVE',
            },
          },
        },
      },
      select: {
        materials: {
          where: {
            role: AssignmentMaterialRole.PROMPT,
          },
          take: 1,
          select: {
            material: {
              select: {
                asset: {
                  select: {
                    path: true,
                    storageKind: true,
                    logicalBucket: true,
                    mimeType: true,
                    originalName: true,
                    assetKey: true,
                    sizeBytes: true,
                    metadata: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const asset = row?.materials[0]?.material.asset;
    if (!asset) {
      return null;
    }

    return {
      path: asset.path,
      storageKind: asset.storageKind,
      logicalBucket: asset.logicalBucket,
      mimeType: asset.mimeType ?? null,
      originalName: asset.originalName ?? null,
      assetKey: asset.assetKey ?? null,
      sizeBytes: asset.sizeBytes ?? null,
      metadata: asset.metadata ?? null,
    };
  }

  async getAssignmentPromptAsset(
    assignmentId: string
  ): Promise<AssignmentMaterialAssetRecord | null> {
    return this.getAssignmentMaterialAsset(assignmentId, AssignmentMaterialRole.PROMPT);
  }
}
