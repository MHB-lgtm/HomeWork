import * as path from 'path';
import type { PrismaClient } from '@prisma/client';
import {
  AssignmentState,
  GradingJobKind,
  ReviewState,
  StoredAssetStorageKind,
  SubmissionState,
} from '@prisma/client';
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
  RuntimeStoredAssetRecord,
} from '../types';
import { getRuntimeAssetStorage } from '../storage/runtime-asset-storage';
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
import { deriveOperationalSubmissionStatus } from './lifecycle-status';

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
  | 'examIndex'
  | 'assignment'
  | 'gradingJob'
>;

type BinaryUpload = {
  originalName: string;
  buffer: Buffer;
  mimeType?: string;
};

type CreateRuntimeJobArgs = {
  dataDir?: string;
  courseId?: string | null;
  examId: string;
  questionId?: string | null;
  notes?: string | null;
  gradingMode: 'RUBRIC' | 'GENERAL';
  gradingScope: 'QUESTION' | 'DOCUMENT';
  rubric?: RubricSpec | null;
  submission: BinaryUpload;
  question?: BinaryUpload | null;
};

type CreateAssignmentSubmissionJobArgs = {
  dataDir?: string;
  assignmentId: string;
  studentUserId: string;
  submission: BinaryUpload;
};

const DEFAULT_VERSION_INFO = {
  prompt_version: '1.0.0',
  rubric_version: '1.0.0',
  model_version: 'gemini-1.5-pro',
} as const;

