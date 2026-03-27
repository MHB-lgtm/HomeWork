import { ActorKind } from '@prisma/client';
import type { ReviewRecord } from '@hg/shared-schemas';
import { ReviewRecordSchema } from '@hg/shared-schemas';
import type { ReviewResultEnvelope, ReviewVersionKind } from '@hg/domain-workflow';
import { asJsonValue } from './domain';

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getString = (record: Record<string, unknown>, key: string): string | undefined =>
  typeof record[key] === 'string' ? (record[key] as string) : undefined;

const getNumber = (record: Record<string, unknown>, key: string): number | undefined =>
  typeof record[key] === 'number' ? (record[key] as number) : undefined;

export const hasHumanAnnotations = (reviewRecord: ReviewRecord): boolean =>
  reviewRecord.annotations.some((annotation) => annotation.createdBy === 'human');

export const reviewVersionKindFromReviewRecord = (reviewRecord: ReviewRecord): ReviewVersionKind =>
  hasHumanAnnotations(reviewRecord) ? 'lecturer_edit' : 'ai_draft';

export const actorKindFromReviewRecord = (reviewRecord: ReviewRecord): ActorKind =>
  hasHumanAnnotations(reviewRecord) ? ActorKind.LEGACY : ActorKind.AI;

export const normalizeLegacyJobResultEnvelope = (
  resultJson: unknown
): Omit<ReviewResultEnvelope, 'rawPayload'> | null => {
  if (!isObject(resultJson)) {
    return null;
  }

  const rubricEvaluation = isObject(resultJson.rubricEvaluation)
    ? resultJson.rubricEvaluation
    : null;

  if (rubricEvaluation) {
    const score = getNumber(rubricEvaluation, 'sectionScore');
    const maxScore = getNumber(rubricEvaluation, 'sectionMaxPoints');
    const summary =
      getString(rubricEvaluation, 'overallFeedback') ?? 'Imported rubric evaluation';

    return {
      score,
      maxScore,
      summary,
      questionBreakdown: rubricEvaluation.criteria,
    };
  }

  const scoreTotal = getNumber(resultJson, 'score_total');
  const summaryFeedback = getString(resultJson, 'summary_feedback');
  if (scoreTotal !== undefined && summaryFeedback) {
    return {
      score: scoreTotal,
      maxScore: 100,
      summary: summaryFeedback,
      questionBreakdown: resultJson.criteria,
    };
  }

  const generalEvaluation = isObject(resultJson.generalEvaluation)
    ? resultJson.generalEvaluation
    : null;

  if (generalEvaluation) {
    return {
      summary:
        getString(generalEvaluation, 'overallSummary') ?? 'Imported general evaluation',
      questionBreakdown: generalEvaluation.questions ?? generalEvaluation.findings ?? null,
    };
  }

  return null;
};

export const createLegacyReviewResultEnvelope = (
  reviewRecord: ReviewRecord,
  resultJson?: unknown
): ReviewResultEnvelope => {
  const normalized = normalizeLegacyJobResultEnvelope(resultJson);

  return {
    rawPayload: asJsonValue(reviewRecord),
    score: normalized?.score,
    maxScore: normalized?.maxScore,
    summary:
      normalized?.summary ??
      `Legacy review snapshot with ${reviewRecord.annotations.length} annotation(s)`,
    questionBreakdown: normalized?.questionBreakdown,
  };
};

export const reviewRecordFromStoredPayload = (
  jobId: string,
  rawPayload: unknown,
  fallbackCreatedAt: string,
  fallbackUpdatedAt: string
): ReviewRecord => {
  const parsed = ReviewRecordSchema.safeParse(rawPayload);
  if (parsed.success) {
    return parsed.data;
  }

  return {
    version: '1.0.0',
    jobId,
    createdAt: fallbackCreatedAt,
    updatedAt: fallbackUpdatedAt,
    annotations: [],
  };
};

export const setReviewDisplayName = (
  reviewRecord: ReviewRecord,
  displayName: string | null
): ReviewRecord => {
  const nextDisplayName = displayName?.trim() || undefined;
  if (!nextDisplayName) {
    const { displayName: _ignored, ...rest } = reviewRecord;
    return rest;
  }

  return {
    ...reviewRecord,
    displayName: nextDisplayName,
  };
};
