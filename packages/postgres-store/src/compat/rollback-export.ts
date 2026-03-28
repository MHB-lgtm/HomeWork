import * as fs from 'fs/promises';
import * as path from 'path';
import type { PrismaClient } from '@prisma/client';
import type { ReviewRecord, RubricSpec } from '@hg/shared-schemas';
import { RubricSpecSchema } from '@hg/shared-schemas';
import type {
  LegacyJobStatus,
  RollbackJobExportSummary,
} from '../types';
import { toIsoString } from '../mappers/domain';
import { reviewRecordFromStoredPayload } from '../mappers/review-record';

type RollbackExportPrisma = Pick<PrismaClient, 'gradingJob'>;

type RollbackExportRow = {
  domainId: string;
  status: LegacyJobStatus;
  questionId: string | null;
  submissionMimeType: string | null;
  gradingMode: 'RUBRIC' | 'GENERAL';
  gradingScope: 'QUESTION' | 'DOCUMENT';
  notes: string | null;
  rubricJson: unknown | null;
  resultJson: unknown | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  course: { domainId: string } | null;
  exam: { domainId: string };
  examSnapshotAsset: { path: string };
  submissionAsset: { path: string; mimeType: string | null };
  questionAsset: { path: string } | null;
  submission: {
    review: {
      currentVersionId: string | null;
      createdAt: Date;
      updatedAt: Date;
      versions: Array<{
        id: string;
        rawPayload: unknown;
      }>;
    } | null;
  };
};

type RollbackExportOptions = {
  dataDir: string;
  jobId?: string;
  logger?: Pick<Console, 'log' | 'warn'>;
};

type LegacyQueueJobRecord = {
  id: string;
  status: LegacyJobStatus;
  createdAt: string;
  updatedAt: string;
  inputs: {
    courseId?: string;
    examId?: string;
    questionId: string;
    examFilePath: string;
    submissionFilePath: string;
    submissionMimeType?: string;
    questionFilePath?: string;
    notes?: string;
    gradingMode?: 'RUBRIC' | 'GENERAL';
    gradingScope?: 'QUESTION' | 'DOCUMENT';
  };
  versions: {
    prompt_version: string;
    rubric_version: string;
    model_version: string;
  };
  rubric?: RubricSpec;
  resultJson?: unknown;
  errorMessage?: string;
};

const DEFAULT_VERSION_INFO = {
  prompt_version: '1.0.0',
  rubric_version: '1.0.0',
  model_version: 'gemini-1.5-pro',
} as const;

const EXPORTABLE_STATUSES: LegacyJobStatus[] = ['PENDING', 'RUNNING'];

const writeJsonAtomic = async (filePath: string, data: unknown): Promise<void> => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempFilePath = `${filePath}.tmp`;
  await fs.writeFile(tempFilePath, JSON.stringify(data, null, 2), 'utf-8');
  await fs.rename(tempFilePath, filePath);
};

const normalizeRubric = (rubricJson: unknown | null): RubricSpec | undefined => {
  if (!rubricJson) {
    return undefined;
  }

  return RubricSpecSchema.parse(rubricJson);
};

const toLegacyQueueJobRecord = (row: RollbackExportRow): LegacyQueueJobRecord => ({
  id: row.domainId,
  status: row.status,
  createdAt: toIsoString(row.createdAt),
  updatedAt: toIsoString(row.updatedAt),
  inputs: {
    courseId: row.course?.domainId ?? undefined,
    examId: row.exam.domainId,
    questionId: row.questionId ?? '',
    examFilePath: row.examSnapshotAsset.path,
    submissionFilePath: row.submissionAsset.path,
    submissionMimeType: row.submissionMimeType ?? row.submissionAsset.mimeType ?? undefined,
    questionFilePath: row.questionAsset?.path ?? undefined,
    notes: row.notes ?? undefined,
    gradingMode: row.gradingMode,
    gradingScope: row.gradingScope,
  },
  versions: DEFAULT_VERSION_INFO,
  rubric: normalizeRubric(row.rubricJson),
  resultJson: row.resultJson ?? undefined,
  errorMessage: row.errorMessage ?? undefined,
});

