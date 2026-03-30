import { describe, expect, it } from 'vitest';
import {
  assignmentDeadlineReached,
  assertCanTransitionAssignmentState,
  type Assignment,
} from '../src';

describe('assignment rules', () => {
  const assignment: Assignment = {
    assignmentId: 'assignment-1',
    courseId: 'course-1',
    weekId: 'week-1',
    title: 'Week 1',
    openAt: '2026-03-01T00:00:00.000Z',
    deadlineAt: '2026-03-10T00:00:00.000Z',
    materialIds: [],
    state: 'closed',
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
  };

  it('allows closed to processing after deadline', () => {
    expect(assignmentDeadlineReached(assignment, '2026-03-11T00:00:00.000Z')).toBe(true);
    expect(() =>
      assertCanTransitionAssignmentState('closed', 'processing', { deadlineReached: true })
    ).not.toThrow();
  });

  it('rejects closed to processing before deadline', () => {
    expect(() =>
      assertCanTransitionAssignmentState('closed', 'processing', { deadlineReached: false })
    ).toThrow(/Invalid assignment transition/);
  });
});
