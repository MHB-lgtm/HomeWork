import {
  RubricSpec,
  RubricEvaluationRawSchema,
  RubricCriterionEvaluation,
  RubricEvaluationResult,
} from './schemas';
import {
  RubricValidationErrorCode,
  RubricValidationError,
} from './errors';

/**
 * Normalizes and validates a raw rubric evaluation against the rubric specification.
 * Enforces strict matching: all rubric criteria must be present, no extras, no duplicates.
 *
 * @param rubric - The rubric specification
 * @param raw - The raw evaluation output from LLM
 * @returns Normalized and validated evaluation result
 * @throws RubricValidationError with specific error codes on validation failures
 */
export function normalizeAndValidateRubricEvaluation(
  rubric: RubricSpec,
  raw: unknown
): RubricEvaluationResult {
  // Parse and validate raw input schema
  const parsedRaw = RubricEvaluationRawSchema.parse(raw);

  // Validate examId and questionId match
  if (parsedRaw.examId !== rubric.examId) {
    throw new RubricValidationError(
      RubricValidationErrorCode.EXAM_ID_MISMATCH,
      `Exam ID mismatch: expected "${rubric.examId}", got "${parsedRaw.examId}"`
    );
  }

  if (parsedRaw.questionId !== rubric.questionId) {
    throw new RubricValidationError(
      RubricValidationErrorCode.QUESTION_ID_MISMATCH,
      `Question ID mismatch: expected "${rubric.questionId}", got "${parsedRaw.questionId}"`
    );
  }

  // Build a map of rubric criteria by ID for quick lookup
  const rubricCriteriaMap = new Map(
    rubric.criteria.map((c) => [c.id, c])
  );

  // Build a map of raw criteria by ID to detect duplicates
  const rawCriteriaMap = new Map<string, typeof parsedRaw.criteria[0]>();
  const seenIds = new Set<string>();

  for (const rawCriterion of parsedRaw.criteria) {
    if (seenIds.has(rawCriterion.criterionId)) {
      throw new RubricValidationError(
        RubricValidationErrorCode.DUPLICATE_CRITERIA,
        `Duplicate criterion ID in evaluation: "${rawCriterion.criterionId}"`
      );
    }
    seenIds.add(rawCriterion.criterionId);
    rawCriteriaMap.set(rawCriterion.criterionId, rawCriterion);
  }

  // Check for missing criteria (strict: all rubric criteria must be present)
  const missingCriteria: string[] = [];
  for (const rubricCriterion of rubric.criteria) {
    if (!rawCriteriaMap.has(rubricCriterion.id)) {
      missingCriteria.push(rubricCriterion.id);
    }
  }

  if (missingCriteria.length > 0) {
    throw new RubricValidationError(
      RubricValidationErrorCode.MISSING_CRITERIA,
      `Missing criteria in evaluation: ${missingCriteria.join(', ')}`
    );
  }

  // Check for extra criteria (strict: no criteria outside the rubric)
  const extraCriteria: string[] = [];
  for (const rawCriterion of parsedRaw.criteria) {
    if (!rubricCriteriaMap.has(rawCriterion.criterionId)) {
      extraCriteria.push(rawCriterion.criterionId);
    }
  }

  if (extraCriteria.length > 0) {
    throw new RubricValidationError(
      RubricValidationErrorCode.EXTRA_CRITERIA,
      `Extra criteria in evaluation (not in rubric): ${extraCriteria.join(', ')}`
    );
  }

  // Normalize and validate each criterion
  const normalizedCriteria: RubricCriterionEvaluation[] = [];
  let sectionScore = 0;
  let sectionMaxPoints = 0;

  for (const rubricCriterion of rubric.criteria) {
    const rawCriterion = rawCriteriaMap.get(rubricCriterion.id)!;
    const { id, label, kind, maxPoints, guidance } = rubricCriterion;
    const { score, feedback } = rawCriterion;

    // Validate score range based on kind
    if (kind === 'points') {
      if (score < 0 || score > maxPoints) {
        throw new RubricValidationError(
          RubricValidationErrorCode.INVALID_SCORE_RANGE,
          `Invalid score for criterion "${id}": ${score} (must be 0..${maxPoints} for points kind)`
        );
      }
    } else if (kind === 'binary') {
      if (score !== 0 && score !== maxPoints) {
        throw new RubricValidationError(
          RubricValidationErrorCode.INVALID_BINARY_SCORE,
          `Invalid score for criterion "${id}": ${score} (must be 0 or ${maxPoints} for binary kind)`
        );
      }
    }

    normalizedCriteria.push({
      criterionId: id,
      label,
      kind,
      maxPoints,
      score,
      feedback,
      guidance,
    });

    sectionScore += score;
    sectionMaxPoints += maxPoints;
  }

  return {
    examId: parsedRaw.examId,
    questionId: parsedRaw.questionId,
    criteria: normalizedCriteria,
    sectionScore,
    sectionMaxPoints,
    overallFeedback: parsedRaw.overallFeedback,
  };
}

