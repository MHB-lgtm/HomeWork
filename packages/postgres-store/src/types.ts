export type LegacyJobStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';
export type RuntimeJobKind = 'EXAM' | 'ASSIGNMENT';
export type RuntimeGradingMode = 'RUBRIC' | 'GENERAL';
export type RuntimeGradingScope = 'QUESTION' | 'DOCUMENT';
export type UserGlobalRoleValue = 'USER' | 'SUPER_ADMIN';
export type UserStatusValue = 'ACTIVE' | 'DISABLED';
export type CourseMembershipRoleValue = 'COURSE_ADMIN' | 'LECTURER' | 'STUDENT';
export type CourseMembershipStatusValue = 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'REMOVED';
export type OperationalSubmissionStatusValue =
  | 'SUBMITTED'
  | 'PROCESSING'
  | 'READY_FOR_REVIEW'
  | 'PUBLISHED'
  | 'FAILED';
export type StudentVisibleAssignmentStatusValue = 'OPEN' | 'SUBMITTED' | 'PUBLISHED';
export type PublishEligibilityValue = 'NOT_READY' | 'READY' | 'PUBLISHED';
export type StudentAssignmentSubmissionStateValue =
  | 'NOT_SUBMITTED'
  | 'SUBMITTED'
  | 'PUBLISHED';

export interface LegacyJobRecord {
  id: string;
  status?: LegacyJobStatus | string;
  createdAt?: string;
  updatedAt?: string;
  inputs?: {
    courseId?: string;
    examId?: string;
    questionId?: string;
    examFilePath?: string;
    submissionFilePath?: string;
    submissionMimeType?: string;
    questionFilePath?: string;
    notes?: string;
    gradingMode?: 'RUBRIC' | 'GENERAL';
    gradingScope?: 'QUESTION' | 'DOCUMENT';
  };
  rubric?: unknown;
  resultJson?: unknown;
  errorMessage?: string;
}

export interface RuntimeJobStatusRecord {
  jobId: string;
  status: LegacyJobStatus;
  resultJson?: unknown | null;
  errorMessage?: string | null;
  submissionMimeType?: string | null;
  gradingMode?: RuntimeGradingMode | null;
  gradingScope?: RuntimeGradingScope | null;
}

