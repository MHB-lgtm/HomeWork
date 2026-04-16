import type { FlagState } from '../states';

const allowedFlagTransitions: Record<FlagState, FlagState[]> = {
  open: ['resolved', 'dismissed'],
  resolved: [],
  dismissed: [],
};

export const canTransitionFlagState = (
  current: FlagState,
  next: FlagState
): boolean => allowedFlagTransitions[current].includes(next);

export const assertCanTransitionFlagState = (
  current: FlagState,
  next: FlagState
): void => {
  if (!canTransitionFlagState(current, next)) {
    throw new Error(`Invalid flag transition: ${current} -> ${next}`);
  }
};
