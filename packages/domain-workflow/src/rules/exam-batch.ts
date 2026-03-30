import type { ExamBatchState } from '../states';

const allowedExamBatchTransitions: Record<ExamBatchState, ExamBatchState[]> = {
  uploaded: ['processing'],
  processing: ['reviewed'],
  reviewed: ['exported'],
  exported: [],
};

export const canTransitionExamBatchState = (
  current: ExamBatchState,
  next: ExamBatchState
): boolean => allowedExamBatchTransitions[current].includes(next);

export const assertCanTransitionExamBatchState = (
  current: ExamBatchState,
  next: ExamBatchState
): void => {
  if (!canTransitionExamBatchState(current, next)) {
    throw new Error(`Invalid exam batch transition: ${current} -> ${next}`);
  }
};
