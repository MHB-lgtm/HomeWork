import * as fs from 'fs/promises';
import * as path from 'path';
import { ExamIndex, ExamIndexSchema } from '@hg/shared-schemas';

// Get data directory from environment variable
// Fail fast if missing (no fallbacks - HG_DATA_DIR must be set)
const getDataDir = (): string => {
  const dataDir = process.env.HG_DATA_DIR;
  if (!dataDir) {
    throw new Error('HG_DATA_DIR is not set in environment variables');
  }
  return path.resolve(dataDir);
};

// Initialize DATA_DIR once and log it
let DATA_DIR: string | null = null;
let DATA_DIR_LOGGED = false;

const getDataDirOnce = (): string => {
  if (!DATA_DIR) {
    DATA_DIR = getDataDir();
    if (!DATA_DIR_LOGGED) {
      console.log('[local-job-store] DATA_DIR:', DATA_DIR);
      DATA_DIR_LOGGED = true;
    }
  }
  return DATA_DIR;
};

/**
 * Get the file path for an exam index by examId
 */
export function getExamIndexPath(examId: string): string {
  return path.join(getDataDirOnce(), 'exams', examId, 'examIndex.json');
}

/**
 * Load an exam index by examId
 * @returns ExamIndex if found, null if not found
 */
export async function loadExamIndex(examId: string): Promise<ExamIndex | null> {
  const filePath = getExamIndexPath(examId);

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    return ExamIndexSchema.parse(parsed);
  } catch (error) {
    // File doesn't exist -> return null
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    // Other errors (parse, validation) -> rethrow
    throw error;
  }
}

/**
 * Get an existing exam index or return null (does NOT create one)
 * @returns ExamIndex if found, null if not found
 */
export async function getOrCreateExamIndex(examId: string): Promise<ExamIndex | null> {
  return loadExamIndex(examId);
}

/**
 * Save an exam index atomically (write to temp file, then rename)
 */
export async function saveExamIndex(examIndex: ExamIndex): Promise<void> {
  // Ensure exam directory exists
  const examDir = path.dirname(getExamIndexPath(examIndex.examId));
  await fs.mkdir(examDir, { recursive: true });

  const filePath = getExamIndexPath(examIndex.examId);
  const tempFilePath = `${filePath}.tmp`;

  // Validate the exam index before saving
  const validated = ExamIndexSchema.parse(examIndex);

  // Write to temp file first
  await fs.writeFile(tempFilePath, JSON.stringify(validated, null, 2), 'utf-8');

  // Atomically rename temp file to final file
  await fs.rename(tempFilePath, filePath);
}
