export { getPrismaClient, disconnectPrismaClient } from './client';
export type {
  CourseAccessRecord,
  CourseMembershipRecord,
  CourseMembershipRoleValue,
  CourseMembershipStatusValue,
  ImportFileBackedOptions,
  ImportFileBackedSummary,
  LegacyExamRecord,
  LegacyJobStatus,
  LegacyReviewContextRecord,
  LegacyReviewDetailRecord,
  LegacyJobRecord,
  LegacyReviewPublicationRecord,
  StudentAssignmentResultRecord,
  StudentAssignmentStatusRecord,
  StudentAssignmentSubmissionStateValue,
  RuntimeGradingMode,
  RuntimeGradingScope,
  RuntimeJobClaimRecord,
  RuntimeJobStatusRecord,
  RuntimeReviewSummaryRecord,
  RuntimeWorkerHeartbeatRecord,
  RollbackJobExportSummary,
  UserAuthAccessRecord,
  LegacySubmissionAssetRecord,
  LegacyReviewSummaryRecord,
} from './types';
export { PrismaCourseRepository } from './repos/course-repository';
export { PrismaMaterialRepository } from './repos/material-repository';
export { PrismaSubmissionRepository } from './repos/submission-repository';
export { PrismaReviewRepository } from './repos/review-repository';
export { PrismaPublicationRepository } from './repos/publication-repository';
export { PrismaLegacyReviewRecordStore } from './queries/review-records';
export { PrismaJobStore } from './queries/job-store';
export { PrismaWorkerHeartbeatStore } from './queries/worker-heartbeat-store';
export {
  DEVELOPMENT_DEMO_SIGN_IN_OPTIONS,
  PrismaUserAuthStore,
} from './queries/user-auth-store';
export type { DevelopmentDemoAccountId } from './queries/user-auth-store';
export {
  PrismaCourseMembershipStore,
  CourseMembershipCourseNotFoundError,
  CourseMembershipCourseNotFoundError as PostgresCourseMembershipCourseNotFoundError,
} from './queries/course-membership-store';
export { PrismaCourseStore } from './queries/course-store';
export {
  PrismaAssignmentStore,
  AssignmentCourseNotFoundError,
  AssignmentCourseNotFoundError as PostgresAssignmentCourseNotFoundError,
  AssignmentNotFoundError,
  AssignmentNotFoundError as PostgresAssignmentNotFoundError,
} from './queries/assignment-store';
export { PrismaStudentResultsStore } from './queries/student-results-store';
export { PrismaExamStore } from './queries/exam-store';
export { PrismaRubricStore } from './queries/rubric-store';
export { PrismaExamIndexStore } from './queries/exam-index-store';
export {
  PrismaCourseRagStore,
  CourseNotFoundError as PostgresCourseRagCourseNotFoundError,
  IndexNotBuiltError as PostgresCourseRagIndexNotBuiltError,
} from './queries/course-rag-store';
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
export { exportRuntimeJobsToLegacyQueue } from './compat/rollback-export';
