import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Get data directory from environment variable
 */
function getDataDir(): string {
  const dataDir = process.env.HG_DATA_DIR;
  if (!dataDir) {
    throw new Error('HG_DATA_DIR is not set in environment variables');
  }
  return path.resolve(dataDir);
}

/**
 * List question IDs for an exam by reading rubric files from HG_DATA_DIR/rubrics/<examId>/
 * Returns sorted array of questionIds (filenames without .json extension)
 * Returns empty array if rubrics directory doesn't exist or is empty
 */
export async function listExamQuestionIds(examId: string): Promise<string[]> {
  try {
    const dataDir = getDataDir();
    const rubricsDir = path.join(dataDir, 'rubrics', examId);

    // Check if directory exists
    try {
      await fs.access(rubricsDir);
    } catch {
      // Directory doesn't exist - return empty array
      return [];
    }

    // Read directory contents
    const files = await fs.readdir(rubricsDir);

    // Filter for .json files and extract questionIds (filename without extension)
    const questionIds = files
      .filter((file) => file.endsWith('.json'))
      .map((file) => path.basename(file, '.json'))
      .sort(); // Sort alphabetically

    console.log(`[worker] Found ${questionIds.length} question IDs for exam ${examId}: ${questionIds.join(', ')}`);
    return questionIds;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`[worker] Failed to list question IDs for exam ${examId}: ${errorMessage}`);
    return [];
  }
}
