import type { FlagSeverity } from './states';

export interface ReviewResultFlag {
  code: string;
  summary: string;
  severity?: FlagSeverity;
}

export interface ReviewResultEnvelope {
  rawPayload: unknown;
  score?: number;
  maxScore?: number;
  summary?: string;
  questionBreakdown?: unknown;
  flags?: ReviewResultFlag[];
}

export const hasPublishableCoreFields = (
  envelope: ReviewResultEnvelope
): envelope is ReviewResultEnvelope & {
  score: number;
  maxScore: number;
  summary: string;
} =>
  typeof envelope.score === 'number' &&
  typeof envelope.maxScore === 'number' &&
  envelope.maxScore >= 0 &&
  typeof envelope.summary === 'string' &&
  envelope.summary.trim().length > 0;

export const assertPublishableResultEnvelope = (
  envelope: ReviewResultEnvelope
): ReviewResultEnvelope & { score: number; maxScore: number; summary: string } => {
  if (!hasPublishableCoreFields(envelope)) {
    throw new Error(
      'ReviewResultEnvelope is not publishable: score, maxScore, and summary are required'
    );
  }

  return envelope;
};
