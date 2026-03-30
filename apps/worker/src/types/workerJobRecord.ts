import type { RubricSpec } from '@hg/shared-schemas';

export type WorkerJobStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';

export type WorkerJobRecord = {
  id: string;
  status: WorkerJobStatus;
  createdAt: string;
  updatedAt: string;
  inputs: {
    jobKind?: 'EXAM' | 'ASSIGNMENT';
    courseId?: string;
    examId?: string;
    assignmentId?: string;
    examFilePath: string;
    promptFilePath?: string;
    referenceSolutionFilePath?: string;
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
