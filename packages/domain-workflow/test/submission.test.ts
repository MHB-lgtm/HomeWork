import { describe, expect, it } from 'vitest';
import {
  createAssignmentModuleRef,
  getLatestEffectiveSubmission,
  getSupersededSubmissionIds,
  type Submission,
} from '../src';

describe('submission rules', () => {
  const moduleRef = createAssignmentModuleRef('assignment-1');
  const submissions: Submission[] = [
    {
      submissionId: 'submission-1',
      courseId: 'course-1',
      moduleRef,
      studentRef: 'student-1',
      materialId: 'material-1',
      submittedAt: '2026-03-01T00:00:00.000Z',
      state: 'uploaded',
    },
    {
      submissionId: 'submission-2',
      courseId: 'course-1',
      moduleRef,
      studentRef: 'student-1',
      materialId: 'material-2',
      submittedAt: '2026-03-02T00:00:00.000Z',
      state: 'uploaded',
    },
  ];

  it('selects the latest effective submission', () => {
    const latest = getLatestEffectiveSubmission(
      submissions,
      'student-1',
      'assignment:assignment-1'
    );

    expect(latest?.submissionId).toBe('submission-2');
  });

  it('returns older submissions as superseded candidates', () => {
    expect(
      getSupersededSubmissionIds(submissions, 'student-1', 'assignment:assignment-1')
    ).toEqual(['submission-1']);
  });
});
