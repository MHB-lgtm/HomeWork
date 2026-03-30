export type LegacyJobStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';
export type RuntimeJobKind = 'EXAM' | 'ASSIGNMENT';
export type RuntimeGradingMode = 'RUBRIC' | 'GENERAL';
export type RuntimeGradingScope = 'QUESTION' | 'DOCUMENT';
export type UserGlobalRoleValue = 'USER' | 'SUPER_ADMIN';
export type UserStatusValue = 'ACTIVE' | 'DISABLED';
export type CourseMembershipRoleValue = 'COURSE_ADMIN' | 'LECTURER' | 'STUDENT';
export type CourseMembershipStatusValue = 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'REMOVED';

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
  createdAt: string | null;
  updatedAt: string | null;
  annotationCount: number;
  hasResult: boolean;
  publication?: LegacyReviewPublicationRecord;
}

export interface LegacyReviewContextRecord {
  status?: string;
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
