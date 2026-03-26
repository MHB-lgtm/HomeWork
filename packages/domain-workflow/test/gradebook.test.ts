import { describe, expect, it } from 'vitest';
import { createAssignmentModuleRef, projectGradebookEntry, type PublishedResult } from '../src';

describe('gradebook projection', () => {
  it('projects only from effective published results', () => {
    const publishedResult: PublishedResult = {
      publishedResultId: 'published-1',
      courseId: 'course-1',
      submissionId: 'submission-1',
      studentRef: 'student-1',
      moduleRef: createAssignmentModuleRef('assignment-1'),
      reviewId: 'review-1',
      sourceReviewVersionId: 'review-version-1',
      publishedAt: '2026-03-01T00:00:00.000Z',
      status: 'effective',
      finalScore: 95,
      maxScore: 100,
      summary: 'Great work',
      breakdownSnapshot: { q1: 95 },
    };

    const gradebookEntry = projectGradebookEntry(publishedResult);

    expect(gradebookEntry.publishedResultId).toBe('published-1');
    expect(gradebookEntry.status).toBe('effective');
    expect(gradebookEntry.score).toBe(95);
  });

  it('rejects superseded published results', () => {
    const publishedResult: PublishedResult = {
      publishedResultId: 'published-2',
      courseId: 'course-1',
      submissionId: 'submission-1',
      studentRef: 'student-1',
      moduleRef: createAssignmentModuleRef('assignment-1'),
      reviewId: 'review-1',
      sourceReviewVersionId: 'review-version-1',
      publishedAt: '2026-03-01T00:00:00.000Z',
      status: 'superseded',
      finalScore: 95,
      maxScore: 100,
      summary: 'Old result',
      breakdownSnapshot: { q1: 95 },
    };

    expect(() => projectGradebookEntry(publishedResult)).toThrow(/effective PublishedResult/);
  });
});
