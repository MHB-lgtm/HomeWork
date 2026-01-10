import * as fs from 'fs/promises';
import * as path from 'path';
import { loadExamIndex } from '@hg/local-job-store';
import { ExamIndex } from '@hg/shared-schemas';
import { JobRecord } from '@hg/local-job-store';

/**
 * Resolve examId from job (with fallback for backward compatibility)
 */
export async function resolveExamId(job: JobRecord): Promise<string | null> {
  // Primary: use job.inputs.examId if present
  if (job.inputs.examId) {
    return job.inputs.examId;
  }

  // Fallback: try to infer examId by matching examFilePath to exams/<examId>/exam.json
  const dataDir = process.env.HG_DATA_DIR;
  if (!dataDir) {
    return null;
  }

  const examsDir = path.join(dataDir, 'exams');
  try {
    const examDirs = await fs.readdir(examsDir);
    for (const examDirName of examDirs) {
      const examMetadataPath = path.join(examsDir, examDirName, 'exam.json');
      try {
        const content = await fs.readFile(examMetadataPath, 'utf-8');
        const examMetadata = JSON.parse(content) as { examId: string; examFilePath: string };
        // Check if examFilePath matches (relative to DATA_DIR)
        const expectedPath = path.join(dataDir, examMetadata.examFilePath);
        if (path.resolve(expectedPath) === path.resolve(job.inputs.examFilePath)) {
          console.log(`[worker] Inferred examId=${examMetadata.examId} from examFilePath`);
          return examMetadata.examId;
        }
      } catch {
        // Skip invalid exam.json files
        continue;
      }
    }
  } catch {
    // Exams directory doesn't exist or can't be read
    return null;
  }

  return null;
}

/**
 * Load exam index for a given examId
 * Returns null if not found or invalid
 */
export async function loadExamIndexForWorker(examId: string): Promise<ExamIndex | null> {
  try {
    const examIndex = await loadExamIndex(examId);
    if (examIndex) {
      console.log(`[worker] Loaded examIndex for examId=${examId}: ${examIndex.questions.length} questions`);
    }
    return examIndex;
  } catch (error) {
    // If validation fails (e.g., missing promptText), return null
    // The caller will fallback to rubrics directory
    console.warn(`[worker] Failed to load examIndex for examId=${examId}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}
