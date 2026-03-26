export type {
  StudentRef,
  ActorRef,
  AssignmentModuleRef,
  ExamBatchModuleRef,
  ModuleRef,
  AssetStorageKind,
  AssetRef,
} from './refs';

export {
  asStudentRef,
  asActorRef,
  createAssignmentModuleRef,
  createExamBatchModuleRef,
  getModuleRefId,
  getModuleRefKey,
  isSameModuleRef,
} from './refs';

export type {
  CourseStatus,
  AssignmentState,
  SubmissionState,
  ReviewState,
  ReviewVersionKind,
  PublishedResultStatus,
  GradebookEntryStatus,
  ExamBatchState,
  FlagSource,
  FlagSeverity,
  FlagState,
} from './states';

export type { ReviewResultFlag, ReviewResultEnvelope } from './result-envelope';
export {
  hasPublishableCoreFields,
  assertPublishableResultEnvelope,
} from './result-envelope';

export type { StoredAssetMetadata, AssetStoragePort } from './storage';

export type {
  CourseId,
  WeekId,
  CourseMaterialId,
  CourseMaterialKind,
  Course,
  Week,
  CourseMaterial,
} from './entities/course';

export type { AssignmentId, Assignment } from './entities/assignment';
export type { SubmissionId, Submission } from './entities/submission';
export type { ReviewId, ReviewVersionId, Review, ReviewVersion } from './entities/review';
export type {
  PublishedResultId,
  GradebookEntryId,
  PublishedResult,
  GradebookEntry,
} from './entities/publication';
export type { ExamBatchId, ExamBatch } from './entities/exam-batch';
export type { FlagId, FlagScopeType, Flag } from './entities/flag';
export type { AuditEventId, AuditAggregateType, AuditEvent } from './entities/audit';

export type {
  CourseRepository,
  WeekRepository,
  MaterialRepository,
  AssignmentRepository,
  SubmissionRepository,
  ReviewRepository,
  PublicationRepository,
  ExamBatchRepository,
  FlagRepository,
  AuditRepository,
  AssetStorageRepository,
} from './repositories';

export {
  canTransitionAssignmentState,
  assertCanTransitionAssignmentState,
  assignmentDeadlineReached,
} from './rules/assignment';

export {
  canTransitionSubmissionState,
  assertCanTransitionSubmissionState,
  getLatestEffectiveSubmission,
  getSupersededSubmissionIds,
} from './rules/submission';

export {
  canTransitionReviewState,
  assertCanTransitionReviewState,
} from './rules/review';

export {
  assertCanPublishResultEnvelope,
  assertPublishedResultModuleMatch,
  getEffectivePublishedResult,
  getSupersededPublishedResultIds,
  createPublishedSnapshotResultEnvelope,
} from './rules/publication';

export {
  canTransitionExamBatchState,
  assertCanTransitionExamBatchState,
} from './rules/exam-batch';

export {
  canTransitionFlagState,
  assertCanTransitionFlagState,
} from './rules/flag';

export { projectGradebookEntry } from './projections/gradebook';

export { AssignmentWorkflowService } from './services/assignment-workflow';
export { ReviewWorkflowService } from './services/review-workflow';
export { PublicationService } from './services/publication';
export { ExamBatchWorkflowService } from './services/exam-batch-workflow';
export { FlagService } from './services/flag';