export interface RuntimeJobClaimRecord extends RuntimeJobStatusRecord {
  jobKind: RuntimeJobKind;
  courseId?: string | null;
  examId?: string | null;
  assignmentId?: string | null;
  questionId?: string | null;
  examFilePath?: string | null;
  promptFilePath?: string | null;
  referenceSolutionFilePath?: string | null;
  submissionFilePath: string;
  questionFilePath?: string | null;
  notes?: string | null;
  rubric?: import('@hg/shared-schemas').RubricSpec | null;
  claimedAt: string;
  leaseExpiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface RuntimeReviewSummaryRecord {
  jobId: string;
  displayName: string | null;
  status: LegacyJobStatus;
  operationalStatus: OperationalSubmissionStatusValue;
  examId?: string;
  questionId?: string | null;
  gradingMode?: RuntimeGradingMode | null;
  gradingScope?: RuntimeGradingScope | null;
  createdAt: string | null;
  updatedAt: string | null;
  annotationCount: number;
  hasResult: boolean;
  publication?: LegacyReviewPublicationRecord;
}

export interface RuntimeWorkerHeartbeatRecord {
  workerId: string;
  pid: number;
  hostname: string;
  startedAt: string;
  lastSeenAt: string;
}

export interface UserAuthAccessRecord {
  userId: string;
  normalizedEmail: string | null;
  displayName: string | null;
  globalRole: UserGlobalRoleValue;
  status: UserStatusValue;
  hasStaffAccess: boolean;
  hasStudentAccess: boolean;
}

export interface CourseAccessRecord {
  courseId: string;
  courseTitle: string;
  userId: string;
  role: CourseMembershipRoleValue;
  status: CourseMembershipStatusValue;
  isStaff: boolean;
}

export interface CourseMembershipRecord {
  membershipId: string;
  courseId: string;
  courseTitle: string;
  userId: string;
  normalizedEmail: string | null;
  displayName: string | null;
  role: CourseMembershipRoleValue;
  status: CourseMembershipStatusValue;
  joinedAt: string | null;
  invitedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StudentAssignmentStatusRecord {
  version: '1.0.0';
  assignmentId: string;
  courseId: string;
  courseTitle: string;
  assignmentTitle: string;
  openAt: string;
  deadlineAt: string;
  assignmentState: import('@hg/shared-schemas').Assignment['state'];
  visibleStatus: StudentVisibleAssignmentStatusValue;
  submissionState: StudentAssignmentSubmissionStateValue;
  submittedAt?: string | null;
  hasPublishedResult: boolean;
  publishedAt?: string | null;
  score?: number | null;
  maxScore?: number | null;
}

export interface StudentAssignmentResultRecord extends StudentAssignmentStatusRecord {
  publishedResultId?: string | null;
  summary?: string | null;
  breakdownSnapshot?: unknown | null;
}

export interface StaffReviewPublicationSummaryRecord {
  isPublished: boolean;
  publishedResultId?: string | null;
  publishedAt?: string | null;
  score?: number | null;
  maxScore?: number | null;
  summary?: string | null;
}

export interface StaffDashboardAssignmentRowRecord {
  version: '1.0.0';
  courseId: string;
  courseTitle: string;
  assignmentId: string;
  assignmentTitle: string;
  assignmentState: import('@hg/shared-schemas').Assignment['state'];
  openAt: string;
  deadlineAt: string;
  totalActiveStudents: number;
  notSubmittedCount: number;
  submittedCount: number;
  processingCount: number;
  readyForReviewCount: number;
  publishedCount: number;
  failedCount: number;
  publishableCount: number;
  republishNeededCount: number;
  latestActivityAt: string;
}

export interface AssignmentSubmissionOpsRowRecord {
  version: '1.0.0';
  courseId: string;
  assignmentId: string;
  submissionId: string;
  studentUserId: string;
  studentDisplayName: string | null;
  studentEmail: string | null;
  submittedAt: string;
  operationalStatus: OperationalSubmissionStatusValue;
  publishEligibility: PublishEligibilityValue;
  republishNeeded: boolean;
  jobId: string | null;
  reviewUpdatedAt?: string | null;
  publishedAt?: string | null;
  score?: number | null;
  maxScore?: number | null;
}

export interface AssignmentSubmissionOpsDetailRecord
  extends AssignmentSubmissionOpsRowRecord {
  courseTitle: string;
  assignmentTitle: string;
  reviewLink: string | null;
  submissionDownloadLink: string;
  publication?: StaffReviewPublicationSummaryRecord;
  rawStatuses: {
    assignmentState: import('@hg/shared-schemas').Assignment['state'];
    submissionState?: string | null;
    jobStatus?: string | null;
    reviewState?: string | null;
  };
}

export interface RollbackJobExportSummary {
  dataDir: string;
  requestedJobId: string | null;
  exportedJobs: number;
  exportedReviews: number;
  skippedJobs: number;
  exportedJobIds: string[];
  exportedReviewJobIds: string[];
  skippedJobIds: string[];
  warningCounts: Record<string, number>;
  warnings: string[];
}

export interface ImportFileBackedOptions {
  dataDir?: string;
  dryRun?: boolean;
  emitCompatFiles?: boolean;
  logger?: Pick<Console, 'log' | 'warn'>;
}

export interface LegacyExamRecord {
  examId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  examFilePath: string;
}

export interface LegacyReviewSummaryRecord {
  jobId: string;
  displayName: string | null;
  status?: string;
  operationalStatus?: OperationalSubmissionStatusValue;
  createdAt: string | null;
  updatedAt: string | null;
  annotationCount: number;
  hasResult: boolean;
  publication?: LegacyReviewPublicationRecord;
}

export interface LegacyReviewContextRecord {
  status?: string;
  operationalStatus?: OperationalSubmissionStatusValue;
  resultJson?: unknown;
  errorMessage?: string | null;
  submissionMimeType?: string | null;
  gradingMode?: 'RUBRIC' | 'GENERAL' | null;
  gradingScope?: 'QUESTION' | 'DOCUMENT' | null;
}

export interface LegacyReviewPublicationRecord {
  isPublished: boolean;
  publishedResultId?: string | null;
  publishedAt?: string | null;
  score?: number | null;
  maxScore?: number | null;
  summary?: string | null;
}

export interface LegacySubmissionAssetRecord {
  path: string;
  mimeType?: string | null;
}

export interface LegacyReviewDetailRecord {
  review: import('@hg/shared-schemas').ReviewRecord;
  context?: LegacyReviewContextRecord;
  publication?: LegacyReviewPublicationRecord;
  submissionAsset: LegacySubmissionAssetRecord | null;
}

export interface ImportFileBackedSummary {
  dryRun: boolean;
  importedCourses: number;
  importedLectures: number;
  importedLectureAssets: number;
  importedExams: number;
  importedRubrics: number;
  importedExamIndexes: number;
  importedJobsPending: number;
  importedJobsRunning: number;
  importedJobsDone: number;
  importedJobsFailed: number;
  importedSubmissions: number;
  importedReviews: number;
  importedPublishedResults: number;
  updatedRecords: number;
  skippedRecords: number;
  unresolvedRecords: number;
  failedRecords: number;
  warningCounts: Record<string, number>;
  warnings: string[];
  placeholderCourseDomainId: string;
}
