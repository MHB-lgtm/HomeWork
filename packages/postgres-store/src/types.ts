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
  logger?: Pick<Console, 'log' | 'warn'>;
}

export interface ImportFileBackedSummary {
  importedCourses: number;
  importedLectureAssets: number;
  importedSubmissions: number;
  importedReviews: number;
  importedPublishedResults: number;
  warnings: string[];
  placeholderCourseDomainId: string;
}
