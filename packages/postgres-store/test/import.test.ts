import { describe, expect, it } from 'vitest';
import type { ReviewRecord } from '@hg/shared-schemas';
import {
  PLACEHOLDER_COURSE_DOMAIN_ID,
} from '../src';
import {
  deriveReviewStateFromLegacy,
  deriveSubmissionStateFromLegacy,
  getCourseDomainIdForLegacyJob,
  getGradebookEntryDomainId,
  getImportedReviewVersionDomainId,
  getPublishedResultDomainId,
  getSubmissionDomainId,
} from '../src/mappers/import';

const aiReview: ReviewRecord = {
  version: '1.0.0',
  jobId: 'job-1',
  createdAt: '2026-03-26T10:00:00.000Z',
  updatedAt: '2026-03-26T10:05:00.000Z',
  annotations: [],
};

const humanReview: ReviewRecord = {
  ...aiReview,
  annotations: [
    {
      id: 'a1',
      criterionId: 'c1',
      pageIndex: 0,
      bboxNorm: { x: 0, y: 0, w: 0.2, h: 0.2 },
      createdBy: 'human',
      status: 'confirmed',
      createdAt: aiReview.createdAt,
      updatedAt: aiReview.updatedAt,
    },
  ],
};

describe('legacy import helpers', () => {
  it('uses a placeholder course when legacy jobs have no courseId', () => {
    expect(getCourseDomainIdForLegacyJob()).toBe(PLACEHOLDER_COURSE_DOMAIN_ID);
  });

  it('produces deterministic natural keys for reruns', () => {
    expect(getSubmissionDomainId('job-123')).toBe('legacy-submission:job-123');
    expect(getImportedReviewVersionDomainId('job-123')).toBe('legacy-review-version:job-123:imported');
    expect(getPublishedResultDomainId('job-123')).toBe('legacy-published-result:job-123');
    expect(getGradebookEntryDomainId('job-123')).toBe('legacy-gradebook-entry:job-123');
  });

  it('derives imported states from available legacy data', () => {
    expect(
      deriveSubmissionStateFromLegacy(
        { id: 'job-1', status: 'DONE', resultJson: { mode: 'RUBRIC' } },
        aiReview,
        true
      )
    ).toBe('published');
    expect(
      deriveSubmissionStateFromLegacy(
        { id: 'job-1', status: 'DONE' },
        humanReview,
        false
      )
    ).toBe('lecturer_edited');
    expect(deriveReviewStateFromLegacy(aiReview, false)).toBe('ready_for_review');
    expect(deriveReviewStateFromLegacy(humanReview, false)).toBe('lecturer_edited');
  });
});
