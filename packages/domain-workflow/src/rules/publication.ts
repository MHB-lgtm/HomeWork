import type { PublishedResult } from '../entities/publication';
import type { ReviewVersion } from '../entities/review';
import {
  assertPublishableResultEnvelope,
  type ReviewResultEnvelope,
} from '../result-envelope';
import { getModuleRefKey, isSameModuleRef, type ModuleRef } from '../refs';

export const assertCanPublishResultEnvelope = (
  envelope: ReviewResultEnvelope
): ReviewResultEnvelope & { score: number; maxScore: number; summary: string } =>
  assertPublishableResultEnvelope(envelope);

export const assertPublishedResultModuleMatch = (
  expected: ModuleRef,
  actual: ModuleRef
): void => {
  if (!isSameModuleRef(expected, actual)) {
    throw new Error(
      `PublishedResult moduleRef mismatch: expected ${getModuleRefKey(expected)}, received ${getModuleRefKey(actual)}`
    );
  }
};

export const getEffectivePublishedResult = (
  results: PublishedResult[],
  submissionId: string
): PublishedResult | null => {
  const effective = results
    .filter(
      (result) =>
        result.submissionId === submissionId && result.status === 'effective'
    )
    .sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt));

  return effective[0] ?? null;
};

export const getSupersededPublishedResultIds = (
  results: PublishedResult[],
  submissionId: string
): string[] =>
  results
    .filter(
      (result) =>
        result.submissionId === submissionId && result.status === 'effective'
    )
    .map((result) => result.publishedResultId);

export const createPublishedSnapshotResultEnvelope = (
  reviewVersion: ReviewVersion
): ReviewVersion['resultEnvelope'] => {
  const publishable = assertPublishableResultEnvelope(reviewVersion.resultEnvelope);

  return {
    rawPayload: reviewVersion.resultEnvelope.rawPayload,
    score: publishable.score,
    maxScore: publishable.maxScore,
    summary: publishable.summary,
    questionBreakdown: reviewVersion.resultEnvelope.questionBreakdown,
    flags: reviewVersion.resultEnvelope.flags,
  };
};