const createJobId = (): string =>
  `job-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

const createUploadPath = (jobId: string, originalName: string, prefix: string) => {
  const ext = path.extname(originalName);
  const baseName = path.basename(originalName, ext) || prefix;
  const fileName = `${baseName}_${jobId}${ext}`;
  return {
    objectKey: ['uploads', fileName].join('/'),
    originalName: path.basename(originalName) || fileName,
  };
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
  operationalStatus: deriveOperationalSubmissionStatus({
    hasPublishedResult: false,
    hasSubmission: true,
    jobStatus: row.status,
  }),
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

const toRuntimeStoredAssetRecord = (
  asset:
    | {
        path: string;
        storageKind: 'LOCAL_FILE' | 'OBJECT_STORAGE' | 'UNKNOWN';
        logicalBucket: string;
        mimeType: string | null;
        originalName: string | null;
        assetKey: string | null;
        sizeBytes: number | null;
        metadata: unknown | null;
      }
    | null
    | undefined
): RuntimeStoredAssetRecord | null =>
  asset
    ? {
        path: asset.path,
        storageKind: asset.storageKind,
        logicalBucket: asset.logicalBucket,
        mimeType: asset.mimeType ?? null,
        originalName: asset.originalName ?? null,
        assetKey: asset.assetKey ?? null,
        sizeBytes: asset.sizeBytes ?? null,
        metadata: asset.metadata ?? null,
      }
    : null;

const mapClaimedJob = (row: {
  domainId: string;
  jobKind: GradingJobKind;
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
  exam: { domainId: string } | null;
  assignment: { domainId: string } | null;
  examSnapshotAsset: {
    path: string;
    storageKind: 'LOCAL_FILE' | 'OBJECT_STORAGE' | 'UNKNOWN';
    logicalBucket: string;
    mimeType: string | null;
    originalName: string | null;
    assetKey: string | null;
    sizeBytes: number | null;
    metadata: unknown | null;
  } | null;
  promptAsset: {
    path: string;
    storageKind: 'LOCAL_FILE' | 'OBJECT_STORAGE' | 'UNKNOWN';
    logicalBucket: string;
    mimeType: string | null;
    originalName: string | null;
    assetKey: string | null;
    sizeBytes: number | null;
    metadata: unknown | null;
  } | null;
  referenceSolutionAsset: {
    path: string;
    storageKind: 'LOCAL_FILE' | 'OBJECT_STORAGE' | 'UNKNOWN';
    logicalBucket: string;
    mimeType: string | null;
    originalName: string | null;
    assetKey: string | null;
    sizeBytes: number | null;
    metadata: unknown | null;
  } | null;
  submissionAsset: {
    path: string;
    storageKind: 'LOCAL_FILE' | 'OBJECT_STORAGE' | 'UNKNOWN';
    logicalBucket: string;
    mimeType: string | null;
    originalName: string | null;
    assetKey: string | null;
    sizeBytes: number | null;
    metadata: unknown | null;
  };
  questionAsset: {
    path: string;
    storageKind: 'LOCAL_FILE' | 'OBJECT_STORAGE' | 'UNKNOWN';
    logicalBucket: string;
    mimeType: string | null;
    originalName: string | null;
    assetKey: string | null;
    sizeBytes: number | null;
    metadata: unknown | null;
  } | null;
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
  jobKind: row.jobKind,
  courseId: row.course?.domainId ?? null,
  examId: row.exam?.domainId ?? null,
  assignmentId: row.assignment?.domainId ?? null,
  questionId: row.questionId ?? null,
  examAsset: toRuntimeStoredAssetRecord(row.examSnapshotAsset),
  promptAsset: toRuntimeStoredAssetRecord(row.promptAsset),
  referenceSolutionAsset: toRuntimeStoredAssetRecord(row.referenceSolutionAsset),
  submissionAsset: toRuntimeStoredAssetRecord(row.submissionAsset)!,
  questionAsset: toRuntimeStoredAssetRecord(row.questionAsset),
  examFilePath: row.examSnapshotAsset?.path ?? null,
  promptFilePath: row.promptAsset?.path ?? null,
  referenceSolutionFilePath: row.referenceSolutionAsset?.path ?? null,
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
      storageKind: true,
      logicalBucket: true,
      mimeType: true,
      originalName: true,
      assetKey: true,
      sizeBytes: true,
      metadata: true,
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

  private async getAssignmentRuntimeContext(assignmentId: string) {
    const row = await this.prisma.assignment.findUnique({
      where: { domainId: assignmentId },
      select: {
        id: true,
        domainId: true,
        title: true,
        openAt: true,
        deadlineAt: true,
        state: true,
        course: {
          select: {
            id: true,
            domainId: true,
          },
        },
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
      },
    });

    if (!row) {
      throw new Error(`Assignment not found: ${assignmentId}`);
    }

    if (!row.exam?.asset) {
      throw new Error(`Assignment backing exam not found: ${assignmentId}`);
    }

    const examIndex = await this.prisma.examIndex.findFirst({
      where: {
        examRowId: row.exam.id,
      },
      select: {
        id: true,
      },
    });

    if (!examIndex) {
      throw new Error(`Assignment exam index is not ready: ${assignmentId}`);
    }

    return {
      assignment: row,
      course: row.course,
      exam: row.exam,
    };
  }

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
    const storage = getRuntimeAssetStorage({
      dataDir: args.dataDir ? path.resolve(args.dataDir) : undefined,
    });
    const course = await this.ensureCourse(args.courseId);
    const exam = await this.prisma.exam.findUnique({
      where: { domainId: args.examId },
      select: {
        id: true,
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
    });

    if (!exam) {
      throw new Error(`Exam not found: ${args.examId}`);
    }

    if (!exam.asset) {
      throw new Error(`Exam asset not found: ${args.examId}`);
    }

    const examSnapshot = createUploadPath(
      jobId,
      exam.asset.originalName ?? path.basename(exam.asset.path),
      'exam'
    );
    const submissionUpload = createUploadPath(
      jobId,
      args.submission.originalName,
      'submission'
    );
    const questionUpload = args.question
      ? createUploadPath(jobId, args.question.originalName, 'question')
      : null;
    const examSnapshotSource = toRuntimeStoredAssetRecord(exam.asset)!;
    const examSnapshotAssetRecord = await storage.putObject({
      assetKey: `job-exam-snapshot:${jobId}`,
      logicalBucket: 'job_exam_snapshots',
      objectKey: examSnapshot.objectKey,
      bytes: await storage.getObjectBytes(examSnapshotSource),
      mimeType: exam.asset.mimeType ?? null,
      originalName: examSnapshot.originalName,
      dataDir: args.dataDir ? path.resolve(args.dataDir) : undefined,
    });
    const submissionAssetRecord = await storage.putObject({
      assetKey: getSubmissionAssetKey(jobId),
      logicalBucket: 'job_submissions',
      objectKey: submissionUpload.objectKey,
      bytes: args.submission.buffer,
      mimeType: args.submission.mimeType ?? null,
      originalName: submissionUpload.originalName,
      dataDir: args.dataDir ? path.resolve(args.dataDir) : undefined,
    });
    const questionAssetRecord =
      questionUpload && args.question
        ? await storage.putObject({
            assetKey: `job-question:${jobId}`,
            logicalBucket: 'job_questions',
            objectKey: questionUpload.objectKey,
            bytes: args.question.buffer,
            mimeType: args.question.mimeType ?? null,
            originalName: questionUpload.originalName,
            dataDir: args.dataDir ? path.resolve(args.dataDir) : undefined,
          })
        : null;

    try {
      await this.prisma.$transaction(async (tx: any) => {
        const examSnapshotAsset = await tx.storedAsset.create({
          data: {
            assetKey: `job-exam-snapshot:${jobId}`,
            storageKind:
              examSnapshotAssetRecord.storageKind as StoredAssetStorageKind,
            logicalBucket: examSnapshotAssetRecord.logicalBucket,
            path: examSnapshotAssetRecord.path,
            mimeType: examSnapshotAssetRecord.mimeType || undefined,
            sizeBytes: examSnapshotAssetRecord.sizeBytes ?? undefined,
            originalName: examSnapshotAssetRecord.originalName ?? undefined,
            metadata: examSnapshotAssetRecord.metadata as never,
          },
          select: { id: true },
        });

        const submissionAsset = await tx.storedAsset.create({
          data: {
            assetKey: getSubmissionAssetKey(jobId),
            storageKind:
              submissionAssetRecord.storageKind as StoredAssetStorageKind,
            logicalBucket: submissionAssetRecord.logicalBucket,
            path: submissionAssetRecord.path,
            mimeType: submissionAssetRecord.mimeType || undefined,
            sizeBytes: submissionAssetRecord.sizeBytes ?? undefined,
            originalName: submissionAssetRecord.originalName ?? undefined,
            metadata: submissionAssetRecord.metadata as never,
          },
          select: { id: true },
        });

        const questionAsset =
          questionAssetRecord
            ? await tx.storedAsset.create({
                data: {
                  assetKey: `job-question:${jobId}`,
                  storageKind:
                    questionAssetRecord.storageKind as StoredAssetStorageKind,
                  logicalBucket: questionAssetRecord.logicalBucket,
                  path: questionAssetRecord.path,
                  mimeType: questionAssetRecord.mimeType || undefined,
                  sizeBytes: questionAssetRecord.sizeBytes ?? undefined,
                  originalName: questionAssetRecord.originalName ?? undefined,
                  metadata: questionAssetRecord.metadata as never,
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
            jobKind: GradingJobKind.EXAM,
            courseId: args.courseId?.trim() ? course.id : null,
            submissionId: submission.id,
            examRowId: exam.id,
            examSnapshotAssetId: examSnapshotAsset.id,
            assignmentId: null,
            promptAssetId: null,
            referenceSolutionAssetId: null,
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
        storage.deleteObject(examSnapshotAssetRecord),
        storage.deleteObject(submissionAssetRecord),
        questionAssetRecord ? storage.deleteObject(questionAssetRecord) : Promise.resolve(),
      ]);
      throw error;
    }
  }

  async createAssignmentSubmissionJob(
    args: CreateAssignmentSubmissionJobArgs
  ): Promise<{ jobId: string }> {
    const jobId = createJobId();
    const now = new Date();
    const storage = getRuntimeAssetStorage({
      dataDir: args.dataDir ? path.resolve(args.dataDir) : undefined,
    });
    const context = await this.getAssignmentRuntimeContext(args.assignmentId);
    const assignmentState = context.assignment.state;

    if (assignmentState === AssignmentState.DRAFT) {
      throw new Error('Assignment is not open for submissions');
    }

    if (assignmentState !== AssignmentState.OPEN) {
      throw new Error('Assignment is closed for submissions');
    }

    if (now < context.assignment.openAt) {
      throw new Error('Assignment is not open for submissions');
    }

    if (now >= context.assignment.deadlineAt) {
      throw new Error('Assignment deadline has passed');
    }

    const examSnapshot = createUploadPath(
      jobId,
      context.exam.asset.originalName ?? path.basename(context.exam.asset.path),
      'exam'
    );
    const submissionUpload = createUploadPath(
      jobId,
      args.submission.originalName,
      'assignment-submission'
    );
    const examSnapshotAssetRecord = await storage.putObject({
      assetKey: `job-exam-snapshot:${jobId}`,
      logicalBucket: 'job_exam_snapshots',
      objectKey: examSnapshot.objectKey,
      bytes: await storage.getObjectBytes(toRuntimeStoredAssetRecord(context.exam.asset)!),
      mimeType: context.exam.asset.mimeType ?? null,
      originalName: examSnapshot.originalName,
      dataDir: args.dataDir ? path.resolve(args.dataDir) : undefined,
    });
    const submissionAssetRecord = await storage.putObject({
      assetKey: getSubmissionAssetKey(jobId),
      logicalBucket: 'job_submissions',
      objectKey: submissionUpload.objectKey,
      bytes: args.submission.buffer,
      mimeType: args.submission.mimeType ?? null,
      originalName: submissionUpload.originalName,
      dataDir: args.dataDir ? path.resolve(args.dataDir) : undefined,
    });

    try {
      await this.prisma.$transaction(async (tx: any) => {
        const examSnapshotAsset = await tx.storedAsset.create({
          data: {
            assetKey: `job-exam-snapshot:${jobId}`,
            storageKind:
              examSnapshotAssetRecord.storageKind as StoredAssetStorageKind,
            logicalBucket: examSnapshotAssetRecord.logicalBucket,
            path: examSnapshotAssetRecord.path,
            mimeType: examSnapshotAssetRecord.mimeType || undefined,
            sizeBytes: examSnapshotAssetRecord.sizeBytes ?? undefined,
            originalName: examSnapshotAssetRecord.originalName ?? undefined,
            metadata: examSnapshotAssetRecord.metadata as never,
          },
          select: { id: true },
        });

        const submissionAsset = await tx.storedAsset.create({
          data: {
            assetKey: getSubmissionAssetKey(jobId),
            storageKind:
              submissionAssetRecord.storageKind as StoredAssetStorageKind,
            logicalBucket: submissionAssetRecord.logicalBucket,
            path: submissionAssetRecord.path,
            mimeType: submissionAssetRecord.mimeType || undefined,
            sizeBytes: submissionAssetRecord.sizeBytes ?? undefined,
            originalName: submissionAssetRecord.originalName ?? undefined,
            metadata: submissionAssetRecord.metadata as never,
          },
          select: { id: true },
        });

        const submissionMaterial = await tx.courseMaterial.create({
          data: {
            domainId: getSubmissionMaterialDomainId(jobId),
            courseId: context.course.id,
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
            courseId: context.course.id,
            studentUserId: args.studentUserId,
            moduleType: 'ASSIGNMENT',
            assignmentId: context.assignment.domainId,
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

        await tx.submission.updateMany({
          where: {
            assignmentId: context.assignment.domainId,
            studentUserId: args.studentUserId,
            id: { not: submission.id },
            state: {
              in: [
                SubmissionState.UPLOADED,
                SubmissionState.QUEUED,
                SubmissionState.PROCESSED,
                SubmissionState.LECTURER_EDITED,
                SubmissionState.PUBLISHED,
              ],
            },
          },
          data: {
            state: SubmissionState.SUPERSEDED,
            updatedAt: now,
          },
        });

        await tx.review.create({
          data: {
            domainId: getReviewDomainId(jobId),
            courseId: context.course.id,
            submissionId: submission.id,
            state: ReviewState.DRAFT,
            createdAt: now,
            updatedAt: now,
          },
        });

        await tx.gradingJob.create({
          data: {
            domainId: jobId,
            jobKind: GradingJobKind.ASSIGNMENT,
            courseId: context.course.id,
            submissionId: submission.id,
            examRowId: context.exam.id,
            examSnapshotAssetId: examSnapshotAsset.id,
            assignmentId: context.assignment.domainId,
            promptAssetId: null,
            referenceSolutionAssetId: null,
            submissionAssetId: submissionAsset.id,
            questionAssetId: null,
            status: 'PENDING',
            questionId: null,
            submissionMimeType: args.submission.mimeType || undefined,
            gradingMode: 'GENERAL',
            gradingScope: 'DOCUMENT',
            notes: null,
            createdAt: now,
            updatedAt: now,
          },
        });
      });

      return { jobId };
    } catch (error) {
      await Promise.all([
        storage.deleteObject(examSnapshotAssetRecord),
        storage.deleteObject(submissionAssetRecord),
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
    });

    if (!row?.submissionAsset) {
      return null;
    }

    return {
      path: row.submissionAsset.path,
      storageKind: row.submissionAsset.storageKind,
      logicalBucket: row.submissionAsset.logicalBucket,
      mimeType: row.submissionAsset.mimeType ?? null,
      originalName: row.submissionAsset.originalName ?? null,
      assetKey: row.submissionAsset.assetKey ?? null,
      sizeBytes: row.submissionAsset.sizeBytes ?? null,
      metadata: row.submissionAsset.metadata ?? null,
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
          jobKind: true,
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
          assignment: {
            select: {
              domainId: true,
            },
          },
          examSnapshotAsset: {
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
          promptAsset: {
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
          referenceSolutionAsset: {
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
          submissionAsset: {
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
          questionAsset: {
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
        jobKind: true,
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
        assignment: {
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
        examId: row.exam?.domainId ?? row.assignment?.domainId ?? undefined,
        questionId: row.questionId ?? null,
        gradingMode: row.gradingMode,
        gradingScope: row.gradingScope,
        createdAt: toIsoString(review?.createdAt ?? row.createdAt),
        updatedAt: toIsoString(review?.updatedAt ?? row.updatedAt),
        annotationCount: reviewRecord.annotations.length,
        hasResult: Boolean(row.resultJson),
        operationalStatus: deriveOperationalSubmissionStatus({
          hasPublishedResult: Boolean(row.submission.publishedResults[0]),
          hasSubmission: true,
          jobStatus: row.status,
        }),
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
    const derivedOperationalStatus = deriveOperationalSubmissionStatus({
      hasPublishedResult: Boolean(row.submission.publishedResults[0]),
      hasSubmission: true,
      jobStatus: row.status,
    });

    return {
      review,
      context: {
        ...(storedContext ?? mapStoredContext(row)),
        operationalStatus: derivedOperationalStatus,
      },
      submissionAsset: {
        path: row.submissionAsset.path,
        storageKind: row.submissionAsset.storageKind,
        logicalBucket: row.submissionAsset.logicalBucket,
        mimeType: row.submissionAsset.mimeType ?? null,
        originalName: row.submissionAsset.originalName ?? null,
        assetKey: row.submissionAsset.assetKey ?? null,
        sizeBytes: row.submissionAsset.sizeBytes ?? null,
        metadata: row.submissionAsset.metadata ?? null,
      },
      publication: toPublicationRecord(row.submission.publishedResults[0]),
    };
  }
}
