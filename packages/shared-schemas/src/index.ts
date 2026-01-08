import { z } from 'zod';

/**
 * Schema for a single rubric criterion evaluation
 */
const CriterionSchema = z.object({
  id: z.string(),
  title: z.string(),
  max_score: z.number(),
  score: z.number(),
  comment: z.string(),
  evidence: z.string().optional(),
});

/**
 * Main EvaluationResult schema
 * Validates the structured output from Gemini grading
 */
export const EvaluationResultSchema = z.object({
  score_total: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  summary_feedback: z.string(),
  flags: z.array(z.string()),
  criteria: z.array(CriterionSchema),
});

/**
 * TypeScript type inferred from EvaluationResultSchema
 */
export type EvaluationResult = z.infer<typeof EvaluationResultSchema>;

/**
 * Validates and parses an unknown data object against EvaluationResultSchema
 * @param data - The data to validate
 * @returns The parsed and validated EvaluationResult
 * @throws ZodError if validation fails
 */
export function validateEvaluationResult(data: unknown): EvaluationResult {
  return EvaluationResultSchema.parse(data);
}

// Re-export rubric v1 exports
export {
  RubricSpecSchema,
  RubricSpec,
  RubricEvaluationRawSchema,
  RubricEvaluationRaw,
  RubricCriterionEvaluation,
  RubricEvaluationResult,
} from './rubric/v1/schemas';

export {
  RubricValidationErrorCode,
  RubricValidationError,
} from './rubric/v1/errors';

export {
  normalizeAndValidateRubricEvaluation,
} from './rubric/v1/normalize';

// Re-export review v1 exports
export {
  BBoxNormSchema,
  BBoxNorm,
  AnnotationSchema,
  Annotation,
  ReviewRecordSchema,
  ReviewRecord,
} from './review/v1/schemas';
