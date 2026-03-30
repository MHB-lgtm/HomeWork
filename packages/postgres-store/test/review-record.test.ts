import { describe, expect, it } from 'vitest';
import type { ReviewRecord } from '@hg/shared-schemas';
import {
  createStoredReviewRecordPayload,
  createLegacyReviewResultEnvelope,
  normalizeLegacyJobResultEnvelope,
  reviewContextFromStoredPayload,
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

  it('keeps legacy general mode non-publishable but still extracts summary', () => {
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

  it('derives publishable fields for per-question general mode payloads', () => {
    const envelope = normalizeLegacyJobResultEnvelope({
      mode: 'GENERAL',
      generalEvaluation: {
        overallSummary: 'Mixed performance across the assignment.',
        questions: [
          {
            questionId: 'q1',
            findings: [{ findingId: 'q1-f1', kind: 'issue', severity: 'major' }],
          },
          {
            questionId: 'q2',
            findings: [{ findingId: 'q2-f1', kind: 'strength' }],
          },
        ],
      },
    });

    expect(envelope).toEqual({
      score: 75,
      maxScore: 100,
      summary: 'Mixed performance across the assignment.',
      questionBreakdown: [
        {
          questionId: 'q1',
          findings: [{ findingId: 'q1-f1', kind: 'issue', severity: 'major' }],
        },
        {
          questionId: 'q2',
          findings: [{ findingId: 'q2-f1', kind: 'strength' }],
        },
      ],
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

  it('reads wrapped review payloads without breaking the review record shape', () => {
    const storedPayload = createStoredReviewRecordPayload(baseReviewRecord, {
      status: 'DONE',
      resultJson: { mode: 'RUBRIC' },
      errorMessage: null,
      submissionMimeType: 'application/pdf',
      gradingMode: 'RUBRIC',
      gradingScope: 'QUESTION',
    });

    expect(
      reviewRecordFromStoredPayload(
        'job-1',
        storedPayload,
        baseReviewRecord.createdAt,
        baseReviewRecord.updatedAt
      )
    ).toEqual(baseReviewRecord);
    expect(reviewContextFromStoredPayload(storedPayload)).toEqual({
      status: 'DONE',
      resultJson: { mode: 'RUBRIC' },
      errorMessage: null,
      submissionMimeType: 'application/pdf',
      gradingMode: 'RUBRIC',
      gradingScope: 'QUESTION',
    });
  });
});
