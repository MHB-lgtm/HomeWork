import type { ExamBatch } from '../entities/exam-batch';
import { assertCanTransitionExamBatchState } from '../rules/exam-batch';

export class ExamBatchWorkflowService {
  transitionExamBatch(
    examBatch: ExamBatch,
    nextState: ExamBatch['state'],
    nowIso: string
  ): ExamBatch {
    assertCanTransitionExamBatchState(examBatch.state, nextState);

    return {
      ...examBatch,
      state: nextState,
      updatedAt: nowIso,
      exportedAt: nextState === 'exported' ? nowIso : examBatch.exportedAt,
    };
  }
}
