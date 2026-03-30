import { describe, expect, it } from 'vitest';
import {
  assertCanPublishResultEnvelope,
  createAssignmentModuleRef,
  createPublishedSnapshotResultEnvelope,
  getEffectivePublishedResult,
  type PublishedResult,
  type ReviewVersion,
} from '../src';

describe('publication rules', () => {
  it('requires score, maxScore, and summary', () => {
    expect(() =>
      assertCanPublishResultEnvelope({
        rawPayload: {},
      })
    ).toThrow(/not publishable/);
  });

  it('creates a publishable snapshot envelope from a review version', () => {
    const reviewVersion: ReviewVersion = {
      reviewVersionId: 'review-version-1',
      reviewId: 'review-1',
      kind: 'lecturer_edit',
      createdAt: '2026-03-01T00:00:00.000Z',
      resultEnvelope: {
        rawPayload: { any: 'shape' },
        score: 91,
        maxScore: 100,
        summary: 'Published summary',
        questionBreakdown: { q1: 50 },
      },
    };

    expect(createPublishedSnapshotResultEnvelope(reviewVersion)).toEqual({
      rawPayload: { any: 'shape' },
      score: 91,
      maxScore: 100,
      summary: 'Published summary',
      questionBreakdown: { q1: 50 },
      flags: undefined,
    });
  });

  it('selects the latest effective published result for a submission', () => {
    const moduleRef = createAssignmentModuleRef('assignment-1');
    const results: PublishedResult[] = [
      {
        publishedResultId: 'published-1',
        courseId: 'course-1',
        submissionId: 'submission-1',
        studentRef: 'student-1',
        moduleRef,
        reviewId: 'review-1',
        sourceReviewVersionId: 'review-version-1',
        publishedAt: '2026-03-01T00:00:00.000Z',
        status: 'superseded',
        finalScore: 80,
        maxScore: 100,
        summary: 'Old',
        breakdownSnapshot: {},
      },
      {
        publishedResultId: 'published-2',
        courseId: 'course-1',
        submissionId: 'submission-1',
        studentRef: 'student-1',
        moduleRef,
        reviewId: 'review-1',
        sourceReviewVersionId: 'review-version-2',
        publishedAt: '2026-03-02T00:00:00.000Z',
        status: 'effective',
        finalScore: 90,
        maxScore: 100,
        summary: 'New',
        breakdownSnapshot: {},
      },
    ];

    expect(getEffectivePublishedResult(results, 'submission-1')?.publishedResultId).toBe('published-2');
  });
});
