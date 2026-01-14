import { z } from 'zod';

export const CourseSchema = z.object({
  version: z.literal('1.0.0'),
  courseId: z.string(),
  title: z.string(),
  createdAt: z.string(), // ISO timestamp
  updatedAt: z.string(), // ISO timestamp
});

export type Course = z.infer<typeof CourseSchema>;

export const LectureSchema = z.object({
  version: z.literal('1.0.0'),
  lectureId: z.string(),
  courseId: z.string(),
  title: z.string(),
  sourceType: z.enum(['text', 'markdown', 'transcript_vtt', 'transcript_srt']),
  assetPath: z.string(), // Stored as HG_DATA_DIR-relative path to asset
  externalUrl: z.string().optional(),
  createdAt: z.string(), // ISO timestamp
  updatedAt: z.string(), // ISO timestamp
});

export type Lecture = z.infer<typeof LectureSchema>;

export const ChunkAnchorsSchema = z.object({
  pageIndex: z.number().int().nonnegative().optional(),
  slideIndex: z.number().int().nonnegative().optional(),
  startSec: z.number().nonnegative().optional(),
  endSec: z.number().nonnegative().optional(),
});

export type ChunkAnchors = z.infer<typeof ChunkAnchorsSchema>;

export const CourseChunkSchema = z.object({
  version: z.literal('1.0.0'),
  chunkId: z.string(),
  courseId: z.string(),
  lectureId: z.string(),
  order: z.number().int().nonnegative(),
  text: z.string(),
  anchors: ChunkAnchorsSchema.optional(),
});

export type CourseChunk = z.infer<typeof CourseChunkSchema>;

export const StudyPointerAnchorSchema = z.object({
  startSec: z.number().nonnegative().optional(),
  endSec: z.number().nonnegative().optional(),
});

export type StudyPointerAnchor = z.infer<typeof StudyPointerAnchorSchema>;

export const StudyPointerDeepLinkSchema = z.object({
  url: z.string().optional(),
  startSec: z.number().nonnegative().optional(),
});

export type StudyPointerDeepLink = z.infer<typeof StudyPointerDeepLinkSchema>;

export const StudyPointerV1Schema = z.object({
  version: z.literal('1.0.0'),
  courseId: z.string(),
  lectureId: z.string(),
  lectureTitle: z.string(),
  chunkId: z.string(),
  snippet: z.string(),
  reason: z.string(),
  confidence: z.number().min(0).max(1),
  anchor: StudyPointerAnchorSchema.optional(),
  deepLink: StudyPointerDeepLinkSchema.optional(),
});

export type StudyPointerV1 = z.infer<typeof StudyPointerV1Schema>;

export const RagManifestSchema = z.object({
  version: z.literal('1.0.0'),
  courseId: z.string(),
  builtAt: z.string(), // ISO timestamp
  lectureCount: z.number().int().nonnegative(),
  chunkCount: z.number().int().nonnegative(),
  chunking: z.object({
    maxChars: z.number().int().positive(),
    overlapChars: z.number().int().nonnegative(),
  }),
});

export type RagManifest = z.infer<typeof RagManifestSchema>;

export const RagQueryRequestV1Schema = z.object({
  query: z.string().min(3),
  k: z.number().int().positive().max(10).optional(),
  method: z.literal('lexical_v1').optional(),
});

export type RagQueryRequestV1 = z.infer<typeof RagQueryRequestV1Schema>;

export const ChunkHitV1Schema = z.object({
  courseId: z.string(),
  lectureId: z.string(),
  lectureTitle: z.string(),
  chunkId: z.string(),
  order: z.number().int().nonnegative(),
  score: z.number(),
  snippet: z.string(),
});

export type ChunkHitV1 = z.infer<typeof ChunkHitV1Schema>;

export const RagQueryResponseV1Schema = z.object({
  ok: z.literal(true),
  data: z.object({
    hits: z.array(ChunkHitV1Schema),
    method: z.literal('lexical_v1'),
  }),
});

export type RagQueryResponseV1 = z.infer<typeof RagQueryResponseV1Schema>;

export const SuggestRequestV1Schema = z.object({
  issueText: z.string().min(10),
  k: z.number().int().positive().max(5).optional(),
});

export type SuggestRequestV1 = z.infer<typeof SuggestRequestV1Schema>;

export const SuggestResponseV1Schema = z.object({
  ok: z.literal(true),
  data: z.object({
    pointers: z.array(StudyPointerV1Schema),
  }),
});

export type SuggestResponseV1 = z.infer<typeof SuggestResponseV1Schema>;
