export { getPrismaClient, disconnectPrismaClient } from './client';
export type {
  ImportFileBackedOptions,
  ImportFileBackedSummary,
  LegacyExamRecord,
  LegacyReviewContextRecord,
  LegacyReviewDetailRecord,
  LegacyJobRecord,
  LegacyReviewPublicationRecord,
  LegacySubmissionAssetRecord,
  LegacyReviewSummaryRecord,
} from './types';
export { PrismaCourseRepository } from './repos/course-repository';
export { PrismaMaterialRepository } from './repos/material-repository';
export { PrismaSubmissionRepository } from './repos/submission-repository';
export { PrismaReviewRepository } from './repos/review-repository';
export { PrismaPublicationRepository } from './repos/publication-repository';
export { PrismaLegacyReviewRecordStore } from './queries/review-records';
export { PrismaCourseStore } from './queries/course-store';
export { PrismaExamStore } from './queries/exam-store';
export { PrismaRubricStore } from './queries/rubric-store';
export { PrismaExamIndexStore } from './queries/exam-index-store';
export {
  PrismaLectureStore,
  CourseNotFoundError as PostgresCourseNotFoundError,
  LectureNotFoundError as PostgresLectureNotFoundError,
  UnsupportedLectureTypeError as PostgresUnsupportedLectureTypeError,
} from './queries/lecture-store';
export { LegacyReviewPublicationConflictError } from './queries/review-records';
export { importFileBackedData } from './import-file-backed';
export {
  PLACEHOLDER_COURSE_DOMAIN_ID,
  PLACEHOLDER_COURSE_LEGACY_KEY,
  getExamAssetKey,
  parseLegacyJobRecord,
} from './mappers/import';
export {
  normalizeLegacyJobResultEnvelope,
  createStoredReviewRecordPayload,
  reviewContextFromStoredPayload,
  reviewRecordFromStoredPayload,
  createLegacyReviewResultEnvelope,
} from './mappers/review-record';
export {
  CompatibilityMaterializationError,
  materializeCourseCompatibility,
  materializeLectureCompatibility,
  materializeExamCompatibility,
  materializeRubricCompatibility,
  materializeExamIndexCompatibility,
} from './compat/file-materialization';
