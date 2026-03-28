import * as fs from 'fs/promises';
import * as path from 'path';
import type { PrismaClient } from '@prisma/client';
import { ReviewState, StoredAssetStorageKind, SubmissionState } from '@prisma/client';
import type {
  ReviewRecord,
  RubricSpec,
} from '@hg/shared-schemas';
import { ReviewRecordSchema, RubricSpecSchema } from '@hg/shared-schemas';
import type {
  LegacyReviewContextRecord,
  LegacyReviewPublicationRecord,
  LegacySubmissionAssetRecord,
  RuntimeJobClaimRecord,
  RuntimeJobStatusRecord,
  RuntimeReviewSummaryRecord,
} from '../types';
import {
  asJsonValue,
  decimalToNumber,
  toDate,
  toIsoString,
} from '../mappers/domain';
import {
  getCourseDomainIdForLegacyJob,
  getReviewDomainId,
  getSubmissionAssetKey,
  getSubmissionDomainId,
  getSubmissionMaterialDomainId,
  PLACEHOLDER_COURSE_DOMAIN_ID,
  PLACEHOLDER_COURSE_LEGACY_KEY,
} from '../mappers/import';
import {
  reviewContextFromStoredPayload,
  reviewRecordFromStoredPayload,
} from '../mappers/review-record';

type JobStorePrisma = Pick<
  PrismaClient,
  | '$transaction'
  | 'course'
  | 'courseMaterial'
  | 'submission'
  | 'review'
  | 'reviewVersion'
  | 'publishedResult'
  | 'storedAsset'
  | 'exam'
  | 'gradingJob'
>;

type BinaryUpload = {
  originalName: string;
  buffer: Buffer;
  mimeType?: string;
};

type CreateRuntimeJobArgs = {
  dataDir: string;
  courseId?: string | null;
  examId: string;
  questionId?: string | null;
  notes?: string | null;
  gradingMode: 'RUBRIC' | 'GENERAL';
  gradingScope: 'QUESTION' | 'DOCUMENT';
  rubric?: RubricSpec | null;
  examSourcePath: string;
  submission: BinaryUpload;
  question?: BinaryUpload | null;
};

const DEFAULT_VERSION_INFO = {
  prompt_version: '1.0.0',
  rubric_version: '1.0.0',
  model_version: 'gemini-1.5-pro',
} as const;

