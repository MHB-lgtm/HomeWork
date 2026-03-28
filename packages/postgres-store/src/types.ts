export type LegacyJobStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';

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
    gradingMode?: 'RUBRIC' | 'GENERAL';
    gradingScope?: 'QUESTION' | 'DOCUMENT';
  };
  resultJson?: unknown;
  errorMessage?: string;
}

export interface ImportFileBackedOptions {
  dataDir?: string;
  dryRun?: boolean;
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
  importedLectureAssets: number;
  importedExams: number;
  importedRubrics: number;
  importedExamIndexes: number;
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
