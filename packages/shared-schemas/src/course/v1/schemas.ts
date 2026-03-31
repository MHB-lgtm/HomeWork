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

export const AssignmentStateSchema = z.enum([
  'draft',
  'open',
  'closed',
  'processing',
  'reviewed',
  'published',
]);

export type AssignmentState = z.infer<typeof AssignmentStateSchema>;

export const AssignmentSchema = z.object({
  version: z.literal('1.0.0'),
  assignmentId: z.string(),
  courseId: z.string(),
  weekId: z.string(),
  examId: z.string(),
  title: z.string(),
  openAt: z.string(),
  deadlineAt: z.string(),
  state: AssignmentStateSchema,
  promptMaterialId: z.string(),
  solutionMaterialId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Assignment = z.infer<typeof AssignmentSchema>;

export const OperationalSubmissionStatusSchema = z.enum([
  'SUBMITTED',
  'PROCESSING',
  'READY_FOR_REVIEW',
  'PUBLISHED',
  'FAILED',
]);

export type OperationalSubmissionStatus = z.infer<
  typeof OperationalSubmissionStatusSchema
>;

export const StudentVisibleAssignmentStatusSchema = z.enum([
  'OPEN',
  'SUBMITTED',
  'PUBLISHED',
]);

export type StudentVisibleAssignmentStatus = z.infer<
  typeof StudentVisibleAssignmentStatusSchema
>;

export const StudentAssignmentSchema = AssignmentSchema.extend({
  visibleStatus: StudentVisibleAssignmentStatusSchema,
  submittedAt: z.string().nullable().optional(),
  hasSubmission: z.boolean(),
  hasPublishedResult: z.boolean(),
  canSubmit: z.boolean(),
  canResubmit: z.boolean(),
});

export type StudentAssignment = z.infer<typeof StudentAssignmentSchema>;

export const StudentAssignmentSubmissionStateSchema = z.enum([
  'NOT_SUBMITTED',
  'SUBMITTED',
  'PUBLISHED',
]);

export type StudentAssignmentSubmissionState = z.infer<
  typeof StudentAssignmentSubmissionStateSchema
>;

export const StudentAssignmentStatusSchema = z.object({
  version: z.literal('1.0.0'),
  assignmentId: z.string(),
  courseId: z.string(),
  courseTitle: z.string(),
  assignmentTitle: z.string(),
  openAt: z.string(),
  deadlineAt: z.string(),
  assignmentState: AssignmentStateSchema,
  visibleStatus: StudentVisibleAssignmentStatusSchema,
  submissionState: StudentAssignmentSubmissionStateSchema,
  submittedAt: z.string().nullable().optional(),
  hasPublishedResult: z.boolean(),
  publishedAt: z.string().nullable().optional(),
  score: z.number().nullable().optional(),
  maxScore: z.number().nullable().optional(),
});

export type StudentAssignmentStatus = z.infer<typeof StudentAssignmentStatusSchema>;

export const StudentAssignmentResultSchema = StudentAssignmentStatusSchema.extend({
  publishedResultId: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  breakdownSnapshot: z.unknown().nullable().optional(),
});

export type StudentAssignmentResult = z.infer<typeof StudentAssignmentResultSchema>;

export const PublishEligibilitySchema = z.enum([
  'NOT_READY',
  'READY',
  'PUBLISHED',
]);

export type PublishEligibility = z.infer<typeof PublishEligibilitySchema>;

export const StaffReviewPublicationSummarySchema = z.object({
  isPublished: z.boolean(),
  publishedResultId: z.string().nullable().optional(),
  publishedAt: z.string().nullable().optional(),
  score: z.number().nullable().optional(),
  maxScore: z.number().nullable().optional(),
  summary: z.string().nullable().optional(),
});

export type StaffReviewPublicationSummary = z.infer<
  typeof StaffReviewPublicationSummarySchema
>;

export const StaffDashboardAssignmentRowSchema = z.object({
  version: z.literal('1.0.0'),
  courseId: z.string(),
  courseTitle: z.string(),
  assignmentId: z.string(),
  assignmentTitle: z.string(),
  assignmentState: AssignmentStateSchema,
  openAt: z.string(),
  deadlineAt: z.string(),
  totalActiveStudents: z.number().int().nonnegative(),
  notSubmittedCount: z.number().int().nonnegative(),
  submittedCount: z.number().int().nonnegative(),
  processingCount: z.number().int().nonnegative(),
  readyForReviewCount: z.number().int().nonnegative(),
  publishedCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  publishableCount: z.number().int().nonnegative(),
  republishNeededCount: z.number().int().nonnegative(),
  latestActivityAt: z.string(),
});

export type StaffDashboardAssignmentRow = z.infer<
  typeof StaffDashboardAssignmentRowSchema
>;

export const AssignmentSubmissionOpsRowSchema = z.object({
  version: z.literal('1.0.0'),
  courseId: z.string(),
  assignmentId: z.string(),
  submissionId: z.string(),
  studentUserId: z.string(),
  studentDisplayName: z.string().nullable(),
  studentEmail: z.string().nullable(),
  submittedAt: z.string(),
  operationalStatus: OperationalSubmissionStatusSchema,
  publishEligibility: PublishEligibilitySchema,
  republishNeeded: z.boolean(),
  jobId: z.string().nullable(),
  reviewUpdatedAt: z.string().nullable().optional(),
  publishedAt: z.string().nullable().optional(),
  score: z.number().nullable().optional(),
  maxScore: z.number().nullable().optional(),
});

export type AssignmentSubmissionOpsRow = z.infer<
  typeof AssignmentSubmissionOpsRowSchema
>;

export const AssignmentSubmissionOpsRawStatusesSchema = z.object({
  assignmentState: AssignmentStateSchema,
  submissionState: z.string().nullable().optional(),
  jobStatus: z.string().nullable().optional(),
  reviewState: z.string().nullable().optional(),
});

export type AssignmentSubmissionOpsRawStatuses = z.infer<
  typeof AssignmentSubmissionOpsRawStatusesSchema
>;

export const AssignmentSubmissionOpsDetailSchema =
  AssignmentSubmissionOpsRowSchema.extend({
    courseTitle: z.string(),
    assignmentTitle: z.string(),
    reviewLink: z.string().nullable(),
    submissionDownloadLink: z.string(),
    publication: StaffReviewPublicationSummarySchema.optional(),
    rawStatuses: AssignmentSubmissionOpsRawStatusesSchema,
  });

export type AssignmentSubmissionOpsDetail = z.infer<
  typeof AssignmentSubmissionOpsDetailSchema
>;

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
