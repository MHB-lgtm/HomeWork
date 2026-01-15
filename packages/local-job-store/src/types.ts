import { RubricSpec } from '@hg/shared-schemas';

export type JobStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';

export type JobRecord = {
  id: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  inputs: {
    courseId?: string; // Optional Course Assistant context
    examId?: string; // Required going forward; optional for backward compatibility
    examFilePath: string;
    questionId: string;
    submissionFilePath: string;
    submissionMimeType?: string;
    questionFilePath?: string;
    notes?: string;
    questionText?: string;
    referenceSolutionText?: string;
    gradingMode?: 'RUBRIC' | 'GENERAL';
    gradingScope?: 'QUESTION' | 'DOCUMENT';
  };
  versions: {
    prompt_version: string;
    rubric_version: string;
    model_version: string;
  };
  rubric?: RubricSpec;
  resultJson?: unknown;
  errorMessage?: string;
};

