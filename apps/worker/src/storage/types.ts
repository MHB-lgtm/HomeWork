export type JobStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';

export type JobRecord = {
  id: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  inputs: {
    questionFilePath: string;
    submissionFilePath: string;
    notes?: string;
    questionText?: string;
    referenceSolutionText?: string;
  };
  versions: {
    prompt_version: string;
    rubric_version: string;
    model_version: string;
  };
  resultJson?: unknown;
  errorMessage?: string;
};

