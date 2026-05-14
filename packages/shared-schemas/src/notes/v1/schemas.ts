/**
 * StudyFlow — Smart Notes v1 Zod schemas
 *
 * These types extend the existing Homework Grader monorepo with a new
 * "Notes" product surface: Workspaces → Files (lecture / practice / homework)
 * → Questions (for homework) / Summary (for lectures).
 *
 * Stay consistent with the existing schema style in `@hg/shared-schemas`:
 * - Use z.object()
 * - Export both the schema and the inferred type
 * - Keep runtime fields stable — additions only, never breaking changes
 */

import { z } from 'zod';

/* ─────────────────────────────────────────────
   Core enums
   ───────────────────────────────────────────── */

export const DocumentTypeSchema = z.enum([
  'lecture',
  'practice',
  'homework',
  'unknown',
]);
export type DocumentType = z.infer<typeof DocumentTypeSchema>;

export const SummaryTierSchema = z.enum(['short', 'medium', 'deep']);
export type SummaryTier = z.infer<typeof SummaryTierSchema>;

export const FileStatusSchema = z.enum([
  'uploaded', // bytes in storage, awaiting ingest
  'analyzing', // detector / summarizer / homework-analyzer running
  'ready', // analysis complete, user can open
  'failed', // ingest error — see `error` field
]);
export type FileStatus = z.infer<typeof FileStatusSchema>;

export const PlanSchema = z.enum(['free', 'basic', 'pro']);
export type Plan = z.infer<typeof PlanSchema>;

/* ─────────────────────────────────────────────
   Workspace — a course-sized container
   ───────────────────────────────────────────── */

export const WorkspaceSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1).max(120),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#2E75B6'),
  icon: z.string().max(32).optional(),
  term: z.enum(['sem_a', 'sem_b', 'summer', 'other']).default('other'),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Workspace = z.infer<typeof WorkspaceSchema>;

/* ─────────────────────────────────────────────
   Question (homework) — reuses shape that the
   existing workspace/page-client.tsx already renders
   ───────────────────────────────────────────── */

export const QuestionPartSchema = z.object({
  label: z.string(),
  text: z.string(),
});
export type QuestionPart = z.infer<typeof QuestionPartSchema>;

export const QuestionSchema = z.object({
  id: z.string(),
  number: z.number().int().positive(),
  intro: z.string().optional(),
  parts: z.array(QuestionPartSchema).optional(),
});
export type Question = z.infer<typeof QuestionSchema>;

/* ─────────────────────────────────────────────
   Summary (lecture)
   ───────────────────────────────────────────── */

export const KeyTermSchema = z.object({
  term: z.string(),
  definition: z.string(),
});
export type KeyTerm = z.infer<typeof KeyTermSchema>;

export const GeneratedQuestionSchema = z.object({
  question: z.string(),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
});
export type GeneratedQuestion = z.infer<typeof GeneratedQuestionSchema>;

export const SummarySchema = z.object({
  id: z.string().uuid(),
  fileId: z.string().uuid(),
  tier: SummaryTierSchema,
  contentMd: z.string(),
  keyTerms: z.array(KeyTermSchema).default([]),
  generatedQuestions: z.array(GeneratedQuestionSchema).default([]),
  provider: z.enum(['gemini', 'openai', 'claude']),
  tokensUsed: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});
export type Summary = z.infer<typeof SummarySchema>;

/* ─────────────────────────────────────────────
   File (the core unit — lecture, practice, or homework)
   ───────────────────────────────────────────── */

export const FileSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  title: z.string().min(1).max(200),
  type: DocumentTypeSchema,
  status: FileStatusSchema,
  storagePath: z.string().optional(), // S3/R2 key; absent for from-scratch notes
  mimeType: z.string().optional(),
  byteSize: z.number().int().nonnegative().optional(),
  detectionConfidence: z.number().min(0).max(1).optional(),
  questions: z.array(QuestionSchema).optional(), // present when type=homework|practice
  summaryId: z.string().uuid().optional(), // present when type=lecture and summarized
  error: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type File = z.infer<typeof FileSchema>;

