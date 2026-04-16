import { ExamIndex } from '@hg/shared-schemas';
import { getWorkerRuntimePersistence } from '../lib/runtimePersistence';
import type { WorkerJobRecord } from '../types/workerJobRecord';

/**
 * Resolve examId from the runtime job payload.
 */
export async function resolveExamId(job: WorkerJobRecord): Promise<string | null> {
  return job.inputs.examId ?? null;
}

/**
 * Load exam index for a given examId
 * Returns null if not found or invalid
 */
export async function loadExamIndexForWorker(examId: string): Promise<ExamIndex | null> {
  try {
    const persistence = getWorkerRuntimePersistence();
    const examIndex = await persistence.examIndexes.getExamIndex(examId);
    if (examIndex) {
      console.log(`[worker] Loaded examIndex for examId=${examId}: ${examIndex.questions.length} questions`);
    }
    return examIndex;
  } catch (error) {
    console.warn(`[worker] Failed to load examIndex for examId=${examId}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}
