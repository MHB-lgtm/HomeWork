import * as fs from 'fs/promises';
import type {
  LegacyReviewContextRecord,
  LegacyReviewPublicationRecord,
  LegacySubmissionAssetRecord,
} from '@hg/postgres-store';
import type { ReviewRecord } from '@hg/shared-schemas';
import { getServerPersistence } from './persistence';

export type ReviewPublicationContext = {
  isPublished: boolean;
  publishedResultId?: string | null;
  publishedAt?: string | null;
  score?: number | null;
  maxScore?: number | null;
  summary?: string | null;
};

export type ReviewRouteContext = {
  status: string;
  resultJson: unknown | null;
  errorMessage: string | null;
  submissionMimeType: string | null;
  gradingMode: 'RUBRIC' | 'GENERAL' | null;
  gradingScope: 'QUESTION' | 'DOCUMENT' | null;
  source: 'postgres';
  publication?: ReviewPublicationContext;
};

export type ResolvedReviewDetail = {
  review: ReviewRecord;
  context?: ReviewRouteContext;
  source: 'postgres';
};

export type ResolvedSubmissionAsset = LegacySubmissionAssetRecord & {
  source: 'postgres';
};

const createUnknownPostgresContext = (
  publication?: LegacyReviewPublicationRecord
): ReviewRouteContext => ({
  status: 'UNKNOWN',
  resultJson: null,
  errorMessage: null,
  submissionMimeType: null,
  gradingMode: null,
  gradingScope: null,
  source: 'postgres',
  publication,
});

const toPostgresContext = (
  context: LegacyReviewContextRecord
): Omit<ReviewRouteContext, 'source' | 'publication'> | null => {
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
  publication: LegacyReviewPublicationRecord | undefined
): ReviewRouteContext => {
  const dbContext = postgresContext ? toPostgresContext(postgresContext) : null;
  if (!dbContext?.status) {
    return createUnknownPostgresContext(publication);
  }

  return {
    status: dbContext.status,
    resultJson: dbContext.resultJson ?? null,
    errorMessage: dbContext.errorMessage ?? null,
    submissionMimeType: dbContext.submissionMimeType ?? null,
    gradingMode: dbContext.gradingMode ?? null,
    gradingScope: dbContext.gradingScope ?? null,
    source: 'postgres',
    publication,
  };
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
): Promise<ResolvedReviewDetail | null> => {
  const persistence = getServerPersistence();
  if (!persistence) {
    throw new Error('DATABASE_URL is not set in environment');
  }

  const runtimeDetail = await persistence.jobs.getRuntimeReviewDetail(jobId);
  if (runtimeDetail) {
    return {
      review: runtimeDetail.review,
      context: mergeContext(runtimeDetail.context, runtimeDetail.publication),
      source: 'postgres',
    };
  }

  const detail = await persistence.reviewRecords.getReviewDetailByLegacyJobId(jobId);
  if (!detail) {
    return null;
  }

  return {
    review: detail.review,
    context: mergeContext(detail.context, detail.publication),
    source: 'postgres',
  };
};

export const resolveReviewSubmissionAsset = async (
  jobId: string
): Promise<ResolvedSubmissionAsset | null> => {
  const persistence = getServerPersistence();
  if (!persistence) {
    throw new Error('DATABASE_URL is not set in environment');
  }

  const runtimeAsset = await persistence.jobs.getJobSubmissionAsset(jobId);
  if (runtimeAsset && (await fileExists(runtimeAsset.path))) {
    return {
      ...runtimeAsset,
      source: 'postgres',
    };
  }

  const dbAsset = await persistence.reviewRecords.getSubmissionAssetByLegacyJobId(jobId);
  if (dbAsset && (await fileExists(dbAsset.path))) {
    return {
      ...dbAsset,
      source: 'postgres',
    };
  }

  return null;
};
