import * as path from 'path';
import type { ReviewRecord } from '@hg/shared-schemas';
import type { LegacyJobRecord } from '../types';

export const PLACEHOLDER_COURSE_DOMAIN_ID = 'legacy-course:placeholder';
export const PLACEHOLDER_COURSE_LEGACY_KEY = 'legacy-course';

export const getCourseDomainIdForLegacyJob = (courseId?: string): string =>
  courseId?.trim() || PLACEHOLDER_COURSE_DOMAIN_ID;

export const getSubmissionDomainId = (jobId: string): string => `legacy-submission:${jobId}`;
export const getReviewDomainId = (jobId: string): string => `legacy-review:${jobId}`;
export const getImportedReviewVersionDomainId = (jobId: string): string =>
  `legacy-review-version:${jobId}:imported`;
export const getSavedReviewVersionDomainId = (jobId: string, nonce: string): string =>
  `legacy-review-version:${jobId}:${nonce}`;
export const getPublishedResultDomainId = (jobId: string): string =>
  `legacy-published-result:${jobId}`;
export const getGradebookEntryDomainId = (jobId: string): string =>
  `legacy-gradebook-entry:${jobId}`;
export const getSubmissionMaterialDomainId = (jobId: string): string =>
  `legacy-submission-material:${jobId}`;
export const getLectureMaterialDomainId = (courseId: string, lectureId: string): string =>
  `legacy-lecture-material:${courseId}:${lectureId}`;
export const getSubmissionAssetKey = (jobId: string): string => `job-submission:${jobId}`;
export const getExamAssetKey = (examId: string): string => `exam-asset:${examId}`;
export const getLectureAssetKey = (courseId: string, lectureId: string): string =>
  `lecture-asset:${courseId}:${lectureId}`;

export const parseLegacyJobRecord = (raw: unknown): LegacyJobRecord | null => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return null;
  }

  const record = raw as Record<string, unknown>;
  if (typeof record.id !== 'string') {
    return null;
  }

  const inputs =
    typeof record.inputs === 'object' && record.inputs !== null && !Array.isArray(record.inputs)
      ? (record.inputs as LegacyJobRecord['inputs'])
      : undefined;

  return {
    id: record.id,
    status: typeof record.status === 'string' ? record.status : undefined,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : undefined,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : undefined,
    inputs,
    rubric: record.rubric,
    resultJson: record.resultJson,
    errorMessage: typeof record.errorMessage === 'string' ? record.errorMessage : undefined,
  };
};

export const resolveStoredPath = (dataDir: string, assetPath: string): string =>
  path.isAbsolute(assetPath) ? assetPath : path.resolve(dataDir, assetPath);

export const deriveSubmissionStateFromLegacy = (
  job: LegacyJobRecord,
  reviewRecord: ReviewRecord | null,
  hasPublishedResult: boolean
): 'uploaded' | 'queued' | 'processed' | 'lecturer_edited' | 'published' => {
  if (hasPublishedResult) {
    return 'published';
  }

  if (reviewRecord?.annotations.some((annotation) => annotation.createdBy === 'human')) {
    return 'lecturer_edited';
  }

  if (job.resultJson || reviewRecord) {
    return 'processed';
  }

  if (job.status === 'PENDING' || job.status === 'RUNNING') {
    return 'queued';
  }

  return 'uploaded';
};

export const deriveReviewStateFromLegacy = (
  reviewRecord: ReviewRecord,
  hasPublishedResult: boolean
): 'ready_for_review' | 'lecturer_edited' | 'published' => {
  if (hasPublishedResult) {
    return 'published';
  }

  return reviewRecord.annotations.some((annotation) => annotation.createdBy === 'human')
    ? 'lecturer_edited'
    : 'ready_for_review';
};
