import { RubricSpec } from '@hg/shared-schemas';

export type JobStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';

export type JobRecord = {
  id: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  inputs: {
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

