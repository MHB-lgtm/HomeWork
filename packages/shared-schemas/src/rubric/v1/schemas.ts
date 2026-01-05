import { z } from 'zod';

/**
 * Schema for a rubric criterion specification
 */
const RubricCriterionSpecSchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.enum(['points', 'binary']),
  maxPoints: z.number().int().positive(),
  guidance: z.string().optional(),
});

/**
 * Schema for a complete rubric specification
 */
export const RubricSpecSchema = z.object({
  examId: z.string(),
  questionId: z.string(),
  title: z.string().optional(),
  generalGuidance: z.string().optional(),
  criteria: z.array(RubricCriterionSpecSchema).min(1),
});

/**
 * TypeScript type inferred from RubricSpecSchema
 */
export type RubricSpec = z.infer<typeof RubricSpecSchema>;

/**
 * Schema for a single criterion evaluation from LLM (raw output)
 */
const RubricCriterionEvaluationRawSchema = z.object({
  criterionId: z.string(),
  score: z.number().int(),
  feedback: z.string(),
});

/**
 * Schema for raw rubric evaluation output from LLM
 */
export const RubricEvaluationRawSchema = z.object({
  examId: z.string(),
  questionId: z.string(),
  criteria: z.array(RubricCriterionEvaluationRawSchema),
  overallFeedback: z.string().optional(),
});

/**
 * TypeScript type inferred from RubricEvaluationRawSchema
 */
export type RubricEvaluationRaw = z.infer<typeof RubricEvaluationRawSchema>;

/**
 * Normalized criterion evaluation (after validation and enrichment)
 */
export type RubricCriterionEvaluation = {
  criterionId: string;
  label: string;
  kind: 'points' | 'binary';
  maxPoints: number;
  score: number;
  feedback: string;
  guidance?: string;
};

/**
 * Normalized rubric evaluation result
 */
export type RubricEvaluationResult = {
  examId: string;
  questionId: string;
  criteria: RubricCriterionEvaluation[];
  sectionScore: number;
  sectionMaxPoints: number;
  overallFeedback?: string;
};