const createJobId = (): string =>
  `job-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

const createUploadPath = (dataDir: string, jobId: string, originalName: string, prefix: string) => {
  const ext = path.extname(originalName);
  const baseName = path.basename(originalName, ext) || prefix;
  const fileName = `${baseName}_${jobId}${ext}`;
  const absolutePath = path.resolve(dataDir, 'uploads', fileName);
  return {
    absolutePath,
    originalName: path.basename(originalName) || fileName,
  };
};

const writeBufferAtomic = async (absolutePath: string, buffer: Buffer) => {
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  const tempPath = `${absolutePath}.tmp`;
  await fs.writeFile(tempPath, buffer);
  await fs.rename(tempPath, absolutePath);
};

const copyFileAtomic = async (sourcePath: string, targetPath: string) => {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  const tempPath = `${targetPath}.tmp`;
  await fs.copyFile(sourcePath, tempPath);
  await fs.rename(tempPath, targetPath);
};

const createEmptyReviewRecord = (
  jobId: string,
  createdAt: Date,
  updatedAt: Date
): ReviewRecord =>
  ReviewRecordSchema.parse({
    version: '1.0.0',
    jobId,
    createdAt: toIsoString(createdAt),
    updatedAt: toIsoString(updatedAt),
    annotations: [],
  });

const toPublicationRecord = (
  effective:
    | {
        domainId: string;
        publishedAt: Date;
        finalScore: Parameters<typeof decimalToNumber>[0];
        maxScore: Parameters<typeof decimalToNumber>[0];
        summary: string | null;
      }
    | undefined
): LegacyReviewPublicationRecord | undefined => {
  if (!effective) {
    return undefined;
  }

  return {
    isPublished: true,
    publishedResultId: effective.domainId,
    publishedAt: toIsoString(effective.publishedAt),
    score: decimalToNumber(effective.finalScore) ?? null,
    maxScore: decimalToNumber(effective.maxScore) ?? null,
    summary: effective.summary ?? null,
  };
};

const mapStoredContext = (row: {
  status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';
  resultJson: unknown | null;
  errorMessage: string | null;
  submissionMimeType: string | null;
  gradingMode: 'RUBRIC' | 'GENERAL';
  gradingScope: 'QUESTION' | 'DOCUMENT';
}): LegacyReviewContextRecord => ({
  status: row.status,
  resultJson: row.resultJson ?? null,
  errorMessage: row.errorMessage ?? null,
  submissionMimeType: row.submissionMimeType ?? null,
  gradingMode: row.gradingMode,
  gradingScope: row.gradingScope,
});

const mapJobStatus = (row: {
  domainId: string;
  status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';
  resultJson: unknown | null;
  errorMessage: string | null;
  submissionMimeType: string | null;
  gradingMode: 'RUBRIC' | 'GENERAL';
  gradingScope: 'QUESTION' | 'DOCUMENT';
}): RuntimeJobStatusRecord => ({
  jobId: row.domainId,
  status: row.status,
  resultJson: row.resultJson ?? null,
  errorMessage: row.errorMessage ?? null,
  submissionMimeType: row.submissionMimeType ?? null,
  gradingMode: row.gradingMode,
  gradingScope: row.gradingScope,
});

const mapClaimedJob = (row: {
  domainId: string;
  status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';
  questionId: string | null;
  submissionMimeType: string | null;
  gradingMode: 'RUBRIC' | 'GENERAL';
  gradingScope: 'QUESTION' | 'DOCUMENT';
  notes: string | null;
  rubricJson: unknown | null;
  resultJson: unknown | null;
  errorMessage: string | null;
  claimedAt: Date | null;
  leaseExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  course: { domainId: string } | null;
  exam: { domainId: string };
  examSnapshotAsset: { path: string };
  submissionAsset: { path: string; mimeType: string | null };
  questionAsset: { path: string } | null;
}): RuntimeJobClaimRecord => ({
  ...mapJobStatus({
    domainId: row.domainId,
    status: row.status,
    resultJson: row.resultJson,
    errorMessage: row.errorMessage,
    submissionMimeType: row.submissionMimeType ?? row.submissionAsset.mimeType ?? null,
    gradingMode: row.gradingMode,
    gradingScope: row.gradingScope,
  }),
  courseId: row.course?.domainId ?? null,
  examId: row.exam.domainId,
  questionId: row.questionId ?? null,
  examFilePath: row.examSnapshotAsset.path,
  submissionFilePath: row.submissionAsset.path,
  questionFilePath: row.questionAsset?.path ?? null,
  notes: row.notes ?? null,
  rubric: row.rubricJson ? RubricSpecSchema.parse(row.rubricJson) : null,
  claimedAt: toIsoString(row.claimedAt ?? row.updatedAt),
  leaseExpiresAt: toIsoString(row.leaseExpiresAt ?? row.updatedAt),
  createdAt: toIsoString(row.createdAt),
  updatedAt: toIsoString(row.updatedAt),
});

const selectRuntimeReviewInclude = {
  course: {
    select: {
      domainId: true,
    },
  },
  exam: {
    select: {
      domainId: true,
    },
  },
  submissionAsset: {
    select: {
      path: true,
      mimeType: true,
    },
  },
  submission: {
    select: {
      currentPublishedResultId: true,
      publishedResults: {
        where: { status: 'EFFECTIVE' },
        orderBy: { publishedAt: 'desc' },
        take: 1,
        select: {
          domainId: true,
          publishedAt: true,
          finalScore: true,
          maxScore: true,
          summary: true,
        },
      },
      review: {
        select: {
          createdAt: true,
          updatedAt: true,
          currentVersionId: true,
          versions: {
            select: {
              id: true,
              rawPayload: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
    },
  },
} as const;

export class PrismaJobStore {
  constructor(private readonly prisma: JobStorePrisma) {}

  private async ensureCourse(courseId?: string | null) {
    if (!courseId?.trim()) {
      const existing = await this.prisma.course.findUnique({
        where: { domainId: PLACEHOLDER_COURSE_DOMAIN_ID },
        select: { id: true, domainId: true },
      });

      if (existing) {
        return existing;
      }

      return this.prisma.course.create({
        data: {
          domainId: PLACEHOLDER_COURSE_DOMAIN_ID,
          legacyCourseKey: PLACEHOLDER_COURSE_LEGACY_KEY,
          title: 'Legacy Imported Reviews',
          status: 'ARCHIVED',
        },
        select: { id: true, domainId: true },
      });
    }

    const row = await this.prisma.course.findUnique({
      where: { domainId: getCourseDomainIdForLegacyJob(courseId) },
      select: { id: true, domainId: true },
    });

    if (!row) {
      throw new Error(`Course not found: ${courseId}`);
    }

    return row;
  }

  async hasRuntimeJob(jobId: string): Promise<boolean> {
    const row = await this.prisma.gradingJob.findUnique({
      where: { domainId: jobId },
      select: { id: true },
    });

    return Boolean(row);
  }

  async createJob(args: CreateRuntimeJobArgs): Promise<{ jobId: string }> {
    const jobId = createJobId();
    const now = new Date();
    const resolvedDataDir = path.resolve(args.dataDir);
    const course = await this.ensureCourse(args.courseId);
    const exam = await this.prisma.exam.findUnique({
      where: { domainId: args.examId },
      select: { id: true },
    });

    if (!exam) {
      throw new Error(`Exam not found: ${args.examId}`);
    }

    const examSnapshot = createUploadPath(
      resolvedDataDir,
      jobId,
      path.basename(args.examSourcePath),
      'exam'
    );
    const submissionUpload = createUploadPath(
      resolvedDataDir,
      jobId,
      args.submission.originalName,
      'submission'
    );
    const questionUpload = args.question
      ? createUploadPath(resolvedDataDir, jobId, args.question.originalName, 'question')
      : null;

    await copyFileAtomic(args.examSourcePath, examSnapshot.absolutePath);
    await writeBufferAtomic(submissionUpload.absolutePath, args.submission.buffer);
    if (questionUpload && args.question) {
      await writeBufferAtomic(questionUpload.absolutePath, args.question.buffer);
    }

    try {
      await this.prisma.$transaction(async (tx: any) => {
        const examSnapshotAsset = await tx.storedAsset.create({
          data: {
            assetKey: `job-exam-snapshot:${jobId}`,
            storageKind: StoredAssetStorageKind.LOCAL_FILE,
            logicalBucket: 'job_exam_snapshots',
            path: examSnapshot.absolutePath,
            originalName: examSnapshot.originalName,
          },
          select: { id: true },
        });

        const submissionAsset = await tx.storedAsset.create({
          data: {
            assetKey: getSubmissionAssetKey(jobId),
            storageKind: StoredAssetStorageKind.LOCAL_FILE,
            logicalBucket: 'job_submissions',
            path: submissionUpload.absolutePath,
            mimeType: args.submission.mimeType || undefined,
            sizeBytes: args.submission.buffer.byteLength,
            originalName: submissionUpload.originalName,
          },
          select: { id: true },
        });

        const questionAsset =
          questionUpload && args.question
            ? await tx.storedAsset.create({
                data: {
                  assetKey: `job-question:${jobId}`,
                  storageKind: StoredAssetStorageKind.LOCAL_FILE,
                  logicalBucket: 'job_questions',
                  path: questionUpload.absolutePath,
                  mimeType: args.question.mimeType || undefined,
                  sizeBytes: args.question.buffer.byteLength,
                  originalName: questionUpload.originalName,
                },
                select: { id: true },
              })
            : null;

        const submissionMaterial = await tx.courseMaterial.create({
          data: {
            domainId: getSubmissionMaterialDomainId(jobId),
            courseId: course.id,
            assetId: submissionAsset.id,
            kind: 'SUBMISSION_PDF',
            title: submissionUpload.originalName,
            createdAt: now,
            updatedAt: now,
          },
          select: { id: true },
        });

        const submission = await tx.submission.create({
          data: {
            domainId: getSubmissionDomainId(jobId),
            courseId: course.id,
            studentUserId: null,
            moduleType: 'LEGACY_JOB',
            assignmentId: null,
            examBatchId: null,
            materialId: submissionMaterial.id,
            submittedAt: now,
            state: SubmissionState.QUEUED,
            legacyJobId: jobId,
            createdAt: now,
            updatedAt: now,
          },
          select: { id: true },
        });

        await tx.review.create({
          data: {
            domainId: getReviewDomainId(jobId),
            courseId: course.id,
            submissionId: submission.id,
            state: ReviewState.DRAFT,
            createdAt: now,
            updatedAt: now,
          },
        });

        await tx.gradingJob.create({
          data: {
            domainId: jobId,
            courseId: args.courseId?.trim() ? course.id : null,
            submissionId: submission.id,
            examRowId: exam.id,
            examSnapshotAssetId: examSnapshotAsset.id,
            submissionAssetId: submissionAsset.id,
            questionAssetId: questionAsset?.id ?? null,
            status: 'PENDING',
            questionId: args.questionId?.trim() || null,
            submissionMimeType: args.submission.mimeType || undefined,
            gradingMode: args.gradingMode,
            gradingScope: args.gradingScope,
            notes: args.notes?.trim() || null,
            rubricJson: args.rubric ? asJsonValue(args.rubric) : undefined,
            createdAt: now,
            updatedAt: now,
          },
        });
      });

      return { jobId };
    } catch (error) {
      await Promise.all([
        fs.rm(examSnapshot.absolutePath, { force: true }),
        fs.rm(submissionUpload.absolutePath, { force: true }),
        questionUpload ? fs.rm(questionUpload.absolutePath, { force: true }) : Promise.resolve(),
      ]);
      throw error;
    }
  }

  async getJobStatus(jobId: string): Promise<RuntimeJobStatusRecord | null> {
    const row = await this.prisma.gradingJob.findUnique({
      where: { domainId: jobId },
      select: {
        domainId: true,
        status: true,
        resultJson: true,
        errorMessage: true,
        submissionMimeType: true,
        gradingMode: true,
        gradingScope: true,
      },
    });

    return row ? mapJobStatus(row) : null;
  }

  async getJobSubmissionAsset(jobId: string): Promise<LegacySubmissionAssetRecord | null> {
    const row = await this.prisma.gradingJob.findUnique({
      where: { domainId: jobId },
      select: {
        submissionAsset: {
          select: {
            path: true,
            mimeType: true,
          },
        },
      },
    });

    if (!row?.submissionAsset) {
      return null;
    }

    return {
      path: row.submissionAsset.path,
      mimeType: row.submissionAsset.mimeType ?? null,
    };
  }

  async claimNextPendingJob(args: {
    workerId: string;
    leaseMs: number;
  }): Promise<RuntimeJobClaimRecord | null> {
    const now = new Date();
    const leaseExpiresAt = new Date(now.getTime() + args.leaseMs);

    return this.prisma.$transaction(async (tx: any) => {
      const candidate = await tx.gradingJob.findFirst({
        where: {
          OR: [
            { status: 'PENDING' },
            {
              status: 'RUNNING',
              leaseExpiresAt: {
                lt: now,
              },
            },
          ],
        },
        orderBy: [{ createdAt: 'asc' }],
        select: {
          id: true,
        },
      });

      if (!candidate) {
        return null;
      }

      const updated = await tx.gradingJob.updateMany({
        where: {
          id: candidate.id,
          OR: [
            { status: 'PENDING' },
            {
              status: 'RUNNING',
              leaseExpiresAt: {
                lt: now,
              },
            },
          ],
        },
        data: {
          status: 'RUNNING',
          workerId: args.workerId,
          claimedAt: now,
          leaseExpiresAt,
          updatedAt: now,
        },
      });

      if (updated.count === 0) {
        return null;
      }

      const row = await tx.gradingJob.findUnique({
        where: { id: candidate.id },
        select: {
          domainId: true,
          status: true,
          questionId: true,
          submissionMimeType: true,
          gradingMode: true,
          gradingScope: true,
          notes: true,
          rubricJson: true,
          resultJson: true,
          errorMessage: true,
          claimedAt: true,
          leaseExpiresAt: true,
          createdAt: true,
          updatedAt: true,
          course: {
            select: {
              domainId: true,
            },
          },
          exam: {
            select: {
              domainId: true,
            },
          },
          examSnapshotAsset: {
            select: {
              path: true,
            },
          },
          submissionAsset: {
            select: {
              path: true,
              mimeType: true,
            },
          },
          questionAsset: {
            select: {
              path: true,
            },
          },
        },
      });

      return row ? mapClaimedJob(row) : null;
    });
  }

  async renewLease(args: {
    jobId: string;
    workerId: string;
    leaseMs: number;
  }): Promise<boolean> {
    const now = new Date();
    const nextLease = new Date(now.getTime() + args.leaseMs);
    const updated = await this.prisma.gradingJob.updateMany({
      where: {
        domainId: args.jobId,
        workerId: args.workerId,
        status: 'RUNNING',
      },
      data: {
        leaseExpiresAt: nextLease,
        updatedAt: now,
      },
    });

    return updated.count > 0;
  }

  async completeJob(args: {
    jobId: string;
    workerId: string;
    resultJson: unknown;
  }): Promise<void> {
    const now = new Date();

    await this.prisma.$transaction(async (tx: any) => {
      const row = await tx.gradingJob.findUnique({
        where: { domainId: args.jobId },
        select: { id: true, submissionId: true },
      });

      if (!row) {
        throw new Error(`Job not found: ${args.jobId}`);
      }

      const updated = await tx.gradingJob.updateMany({
        where: {
          id: row.id,
          workerId: args.workerId,
          status: 'RUNNING',
        },
        data: {
          status: 'DONE',
          resultJson: asJsonValue(args.resultJson),
          errorMessage: null,
          completedAt: now,
          failedAt: null,
          leaseExpiresAt: null,
          workerId: null,
          updatedAt: now,
        },
      });

      if (updated.count === 0) {
        throw new Error(`Job ${args.jobId} is not owned by worker ${args.workerId}`);
      }

      await tx.submission.update({
        where: { id: row.submissionId },
        data: {
          state: SubmissionState.PROCESSED,
          updatedAt: now,
        },
      });
    });
  }

  async failJob(args: {
    jobId: string;
    workerId: string;
    errorMessage: string;
  }): Promise<void> {
    const now = new Date();

    await this.prisma.$transaction(async (tx: any) => {
      const row = await tx.gradingJob.findUnique({
        where: { domainId: args.jobId },
        select: { id: true, submissionId: true },
      });

      if (!row) {
        throw new Error(`Job not found: ${args.jobId}`);
      }

      const updated = await tx.gradingJob.updateMany({
        where: {
          id: row.id,
          workerId: args.workerId,
          status: 'RUNNING',
        },
        data: {
          status: 'FAILED',
          errorMessage: args.errorMessage,
          failedAt: now,
          completedAt: null,
          leaseExpiresAt: null,
          workerId: null,
          updatedAt: now,
        },
      });

      if (updated.count === 0) {
        throw new Error(`Job ${args.jobId} is not owned by worker ${args.workerId}`);
      }

      await tx.submission.update({
        where: { id: row.submissionId },
        data: {
          state: SubmissionState.QUEUED,
          updatedAt: now,
        },
      });
    });
  }

  async listRuntimeReviewSummaries(): Promise<RuntimeReviewSummaryRecord[]> {
    const rows = await this.prisma.gradingJob.findMany({
      select: {
        domainId: true,
        status: true,
        questionId: true,
        gradingMode: true,
        gradingScope: true,
        resultJson: true,
        createdAt: true,
        updatedAt: true,
        exam: {
          select: {
            domainId: true,
          },
        },
        submission: {
          select: {
            currentPublishedResultId: true,
            publishedResults: {
              where: { status: 'EFFECTIVE' },
              orderBy: { publishedAt: 'desc' },
              take: 1,
              select: {
                domainId: true,
                publishedAt: true,
                finalScore: true,
                maxScore: true,
                summary: true,
              },
            },
            review: {
              select: {
                createdAt: true,
                updatedAt: true,
                currentVersionId: true,
                versions: {
                  select: {
                    id: true,
                    rawPayload: true,
                  },
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                },
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return rows.map((row) => {
      const review = row.submission.review;
      const rawPayload = review?.versions[0]?.rawPayload ?? null;
      const reviewRecord = rawPayload
        ? reviewRecordFromStoredPayload(
            row.domainId,
            rawPayload,
            toIsoString(review?.createdAt ?? row.createdAt),
            toIsoString(review?.updatedAt ?? row.updatedAt)
          )
        : createEmptyReviewRecord(
            row.domainId,
            review?.createdAt ?? row.createdAt,
            review?.updatedAt ?? row.updatedAt
          );

      return {
        jobId: row.domainId,
        displayName: reviewRecord.displayName ?? null,
        status: row.status,
        examId: row.exam.domainId,
        questionId: row.questionId ?? null,
        gradingMode: row.gradingMode,
        gradingScope: row.gradingScope,
        createdAt: toIsoString(review?.createdAt ?? row.createdAt),
        updatedAt: toIsoString(review?.updatedAt ?? row.updatedAt),
        annotationCount: reviewRecord.annotations.length,
        hasResult: Boolean(row.resultJson),
        publication: toPublicationRecord(row.submission.publishedResults[0]),
      } satisfies RuntimeReviewSummaryRecord;
    });
  }

  async getRuntimeReviewDetail(jobId: string): Promise<{
    review: ReviewRecord;
    context: LegacyReviewContextRecord;
    submissionAsset: LegacySubmissionAssetRecord;
    publication?: LegacyReviewPublicationRecord;
  } | null> {
    const row = await this.prisma.gradingJob.findUnique({
      where: { domainId: jobId },
      select: {
        domainId: true,
        status: true,
        resultJson: true,
        errorMessage: true,
        submissionMimeType: true,
        gradingMode: true,
        gradingScope: true,
        createdAt: true,
        updatedAt: true,
        ...selectRuntimeReviewInclude,
      },
    });

    if (!row?.submission.review || !row.submissionAsset) {
      return null;
    }

    const reviewRow = row.submission.review;
    const currentVersion = reviewRow.versions[0] ?? null;
    const review = currentVersion
      ? reviewRecordFromStoredPayload(
          jobId,
          currentVersion.rawPayload,
          toIsoString(reviewRow.createdAt),
          toIsoString(reviewRow.updatedAt)
        )
      : createEmptyReviewRecord(jobId, reviewRow.createdAt, reviewRow.updatedAt);

    const storedContext = currentVersion
      ? reviewContextFromStoredPayload(currentVersion.rawPayload)
      : null;

    return {
      review,
      context: storedContext ?? mapStoredContext(row),
      submissionAsset: {
        path: row.submissionAsset.path,
        mimeType: row.submissionAsset.mimeType ?? null,
      },
      publication: toPublicationRecord(row.submission.publishedResults[0]),
    };
  }
}
