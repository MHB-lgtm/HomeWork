import { getWorkerRuntimePersistence } from '../lib/runtimePersistence';

/**
 * List question IDs for an exam from the DB-backed exam index payload.
 * Returns question ids ordered by the stored question order.
 */
export async function listExamQuestionIds(examId: string): Promise<string[]> {
  try {
    const persistence = getWorkerRuntimePersistence();
    const examIndex = await persistence.examIndexes.getExamIndex(examId);
    if (!examIndex) {
      return [];
    }

    const questionIds = [...examIndex.questions]
      .sort((a, b) => a.order - b.order)
      .map((question) => question.id);

    console.log(`[worker] Found ${questionIds.length} question IDs for exam ${examId}: ${questionIds.join(', ')}`);
    return questionIds;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`[worker] Failed to list question IDs for exam ${examId}: ${errorMessage}`);
    return [];
  }
}
