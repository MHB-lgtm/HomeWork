/**
 * Error codes for rubric validation failures
 */
export enum RubricValidationErrorCode {
  EXAM_ID_MISMATCH = 'EXAM_ID_MISMATCH',
  QUESTION_ID_MISMATCH = 'QUESTION_ID_MISMATCH',
  MISSING_CRITERIA = 'MISSING_CRITERIA',
  EXTRA_CRITERIA = 'EXTRA_CRITERIA',
  DUPLICATE_CRITERIA = 'DUPLICATE_CRITERIA',
  INVALID_SCORE_RANGE = 'INVALID_SCORE_RANGE',
  INVALID_BINARY_SCORE = 'INVALID_BINARY_SCORE',
}

/**
 * Custom error for rubric validation failures
 */
export class RubricValidationError extends Error {
  constructor(
    public code: RubricValidationErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'RubricValidationError';
  }
}

