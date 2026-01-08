import { z } from 'zod';

/**
 * Schema for normalized bounding box (coordinates in [0,1] range)
 */
export const BBoxNormSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1).refine((val) => val > 0, { message: 'w must be greater than 0' }),
  h: z.number().min(0).max(1).refine((val) => val > 0, { message: 'h must be greater than 0' }),
});

/**
 * TypeScript type inferred from BBoxNormSchema
 */
export type BBoxNorm = z.infer<typeof BBoxNormSchema>;

/**
 * Schema for a single annotation
 */
export const AnnotationSchema = z.object({
  id: z.string(),
  criterionId: z.string(),
  pageIndex: z.number().int().nonnegative(),
  bboxNorm: BBoxNormSchema,
  label: z.string().optional(),
  comment: z.string().optional(),
  createdBy: z.enum(['human', 'ai']),
  confidence: z.number().min(0).max(1).optional(),
  status: z.enum(['proposed', 'confirmed', 'rejected']),
  createdAt: z.string(), // ISO string
  updatedAt: z.string(), // ISO string
});

/**
 * TypeScript type inferred from AnnotationSchema
 */
export type Annotation = z.infer<typeof AnnotationSchema>;

/**
 * Schema for a review record
 */
export const ReviewRecordSchema = z.object({
  version: z.literal('1.0.0'),
  jobId: z.string(),
  createdAt: z.string(), // ISO string
  updatedAt: z.string(), // ISO string
  annotations: z.array(AnnotationSchema),
});

/**
 * TypeScript type inferred from ReviewRecordSchema
 */
export type ReviewRecord = z.infer<typeof ReviewRecordSchema>;

