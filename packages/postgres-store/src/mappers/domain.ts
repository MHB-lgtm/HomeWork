import {
  ActorKind,
  CourseMaterialKind as PrismaCourseMaterialKind,
  CourseStatus as PrismaCourseStatus,
  GradebookEntryStatus as PrismaGradebookEntryStatus,
  Prisma,
  PublishedResultStatus as PrismaPublishedResultStatus,
  ReviewState as PrismaReviewState,
  ReviewVersionKind as PrismaReviewVersionKind,
  StoredAssetStorageKind as PrismaStoredAssetStorageKind,
  SubmissionModuleType as PrismaSubmissionModuleType,
  SubmissionState as PrismaSubmissionState,
} from '@prisma/client';
import type {
  AssetRef,
  CourseMaterialKind,
  CourseStatus,
  GradebookEntryStatus,
  ModuleRef,
  PublishedResultStatus,
  ReviewState,
  ReviewVersionKind,
  StoredAssetMetadata,
  SubmissionState,
} from '@hg/domain-workflow';
import {
  createAssignmentModuleRef,
  createExamBatchModuleRef,
  createLegacyJobModuleRef,
} from '@hg/domain-workflow';

export const toDate = (value: string): Date => new Date(value);

export const toIsoString = (value: Date): string => value.toISOString();

export const decimalToNumber = (value: Prisma.Decimal | number | null | undefined): number | undefined => {
  if (value === null || value === undefined) {
    return undefined;
  }

  return typeof value === 'number' ? value : value.toNumber();
};

export const toPrismaDecimal = (value: number): Prisma.Decimal => new Prisma.Decimal(value);

export const asJsonValue = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

export const toPrismaCourseStatus = (status: CourseStatus): PrismaCourseStatus =>
  status === 'active' ? PrismaCourseStatus.ACTIVE : PrismaCourseStatus.ARCHIVED;

export const fromPrismaCourseStatus = (status: PrismaCourseStatus): CourseStatus =>
  status === PrismaCourseStatus.ACTIVE ? 'active' : 'archived';

export const toPrismaCourseMaterialKind = (
  kind: CourseMaterialKind
): PrismaCourseMaterialKind => {
  switch (kind) {
    case 'assignment_prompt':
      return PrismaCourseMaterialKind.ASSIGNMENT_PROMPT;
    case 'assignment_solution':
      return PrismaCourseMaterialKind.ASSIGNMENT_SOLUTION;
    case 'exam_original':
      return PrismaCourseMaterialKind.EXAM_ORIGINAL;
    case 'exam_model_solution':
      return PrismaCourseMaterialKind.EXAM_MODEL_SOLUTION;
    case 'submission_pdf':
      return PrismaCourseMaterialKind.SUBMISSION_PDF;
    case 'derived_artifact':
      return PrismaCourseMaterialKind.DERIVED_ARTIFACT;
    case 'export_bundle':
      return PrismaCourseMaterialKind.EXPORT_BUNDLE;
    case 'lecture_asset':
      return PrismaCourseMaterialKind.LECTURE_ASSET;
  }
};

export const fromPrismaCourseMaterialKind = (
  kind: PrismaCourseMaterialKind
): CourseMaterialKind => {
  switch (kind) {
    case PrismaCourseMaterialKind.ASSIGNMENT_PROMPT:
      return 'assignment_prompt';
    case PrismaCourseMaterialKind.ASSIGNMENT_SOLUTION:
      return 'assignment_solution';
    case PrismaCourseMaterialKind.EXAM_ORIGINAL:
      return 'exam_original';
    case PrismaCourseMaterialKind.EXAM_MODEL_SOLUTION:
      return 'exam_model_solution';
    case PrismaCourseMaterialKind.SUBMISSION_PDF:
      return 'submission_pdf';
    case PrismaCourseMaterialKind.DERIVED_ARTIFACT:
      return 'derived_artifact';
    case PrismaCourseMaterialKind.EXPORT_BUNDLE:
      return 'export_bundle';
    case PrismaCourseMaterialKind.LECTURE_ASSET:
      return 'lecture_asset';
  }
};

