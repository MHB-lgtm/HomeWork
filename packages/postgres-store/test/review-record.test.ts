import { describe, expect, it } from 'vitest';
import type { ReviewRecord } from '@hg/shared-schemas';
import {
  createLegacyReviewResultEnvelope,
  normalizeLegacyJobResultEnvelope,
  reviewRecordFromStoredPayload,
} from '../src';

const baseReviewRecord: ReviewRecord = {
  version: '1.0.0',
  jobId: 'job-1',
  createdAt: '2026-03-26T10:00:00.000Z',
  updatedAt: '2026-03-26T10:05:00.000Z',
  annotations: [],
};

describe('legacy review record mappers', () => {
  it('normalizes rubric mode payloads into publishable fields', () => {
    const envelope = normalizeLegacyJobResultEnvelope({
      mode: 'RUBRIC',
      rubricEvaluation: {
        sectionScore: 91,
        sectionMaxPoints: 100,
        overallFeedback: 'Strong work',
        criteria: [{ criterionId: 'c1' }],
      },
    });

    expect(envelope).toEqual({
      score: 91,
      maxScore: 100,
      summary: 'Strong work',
      questionBreakdown: [{ criterionId: 'c1' }],
    });
  });

  it('keeps general mode non-publishable but still extracts summary', () => {
    const envelope = normalizeLegacyJobResultEnvelope({
      mode: 'GENERAL',
      generalEvaluation: {
        overallSummary: 'Needs work',
        findings: [{ findingId: 'F1' }],
      },
    });

    expect(envelope).toEqual({
      summary: 'Needs work',
      questionBreakdown: [{ findingId: 'F1' }],
    });
  });

  it('stores exact review payload while borrowing score fields from job result', () => {
    const envelope = createLegacyReviewResultEnvelope(baseReviewRecord, {
      mode: 'RUBRIC',
      rubricEvaluation: {
        sectionScore: 88,
        sectionMaxPoints: 100,
        overallFeedback: 'Imported score',
      },
    });

    expect(envelope.rawPayload).toEqual(baseReviewRecord);
    expect(envelope.score).toBe(88);
    expect(envelope.maxScore).toBe(100);
    expect(envelope.summary).toBe('Imported score');
  });

  it('falls back to an empty record shape when stored payload is invalid', () => {
    expect(
      reviewRecordFromStoredPayload('job-2', { invalid: true }, baseReviewRecord.createdAt, baseReviewRecord.updatedAt)
    ).toEqual({
      version: '1.0.0',
      jobId: 'job-2',
      createdAt: baseReviewRecord.createdAt,
      updatedAt: baseReviewRecord.updatedAt,
      annotations: [],
    });
  });
});
