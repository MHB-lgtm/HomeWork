import * as fs from 'fs/promises';
import { getJob, getOrCreateReview, type JobRecord } from '@hg/local-job-store';
import type {
  LegacyReviewContextRecord,
  LegacySubmissionAssetRecord,
} from '@hg/postgres-store';
import type { ReviewRecord } from '@hg/shared-schemas';
import { getServerPersistence } from './persistence';

export type ReviewRouteContext = {
  status: string;
  resultJson: unknown | null;
  errorMessage: string | null;
  submissionMimeType: string | null;
  gradingMode: 'RUBRIC' | 'GENERAL' | null;
  gradingScope: 'QUESTION' | 'DOCUMENT' | null;
  source: 'postgres' | 'file';
};

export type ResolvedReviewDetail = {
  review: ReviewRecord;
  context?: ReviewRouteContext;
  source: 'postgres' | 'file';
};

export type ResolvedSubmissionAsset = LegacySubmissionAssetRecord & {
  source: 'postgres' | 'file';
};

const hasDataDirConfigured = (): boolean => Boolean(process.env.HG_DATA_DIR);

const toFileBackedContext = (job: JobRecord): Omit<ReviewRouteContext, 'source'> => ({
  status: job.status,
  resultJson: job.resultJson ?? null,
  errorMessage: job.errorMessage ?? null,
  submissionMimeType: job.inputs.submissionMimeType ?? null,
  gradingMode: job.inputs.gradingMode ?? null,
  gradingScope: job.inputs.gradingScope ?? null,
});

const toPostgresContext = (
  context: LegacyReviewContextRecord
): Omit<ReviewRouteContext, 'source'> | null => {
  if (!context.status) {
    return null;
  }

  return {
    status: context.status,
    resultJson: Object.prototype.hasOwnProperty.call(context, 'resultJson')
      ? (context.resultJson ?? null)
      : null,
    errorMessage: context.errorMessage ?? null,
    submissionMimeType: context.submissionMimeType ?? null,
    gradingMode: context.gradingMode ?? null,
    gradingScope: context.gradingScope ?? null,
  };
};

const mergeContext = (
  postgresContext: LegacyReviewContextRecord | undefined,
  fileJob: JobRecord | null,
  source: 'postgres' | 'file'
): ReviewRouteContext | undefined => {
  const fileContext = fileJob ? toFileBackedContext(fileJob) : null;
  const dbContext = postgresContext ? toPostgresContext(postgresContext) : null;
  const status = dbContext?.status ?? fileContext?.status;
  if (!status) {
    return undefined;
  }

  return {
    status,
    resultJson:
      dbContext?.resultJson ??
      fileContext?.resultJson ??
      null,
    errorMessage:
      dbContext?.errorMessage ??
      fileContext?.errorMessage ??
      null,
    submissionMimeType:
      dbContext?.submissionMimeType ??
      fileContext?.submissionMimeType ??
      null,
    gradingMode:
      dbContext?.gradingMode ??
      fileContext?.gradingMode ??
      null,
    gradingScope:
      dbContext?.gradingScope ??
      fileContext?.gradingScope ??
      null,
    source,
  };
};

const loadFileBackedJob = async (jobId: string): Promise<JobRecord | null> => {
  if (!hasDataDirConfigured()) {
    return null;
  }

  return getJob(jobId);
};

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      return false;
    }

    throw error;
  }
};

export const getResolvedReviewDetail = async (
  jobId: string
): Promise<ResolvedReviewDetail> => {
  const persistence = getServerPersistence();

  if (persistence) {
    const detail = await persistence.reviewRecords.getReviewDetailByLegacyJobId(jobId);
    if (detail) {
      const fileJob = detail.context ? null : await loadFileBackedJob(jobId);
      return {
        review: detail.review,
        context: mergeContext(detail.context, fileJob, 'postgres'),
        source: 'postgres',
      };
    }
  }

  if (!hasDataDirConfigured()) {
    throw new Error('HG_DATA_DIR is not set in environment');
  }

  const [review, job] = await Promise.all([getOrCreateReview(jobId), getJob(jobId)]);

  return {
    review,
    context: job ? { ...toFileBackedContext(job), source: 'file' } : undefined,
    source: 'file',
  };
};

export const resolveReviewSubmissionAsset = async (
  jobId: string
): Promise<ResolvedSubmissionAsset | null> => {
  const persistence = getServerPersistence();

  if (persistence) {
    const dbAsset = await persistence.reviewRecords.getSubmissionAssetByLegacyJobId(jobId);
    if (dbAsset && (await fileExists(dbAsset.path))) {
      return {
        ...dbAsset,
        source: 'postgres',
      };
    }
  }

  const job = await loadFileBackedJob(jobId);
  if (!job?.inputs.submissionFilePath) {
    return null;
  }

  return {
    path: job.inputs.submissionFilePath,
    mimeType: job.inputs.submissionMimeType ?? null,
    source: 'file',
  };
};
