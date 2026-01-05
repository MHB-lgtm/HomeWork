import * as fs from 'fs/promises';
import * as path from 'path';
import { RubricSpecSchema, RubricSpec } from '@hg/shared-schemas';

/**
 * Get the file path for a rubric
 */
export function getRubricPath(dataDir: string, examId: string, questionId: string): string {
  return path.join(dataDir, 'rubrics', examId, `${questionId}.json`);
}

/**
 * Error types for rubric loading
 */
export class RubricNotFoundError extends Error {
  constructor(examId: string, questionId: string) {
    super(`Rubric not found: ${examId}/${questionId}`);
    this.name = 'RubricNotFoundError';
  }
}

export class RubricValidationError extends Error {
  constructor(message: string) {
    super(`Rubric validation failed: ${message}`);
    this.name = 'RubricValidationError';
  }
}

export class RubricLoadError extends Error {
  constructor(message: string) {
    super(`Failed to load rubric: ${message}`);
    this.name = 'RubricLoadError';
  }
}

/**
 * Load and validate a rubric from the file system
 * @throws RubricNotFoundError if file doesn't exist
 * @throws RubricValidationError if validation fails
 * @throws RubricLoadError for other errors
 */
export async function loadRubric(
  dataDir: string,
  examId: string,
  questionId: string
): Promise<RubricSpec> {
  const rubricPath = getRubricPath(dataDir, examId, questionId);

  let content: string;
  try {
    content = await fs.readFile(rubricPath, 'utf-8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new RubricNotFoundError(examId, questionId);
    }
    throw new RubricLoadError(
      error instanceof Error ? error.message : String(error)
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new RubricLoadError(
      `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  try {
    return RubricSpecSchema.parse(parsed);
  } catch (error) {
    throw new RubricValidationError(
      error instanceof Error ? error.message : String(error)
    );
  }
}