/* ─────────────────────────────────────────────
   Subscription & Usage
   ───────────────────────────────────────────── */

export const SubscriptionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  plan: PlanSchema,
  stripeCustomerId: z.string().optional(),
  stripeSubscriptionId: z.string().optional(),
  summaryQuotaMonth: z.number().int().nonnegative(),
  homeworkQuotaMonth: z.number().int().nonnegative(),
  summaryUsedThisMonth: z.number().int().nonnegative().default(0),
  homeworkUsedThisMonth: z.number().int().nonnegative().default(0),
  renewsAt: z.string().datetime(),
});
export type Subscription = z.infer<typeof SubscriptionSchema>;

/**
 * Plan quotas — single source of truth for billing gates.
 * These match the PRD pricing table (Free / Basic ₪50 / Pro ₪79).
 */
export const PLAN_QUOTAS: Record<Plan, {
  monthlyPriceIls: number;
  summaryQuota: number;
  homeworkQuota: number;
  extraSummaryPriceIls: number;
  maxDevices: number;
  storageGb: number;
}> = {
  free: {
    monthlyPriceIls: 0,
    summaryQuota: 2,
    homeworkQuota: 1,
    extraSummaryPriceIls: 0,
    maxDevices: 2,
    storageGb: 0.5,
  },
  basic: {
    monthlyPriceIls: 50,
    summaryQuota: 1,
    homeworkQuota: 3,
    extraSummaryPriceIls: 1.5,
    maxDevices: 3,
    storageGb: 5,
  },
  pro: {
    monthlyPriceIls: 79,
    summaryQuota: 3,
    homeworkQuota: Number.POSITIVE_INFINITY, // unlimited
    extraSummaryPriceIls: 1.5,
    maxDevices: Number.POSITIVE_INFINITY,
    storageGb: 20,
  },
};

/**
 * Usage event — every paid action logs one of these so we can
 * reconcile with Stripe and enforce quotas in real-time.
 */
export const UsageEventSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  action: z.enum(['summary', 'homework_analysis', 'ocr', 'extra_summary']),
  creditsUsed: z.number().int().positive(),
  fileId: z.string().uuid().optional(),
  occurredAt: z.string().datetime(),
});
export type UsageEvent = z.infer<typeof UsageEventSchema>;

/* ─────────────────────────────────────────────
   API request/response wrappers
   ───────────────────────────────────────────── */

export const DetectionResultSchema = z.object({
  type: DocumentTypeSchema,
  confidence: z.number().min(0).max(1),
  questions: z.array(QuestionSchema).optional(),
  reasoning: z.string().optional(), // short human-readable explanation, for debug
});
export type DetectionResult = z.infer<typeof DetectionResultSchema>;

export const CreateFileRequestSchema = z.object({
  workspaceId: z.string().uuid(),
  title: z.string().min(1).max(200),
  hintedType: DocumentTypeSchema.optional(), // user may pre-declare the type
});
export type CreateFileRequest = z.infer<typeof CreateFileRequestSchema>;

export const RequestSummaryBodySchema = z.object({
  fileId: z.string().uuid(),
  tier: SummaryTierSchema.default('medium'),
});
export type RequestSummaryBody = z.infer<typeof RequestSummaryBodySchema>;

/* ─────────────────────────────────────────────
   Validators (parallel to validateEvaluationResult)
   ───────────────────────────────────────────── */

export function validateDocumentType(data: unknown): DocumentType {
  return DocumentTypeSchema.parse(data);
}

export function validateDetectionResult(data: unknown): DetectionResult {
  return DetectionResultSchema.parse(data);
}

export function validateFile(data: unknown): File {
  return FileSchema.parse(data);
}
