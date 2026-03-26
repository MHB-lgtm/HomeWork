import type { Assignment } from '../entities/assignment';
import type { AssignmentState } from '../states';

const allowedAssignmentTransitions: Record<AssignmentState, AssignmentState[]> = {
  draft: ['open'],
  open: ['closed'],
  closed: ['processing'],
  processing: ['reviewed'],
  reviewed: ['published'],
  published: [],
};

export const canTransitionAssignmentState = (
  current: AssignmentState,
  next: AssignmentState,
  options?: { deadlineReached?: boolean }
): boolean => {
  if (!allowedAssignmentTransitions[current].includes(next)) {
    return false;
  }

  if (current === 'open' && next === 'processing') {
    return false;
  }

  if (current === 'closed' && next === 'processing' && options?.deadlineReached === false) {
    return false;
  }

  return true;
};

export const assertCanTransitionAssignmentState = (
  current: AssignmentState,
  next: AssignmentState,
  options?: { deadlineReached?: boolean }
): void => {
  if (!canTransitionAssignmentState(current, next, options)) {
    throw new Error(`Invalid assignment transition: ${current} -> ${next}`);
  }
};

export const assignmentDeadlineReached = (assignment: Assignment, nowIso: string): boolean =>
  Date.parse(nowIso) >= Date.parse(assignment.deadlineAt);
