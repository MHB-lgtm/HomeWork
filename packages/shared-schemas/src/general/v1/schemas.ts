import { z } from 'zod';
import { BBoxNormSchema } from '../../review/v1/schemas';

/**
 * Schema for a single finding in General evaluation
 */
export const FindingSchema = z.object({
  findingId: z.string(), // e.g. "F1", "F2", ... or "q5-F1", "q5-F2" for per-question
  title: z.string(), // short title
  description: z.string(), // detailed description
  kind: z.enum(['issue', 'strength']).optional(), // optional: "issue" (default) or "strength"
  severity: z.enum(['critical', 'major', 'minor']).optional(), // required for issues, optional/ignored for strengths
  confidence: z.number().min(0).max(1), // 0..1
  suggestion: z.string().optional(), // optional suggestion
});

/**
 * Schema for scope in General evaluation
 */
export const ScopeSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('QUESTION'),
    questionId: z.string(),
  }),
  z.object({
    type: z.literal('DOCUMENT'),
  }),
]);

/**
 * Schema for per-question evaluation output
 */
export const QuestionEvaluationSchema = z.object({
  questionId: z.string(),
  order: z.number().int().positive().optional(), // from examIndex
  displayLabel: z.string().optional(), // from examIndex
  promptText: z.string().optional(), // from examIndex (optional to store; recommended)
  pageIndices: z.array(z.number().int().nonnegative()).optional(), // from mapping (0-based for original submission)
  mappingConfidence: z.number().min(0).max(1).optional(), // 0..1
  findings: z.array(FindingSchema).min(1), // must have >=1 finding
  overallSummary: z.string().optional(),
}).refine(
  (data) => {
    // Ensure findingId uniqueness within question
    const ids = data.findings.map((f) => f.findingId);
    return new Set(ids).size === ids.length;
  },
  {
    message: 'findingId values must be unique',
  }
);

/**
 * Schema for General evaluation output (v1)
 * Supports both legacy format (top-level findings) and new per-question format
 */
export const GeneralEvaluationSchema = z.union([
  // Legacy format (backward compatible)
  z.object({
    examId: z.string(),
    scope: ScopeSchema,
    findings: z.array(FindingSchema).max(30),
    overallSummary: z.string().optional(),
  }).refine(
    (data) => {
      const ids = data.findings.map((f) => f.findingId);
      return new Set(ids).size === ids.length;
    },
    {
      message: 'findingId values must be unique',
    }
  ),
  // New per-question format (preferred)
  z.object({
    examId: z.string(),
    scope: ScopeSchema,
    questions: z.array(QuestionEvaluationSchema),
    overallSummary: z.string().optional(),
  }),
]);

/**
 * TypeScript type inferred from GeneralEvaluationSchema
 */
export type GeneralEvaluation = z.infer<typeof GeneralEvaluationSchema>;

/**
 * TypeScript type inferred from QuestionEvaluationSchema
 */
export type QuestionEvaluation = z.infer<typeof QuestionEvaluationSchema>;

/**
 * TypeScript type inferred from FindingSchema
 */
export type Finding = z.infer<typeof FindingSchema>;

/**
 * TypeScript type inferred from ScopeSchema
 */
export type Scope = z.infer<typeof ScopeSchema>;

/**
 * Schema for a single localized box for a finding
 */
export const FindingBoxSchema = z.object({
  findingId: z.string(), // must match one of generalEvaluation.findings[].findingId
  pageIndex: z.number().int().nonnegative(), // 0-based
  bboxNorm: BBoxNormSchema,
  confidence: z.number().min(0).max(1).optional(), // 0..1 optional
});

/**
 * Schema for General Findings Localization output (v1)
 */
export const GeneralFindingsLocalizationSchema = z.object({
  boxes: z.array(FindingBoxSchema).max(60), // Cap total boxes
}).refine(
  (data) => {
    // Validate findingId uniqueness within boxes (allow multiple boxes per findingId)
    // This is just a sanity check - the main validation is that findingId matches findings list
    return true; // Multiple boxes per findingId is allowed
  },
  {
    message: 'Invalid boxes structure',
  }
);

/**
 * TypeScript type inferred from GeneralFindingsLocalizationSchema
 */
export type GeneralFindingsLocalization = z.infer<typeof GeneralFindingsLocalizationSchema>;

/**
 * TypeScript type inferred from FindingBoxSchema
 */
export type FindingBox = z.infer<typeof FindingBoxSchema>;

/**
 * Schema for Question Page Mapping (v1)
 * Maps a questionId to the page indices where its answer appears in the submission
 */
export const QuestionMappingSchema = z.object({
  questionId: z.string(),
  pageIndices: z.array(z.number().int().nonnegative()).min(1).max(10), // 0-based, unique, sorted, length 1..10
  confidence: z.number().min(0).max(1), // 0..1
}).refine(
  (data) => {
    // Ensure pageIndices are unique and sorted
    const unique = new Set(data.pageIndices);
    if (unique.size !== data.pageIndices.length) {
      return false;
    }
    const sorted = [...data.pageIndices].sort((a, b) => a - b);
    return JSON.stringify(sorted) === JSON.stringify(data.pageIndices);
  },
  {
    message: 'pageIndices must be unique and sorted',
  }
);

/**
 * TypeScript type inferred from QuestionMappingSchema
 */
export type QuestionMapping = z.infer<typeof QuestionMappingSchema>;

/**
 * Schema for a single localized box for a finding (per-question localization v1)
 */
export const FindingBoxV1Schema = z.object({
  findingId: z.string(), // must match one of findings for the current question
  pageIndex: z.number().int().nonnegative(), // 0-based relative to the INPUT document used in localization (mini-PDF or original)
  bboxNorm: BBoxNormSchema,
  confidence: z.number().min(0).max(1).optional(), // 0..1 optional
});

/**
 * Schema for General Findings Localization output (per-question v1)
 */
export const GeneralFindingsLocalizationV1Schema = z.object({
  boxes: z.array(FindingBoxV1Schema).max(40), // Cap total boxes per question
});

/**
 * TypeScript type inferred from GeneralFindingsLocalizationV1Schema
 */
export type GeneralFindingsLocalizationV1 = z.infer<typeof GeneralFindingsLocalizationV1Schema>;

/**
 * TypeScript type inferred from FindingBoxV1Schema
 */
export type FindingBoxV1 = z.infer<typeof FindingBoxV1Schema>;