const getCurrentReviewRecord = (row: RollbackExportRow): ReviewRecord | null => {
  const review = row.submission.review;
  if (!review?.currentVersionId) {
    return null;
  }

  const currentVersion = review.versions.find((version) => version.id === review.currentVersionId);
  if (!currentVersion) {
    return null;
  }

  return reviewRecordFromStoredPayload(
    row.domainId,
    currentVersion.rawPayload,
    toIsoString(review.createdAt),
    toIsoString(review.updatedAt)
  );
};

const getJobFilePath = (dataDir: string, jobId: string, status: LegacyJobStatus): string => {
  const folder = status === 'RUNNING' ? 'running' : 'pending';
  return path.resolve(dataDir, 'jobs', folder, `${jobId}.json`);
};

const getReviewFilePath = (dataDir: string, jobId: string): string =>
  path.resolve(dataDir, 'reviews', `${jobId}.json`);

const createSummary = (dataDir: string, jobId?: string): RollbackJobExportSummary => ({
  dataDir,
  requestedJobId: jobId ?? null,
  exportedJobs: 0,
  exportedReviews: 0,
  skippedJobs: 0,
  exportedJobIds: [],
  exportedReviewJobIds: [],
  skippedJobIds: [],
  warningCounts: {},
  warnings: [],
});

const pushWarning = (
  summary: RollbackJobExportSummary,
  code: string,
  message: string,
  logger?: Pick<Console, 'warn'>
) => {
  summary.warningCounts[code] = (summary.warningCounts[code] ?? 0) + 1;
  summary.warnings.push(message);
  logger?.warn(message);
};

const selectRollbackExportJob = {
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
  submission: {
    select: {
      review: {
        select: {
          currentVersionId: true,
          createdAt: true,
          updatedAt: true,
          versions: {
            select: {
              id: true,
              rawPayload: true,
            },
            orderBy: {
              createdAt: 'desc',
            },
          },
        },
      },
    },
  },
} as const;

export const exportRuntimeJobsToLegacyQueue = async (
  prisma: RollbackExportPrisma,
  options: RollbackExportOptions
): Promise<RollbackJobExportSummary> => {
  const resolvedDataDir = path.resolve(options.dataDir);
  const summary = createSummary(resolvedDataDir, options.jobId);

  const rows: RollbackExportRow[] = options.jobId
    ? ((await prisma.gradingJob.findMany({
        where: {
          domainId: options.jobId,
        },
        select: selectRollbackExportJob,
        orderBy: {
          createdAt: 'asc',
        },
      })) as RollbackExportRow[])
    : ((await prisma.gradingJob.findMany({
        where: {
          status: {
            in: EXPORTABLE_STATUSES,
          },
        },
        select: selectRollbackExportJob,
        orderBy: {
          createdAt: 'asc',
        },
      })) as RollbackExportRow[]);

  if (rows.length === 0 && options.jobId) {
    pushWarning(
      summary,
      'missing_job',
      `No runtime DB job found for rollback export: ${options.jobId}`,
      options.logger
    );
    return summary;
  }

  for (const row of rows) {
    if (!EXPORTABLE_STATUSES.includes(row.status)) {
      summary.skippedJobs += 1;
      summary.skippedJobIds.push(row.domainId);
      pushWarning(
        summary,
        'non_exportable_status',
        `Skipping runtime DB job ${row.domainId}: status ${row.status} is not exportable for rollback`,
        options.logger
      );
      continue;
    }

    const jobRecord = toLegacyQueueJobRecord(row);
    const jobFilePath = getJobFilePath(resolvedDataDir, row.domainId, row.status);
    await writeJsonAtomic(jobFilePath, jobRecord);
    summary.exportedJobs += 1;
    summary.exportedJobIds.push(row.domainId);
    options.logger?.log(
      `[postgres-store] exported rollback job ${row.domainId} -> ${jobFilePath}`
    );

    const reviewRecord = getCurrentReviewRecord(row);
    if (!reviewRecord) {
      continue;
    }

    const reviewFilePath = getReviewFilePath(resolvedDataDir, row.domainId);
    await writeJsonAtomic(reviewFilePath, reviewRecord);
    summary.exportedReviews += 1;
    summary.exportedReviewJobIds.push(row.domainId);
    options.logger?.log(
      `[postgres-store] exported rollback review ${row.domainId} -> ${reviewFilePath}`
    );
  }

  return summary;
};
