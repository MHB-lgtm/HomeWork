import { ActorKind } from '@prisma/client';
import type { ReviewRecord } from '@hg/shared-schemas';
import { ReviewRecordSchema } from '@hg/shared-schemas';
import type { ReviewResultEnvelope, ReviewVersionKind } from '@hg/domain-workflow';
import type { LegacyReviewContextRecord } from '../types';
import { asJsonValue } from './domain';

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getString = (record: Record<string, unknown>, key: string): string | undefined =>
  typeof record[key] === 'string' ? (record[key] as string) : undefined;

const getNumber = (record: Record<string, unknown>, key: string): number | undefined =>
  typeof record[key] === 'number' ? (record[key] as number) : undefined;

const hasOwn = (record: Record<string, unknown>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(record, key);

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const GENERAL_ISSUE_PENALTIES = {
  critical: 1,
  major: 0.5,
  minor: 0.2,
} as const;

const STORED_REVIEW_PAYLOAD_FORMAT = 'legacy-review-record-v2';

type StoredReviewRecordPayload = {
  format: typeof STORED_REVIEW_PAYLOAD_FORMAT;
  reviewRecord: ReviewRecord;
  legacyJobContext: LegacyReviewContextRecord;
};

type QuestionLikeRecord = {
  findings: unknown[];
};

const isSeverityValue = (
  value: unknown
): value is keyof typeof GENERAL_ISSUE_PENALTIES =>
  value === 'critical' || value === 'major' || value === 'minor';

const isQuestionLikeRecord = (value: unknown): value is QuestionLikeRecord =>
  isObject(value) && Array.isArray(value.findings);

const derivePerQuestionGeneralScore = (
  questions: unknown[]
): { score: number; maxScore: number } | null => {
  const parsedQuestions = questions.filter(isQuestionLikeRecord);
  if (parsedQuestions.length === 0) {
    return null;
  }

  const questionMaxScore = 100 / parsedQuestions.length;
  const totalScore = parsedQuestions.reduce((sum, question) => {
    const rawPenalty = question.findings.reduce<number>((penalty, finding) => {
        if (!isObject(finding)) {
          return penalty;
        }

        const kind = getString(finding, 'kind');
        if (kind === 'strength') {
          return penalty;
        }

        const severity = getString(finding, 'severity');
        const nextPenalty = isSeverityValue(severity)
          ? GENERAL_ISSUE_PENALTIES[severity]
          : GENERAL_ISSUE_PENALTIES.major;

        return penalty + nextPenalty;
      }, 0);
    const penaltyRatio = clamp(rawPenalty, 0, 1);

    return sum + questionMaxScore * (1 - penaltyRatio);
  }, 0);

  return {
    score: clamp(Math.round(totalScore), 0, 100),
    maxScore: 100,
  };
};

const parseStoredReviewContext = (value: unknown): LegacyReviewContextRecord | null => {
  if (!isObject(value)) {
    return null;
  }

  const context: LegacyReviewContextRecord = {};

  if (typeof value.status === 'string') {
    context.status = value.status;
  }
  if (hasOwn(value, 'resultJson')) {
    context.resultJson = value.resultJson;
  }
  if (value.errorMessage === null || typeof value.errorMessage === 'string') {
    context.errorMessage = value.errorMessage;
  }
  if (value.submissionMimeType === null || typeof value.submissionMimeType === 'string') {
    context.submissionMimeType = value.submissionMimeType;
  }
  if (
    value.gradingMode === null ||
    value.gradingMode === 'RUBRIC' ||
    value.gradingMode === 'GENERAL'
  ) {
    context.gradingMode = value.gradingMode;
  }
  if (
    value.gradingScope === null ||
    value.gradingScope === 'QUESTION' ||
    value.gradingScope === 'DOCUMENT'
  ) {
    context.gradingScope = value.gradingScope;
  }

  return Object.keys(context).length > 0 ? context : null;
};

const parseStoredReviewPayload = (value: unknown): StoredReviewRecordPayload | null => {
  if (!isObject(value) || value.format !== STORED_REVIEW_PAYLOAD_FORMAT) {
    return null;
  }

  const parsedReview = ReviewRecordSchema.safeParse(value.reviewRecord);
  if (!parsedReview.success) {
    return null;
  }

  const context = parseStoredReviewContext(value.legacyJobContext);
  if (!context) {
    return null;
  }

  return {
    format: STORED_REVIEW_PAYLOAD_FORMAT,
    reviewRecord: parsedReview.data,
    legacyJobContext: context,
  };
};

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
    const questions = Array.isArray(generalEvaluation.questions)
      ? generalEvaluation.questions
      : null;
    const derivedScore = questions ? derivePerQuestionGeneralScore(questions) : null;

    return {
      ...(derivedScore ?? {}),
      summary:
        getString(generalEvaluation, 'overallSummary') ?? 'Imported general evaluation',
      questionBreakdown: questions ?? generalEvaluation.findings ?? null,
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

export const createStoredReviewRecordPayload = (
  reviewRecord: ReviewRecord,
  legacyJobContext?: LegacyReviewContextRecord
): ReviewRecord | StoredReviewRecordPayload => {
  if (!legacyJobContext) {
    return reviewRecord;
  }

  return {
    format: STORED_REVIEW_PAYLOAD_FORMAT,
    reviewRecord,
    legacyJobContext,
  };
};

export const reviewRecordFromStoredPayload = (
  jobId: string,
  rawPayload: unknown,
  fallbackCreatedAt: string,
  fallbackUpdatedAt: string
): ReviewRecord => {
  const storedPayload = parseStoredReviewPayload(rawPayload);
  if (storedPayload) {
    return storedPayload.reviewRecord;
  }

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

export const reviewContextFromStoredPayload = (
  rawPayload: unknown
): LegacyReviewContextRecord | null => parseStoredReviewPayload(rawPayload)?.legacyJobContext ?? null;

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
