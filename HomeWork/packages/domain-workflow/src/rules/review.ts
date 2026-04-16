import type { ReviewState } from '../states';

const allowedReviewTransitions: Record<ReviewState, ReviewState[]> = {
  draft: ['ready_for_review'],
  ready_for_review: ['lecturer_edited', 'published'],
  lecturer_edited: ['published'],
  published: [],
};

export const canTransitionReviewState = (
  current: ReviewState,
  next: ReviewState
): boolean => allowedReviewTransitions[current].includes(next);

export const assertCanTransitionReviewState = (
  current: ReviewState,
  next: ReviewState
): void => {
  if (!canTransitionReviewState(current, next)) {
    throw new Error(`Invalid review transition: ${current} -> ${next}`);
  }
};