export const toPrismaSubmissionState = (state: SubmissionState): PrismaSubmissionState => {
  switch (state) {
    case 'uploaded':
      return PrismaSubmissionState.UPLOADED;
    case 'superseded':
      return PrismaSubmissionState.SUPERSEDED;
    case 'queued':
      return PrismaSubmissionState.QUEUED;
    case 'processed':
      return PrismaSubmissionState.PROCESSED;
    case 'lecturer_edited':
      return PrismaSubmissionState.LECTURER_EDITED;
    case 'published':
      return PrismaSubmissionState.PUBLISHED;
  }
};

export const fromPrismaSubmissionState = (state: PrismaSubmissionState): SubmissionState => {
  switch (state) {
    case PrismaSubmissionState.UPLOADED:
      return 'uploaded';
    case PrismaSubmissionState.SUPERSEDED:
      return 'superseded';
    case PrismaSubmissionState.QUEUED:
      return 'queued';
    case PrismaSubmissionState.PROCESSED:
      return 'processed';
    case PrismaSubmissionState.LECTURER_EDITED:
      return 'lecturer_edited';
    case PrismaSubmissionState.PUBLISHED:
      return 'published';
  }
};

export const toPrismaReviewState = (state: ReviewState): PrismaReviewState => {
  switch (state) {
    case 'draft':
      return PrismaReviewState.DRAFT;
    case 'ready_for_review':
      return PrismaReviewState.READY_FOR_REVIEW;
    case 'lecturer_edited':
      return PrismaReviewState.LECTURER_EDITED;
    case 'published':
      return PrismaReviewState.PUBLISHED;
  }
};

export const fromPrismaReviewState = (state: PrismaReviewState): ReviewState => {
  switch (state) {
    case PrismaReviewState.DRAFT:
      return 'draft';
    case PrismaReviewState.READY_FOR_REVIEW:
      return 'ready_for_review';
    case PrismaReviewState.LECTURER_EDITED:
      return 'lecturer_edited';
    case PrismaReviewState.PUBLISHED:
      return 'published';
  }
};

export const toPrismaReviewVersionKind = (
  kind: ReviewVersionKind
): PrismaReviewVersionKind => {
  switch (kind) {
    case 'ai_draft':
      return PrismaReviewVersionKind.AI_DRAFT;
    case 'lecturer_edit':
      return PrismaReviewVersionKind.LECTURER_EDIT;
    case 'published_snapshot':
      return PrismaReviewVersionKind.PUBLISHED_SNAPSHOT;
  }
};

export const fromPrismaReviewVersionKind = (
  kind: PrismaReviewVersionKind
): ReviewVersionKind => {
  switch (kind) {
    case PrismaReviewVersionKind.AI_DRAFT:
      return 'ai_draft';
    case PrismaReviewVersionKind.LECTURER_EDIT:
      return 'lecturer_edit';
    case PrismaReviewVersionKind.PUBLISHED_SNAPSHOT:
      return 'published_snapshot';
  }
};

export const toPrismaPublishedResultStatus = (
  status: PublishedResultStatus
): PrismaPublishedResultStatus =>
  status === 'effective'
    ? PrismaPublishedResultStatus.EFFECTIVE
    : PrismaPublishedResultStatus.SUPERSEDED;

export const fromPrismaPublishedResultStatus = (
  status: PrismaPublishedResultStatus
): PublishedResultStatus =>
  status === PrismaPublishedResultStatus.EFFECTIVE ? 'effective' : 'superseded';

export const toPrismaGradebookEntryStatus = (
  status: GradebookEntryStatus
): PrismaGradebookEntryStatus => {
  if (status !== 'effective') {
    throw new Error(`Unsupported gradebook entry status: ${status satisfies never}`);
  }

  return PrismaGradebookEntryStatus.EFFECTIVE;
};

