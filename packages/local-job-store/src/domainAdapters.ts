import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  AssetStoragePort,
  Review,
  ReviewResultEnvelope,
  ReviewVersion,
  StoredAssetMetadata,
} from '@hg/domain-workflow';
import { loadReview } from './fileReviewStore';
import { getJob } from './fileJobStore';

const reviewKindFromAnnotations = (reviewRecord: NonNullable<Awaited<ReturnType<typeof loadReview>>>): ReviewVersion['kind'] =>
  reviewRecord.annotations.some((annotation) => annotation.createdBy === 'human')
    ? 'lecturer_edit'
    : 'ai_draft';

const getDataDir = (): string => {
  const dataDir = process.env.HG_DATA_DIR;
  if (!dataDir) {
    throw new Error('HG_DATA_DIR is not set in environment variables');
  }
  return path.resolve(dataDir);
};

const toStoredAssetMetadata = async (
  assetId: string,
  logicalBucket: string,
  absolutePath: string,
  mimeType?: string
): Promise<StoredAssetMetadata> => {
  const stats = await fs.stat(absolutePath);

  return {
    assetId,
    storageKind: 'local_file',
    logicalBucket,
    path: absolutePath,
    mimeType,
    sizeBytes: stats.size,
    originalName: path.basename(absolutePath),
  };
};

export const toLegacyJobReviewEnvelope = (
  reviewRecord: NonNullable<Awaited<ReturnType<typeof loadReview>>>
): ReviewResultEnvelope => ({
  rawPayload: reviewRecord,
  summary: `Legacy review snapshot with ${reviewRecord.annotations.length} annotation(s)`,
});

export const loadLegacyDomainReviewSnapshot = async (
  jobId: string
): Promise<{ review: Review; versions: ReviewVersion[] } | null> => {
  const reviewRecord = await loadReview(jobId);
  if (!reviewRecord) {
    return null;
  }

  const job = await getJob(jobId);
  const courseId = job?.inputs.courseId ?? 'legacy-course';
  const reviewVersionId = `${jobId}:legacy-version`;

  const review: Review = {
    reviewId: jobId,
    courseId,
    submissionId: jobId,
    state: 'ready_for_review',
    currentVersionId: reviewVersionId,
    createdAt: reviewRecord.createdAt,
    updatedAt: reviewRecord.updatedAt,
  };

  const reviewVersion: ReviewVersion = {
    reviewVersionId,
    reviewId: jobId,
    kind: reviewKindFromAnnotations(reviewRecord),
    resultEnvelope: toLegacyJobReviewEnvelope(reviewRecord),
    createdAt: reviewRecord.updatedAt,
  };

  return {
    review,
    versions: [reviewVersion],
  };
};

export const createLocalJobAssetStorageAdapter = (): AssetStoragePort => ({
  async registerAsset(asset) {
    return asset;
  },
  async resolveAsset(assetRef) {
    try {
      const absolutePath = path.isAbsolute(assetRef.path)
        ? assetRef.path
        : path.join(getDataDir(), assetRef.path);

      return await toStoredAssetMetadata(
        assetRef.assetId,
        assetRef.logicalBucket,
        absolutePath,
        assetRef.mimeType
      );
    } catch (error) {
      return null;
    }
  },
});

export const loadLegacyJobSubmissionAsset = async (
  jobId: string
): Promise<StoredAssetMetadata | null> => {
  const job = await getJob(jobId);
  if (!job) {
    return null;
  }

  return toStoredAssetMetadata(
    `job-submission:${jobId}`,
    'job_submissions',
    job.inputs.submissionFilePath,
    job.inputs.submissionMimeType
  );
};
