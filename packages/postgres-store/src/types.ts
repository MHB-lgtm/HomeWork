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
  };
  resultJson?: unknown;
  errorMessage?: string;
}

export interface ImportFileBackedOptions {
  dataDir?: string;
  dryRun?: boolean;
  logger?: Pick<Console, 'log' | 'warn'>;
}

export interface LegacyReviewSummaryRecord {
  jobId: string;
  displayName: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  annotationCount: number;
  hasResult: boolean;
}

export interface ImportFileBackedSummary {
  dryRun: boolean;
  importedCourses: number;
  importedLectureAssets: number;
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
