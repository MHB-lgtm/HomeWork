import type { AuditEvent } from './entities/audit';
import type { Assignment, AssignmentId } from './entities/assignment';
import type { Course, CourseId, CourseMaterial, CourseMaterialId, Week, WeekId } from './entities/course';
import type { ExamBatch, ExamBatchId } from './entities/exam-batch';
import type { Flag, FlagId, FlagScopeType } from './entities/flag';
import type { GradebookEntry, PublishedResult, PublishedResultId } from './entities/publication';
import type { Review, ReviewId, ReviewVersion } from './entities/review';
import type { Submission, SubmissionId } from './entities/submission';
import type { AssetRef } from './refs';
import type { StoredAssetMetadata } from './storage';

export interface CourseRepository {
  getCourse(courseId: CourseId): Promise<Course | null>;
  listCourses(): Promise<Course[]>;
}

export interface WeekRepository {
  getWeek(weekId: WeekId): Promise<Week | null>;
  listWeeksByCourse(courseId: CourseId): Promise<Week[]>;
  saveWeek(week: Week): Promise<void>;
}

export interface MaterialRepository {
  getMaterial(materialId: CourseMaterialId): Promise<CourseMaterial | null>;
  listMaterialsByCourse(courseId: CourseId): Promise<CourseMaterial[]>;
}

export interface AssignmentRepository {
  getAssignment(assignmentId: AssignmentId): Promise<Assignment | null>;
  listAssignmentsByCourse(courseId: CourseId): Promise<Assignment[]>;
  saveAssignment(assignment: Assignment): Promise<void>;
}

export interface SubmissionRepository {
  getSubmission(submissionId: SubmissionId): Promise<Submission | null>;
  listSubmissionsForStudentModule(studentRef: string, moduleRefKey: string): Promise<Submission[]>;
  saveSubmission(submission: Submission): Promise<void>;
  markSuperseded(submissionId: SubmissionId): Promise<void>;
}

export interface ReviewRepository {
  getReview(reviewId: ReviewId): Promise<Review | null>;
  getReviewBySubmissionId(submissionId: SubmissionId): Promise<Review | null>;
  saveReview(review: Review): Promise<void>;
  appendReviewVersion(reviewVersion: ReviewVersion): Promise<void>;
  listReviewVersions(reviewId: ReviewId): Promise<ReviewVersion[]>;
  setCurrentReviewVersion(reviewId: ReviewId, reviewVersionId: string): Promise<void>;
}

export interface PublicationRepository {
  getPublishedResultsBySubmission(submissionId: SubmissionId): Promise<PublishedResult[]>;
  savePublishedResult(publishedResult: PublishedResult): Promise<void>;
  markPublishedResultsSupersededForSubmission(submissionId: SubmissionId): Promise<void>;
  upsertGradebookEntry(entry: GradebookEntry): Promise<void>;
  getGradebookEntryByPublishedResultId(
    publishedResultId: PublishedResultId
  ): Promise<GradebookEntry | null>;
}

export interface ExamBatchRepository {
  getExamBatch(examBatchId: ExamBatchId): Promise<ExamBatch | null>;
  listExamBatchesByCourse(courseId: CourseId): Promise<ExamBatch[]>;
  saveExamBatch(examBatch: ExamBatch): Promise<void>;
}

export interface FlagRepository {
  getFlag(flagId: FlagId): Promise<Flag | null>;
  listFlagsByScope(scopeType: FlagScopeType, scopeId: string): Promise<Flag[]>;
  saveFlag(flag: Flag): Promise<void>;
}

export interface AuditRepository {
  appendAuditEvents(events: AuditEvent[]): Promise<void>;
  listAuditEvents(aggregateType: AuditEvent['aggregateType'], aggregateId: string): Promise<AuditEvent[]>;
}

export interface AssetStorageRepository {
  registerAsset(asset: StoredAssetMetadata): Promise<StoredAssetMetadata>;
  resolveAsset(assetRef: AssetRef): Promise<StoredAssetMetadata | null>;
}