export const fromPrismaGradebookEntryStatus = (
  status: PrismaGradebookEntryStatus
): GradebookEntryStatus => {
  if (status !== PrismaGradebookEntryStatus.EFFECTIVE) {
    throw new Error(`Unsupported stored gradebook entry status: ${status}`);
  }

  return 'effective';
};

export const moduleRefToStoredFields = (
  moduleRef: ModuleRef
): {
  moduleType: PrismaSubmissionModuleType;
  assignmentId: string | null;
  examBatchId: string | null;
} => {
  switch (moduleRef.kind) {
    case 'assignment':
      return {
        moduleType: PrismaSubmissionModuleType.ASSIGNMENT,
        assignmentId: moduleRef.assignmentId,
        examBatchId: null,
      };
    case 'exam_batch':
      return {
        moduleType: PrismaSubmissionModuleType.EXAM_BATCH,
        assignmentId: null,
        examBatchId: moduleRef.examBatchId,
      };
    case 'legacy_job':
      return {
        moduleType: PrismaSubmissionModuleType.LEGACY_JOB,
        assignmentId: null,
        examBatchId: null,
      };
  }
};

export const storedFieldsToModuleRef = (
  moduleType: PrismaSubmissionModuleType,
  assignmentId: string | null,
  examBatchId: string | null,
  legacyJobId?: string | null
): ModuleRef => {
  switch (moduleType) {
    case PrismaSubmissionModuleType.ASSIGNMENT:
      if (!assignmentId) {
        throw new Error('assignmentId is required for ASSIGNMENT moduleType');
      }
      return createAssignmentModuleRef(assignmentId);
    case PrismaSubmissionModuleType.EXAM_BATCH:
      if (!examBatchId) {
        throw new Error('examBatchId is required for EXAM_BATCH moduleType');
      }
      return createExamBatchModuleRef(examBatchId);
    case PrismaSubmissionModuleType.LEGACY_JOB:
      if (!legacyJobId) {
        throw new Error('legacyJobId is required for LEGACY_JOB moduleType');
      }
      return createLegacyJobModuleRef(legacyJobId);
  }
};

export const studentUserIdFromStudentRef = (studentRef: string): string | null =>
  studentRef.startsWith('user:') ? studentRef.slice('user:'.length) : null;

export const studentRefFromStoredValues = (studentUserId: string | null, fallbackId: string): string =>
  studentUserId ? `user:${studentUserId}` : `legacy-unresolved:${fallbackId}`;

export const actorRefFromStoredValues = (
  actorUserId: string | null,
  actorKind: ActorKind,
  actorRefRaw: string | null
): string | undefined => {
  if (actorUserId) {
    return `user:${actorUserId}`;
  }

  if (actorKind === ActorKind.AI) {
    return 'ai';
  }

  if (actorRefRaw) {
    return `legacy:${actorRefRaw}`;
  }

  return undefined;
};

export const toPrismaStoredAssetStorageKind = (
  storageKind: AssetRef['storageKind']
): PrismaStoredAssetStorageKind => {
  switch (storageKind) {
    case 'local_file':
      return PrismaStoredAssetStorageKind.LOCAL_FILE;
    case 'object_storage':
      return PrismaStoredAssetStorageKind.OBJECT_STORAGE;
    case 'unknown':
      return PrismaStoredAssetStorageKind.UNKNOWN;
  }
};

export const fromPrismaStoredAssetStorageKind = (
  storageKind: PrismaStoredAssetStorageKind
): StoredAssetMetadata['storageKind'] => {
  switch (storageKind) {
    case PrismaStoredAssetStorageKind.LOCAL_FILE:
      return 'local_file';
    case PrismaStoredAssetStorageKind.OBJECT_STORAGE:
      return 'object_storage';
    case PrismaStoredAssetStorageKind.UNKNOWN:
      return 'unknown';
  }
};
