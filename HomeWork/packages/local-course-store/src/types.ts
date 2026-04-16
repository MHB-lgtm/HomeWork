import type {
  Course,
  Lecture,
  CourseChunk,
  RagManifest,
  StudyPointerV1,
  RagQueryRequestV1,
  ChunkHitV1,
} from '@hg/shared-schemas';

export type {
  Course,
  Lecture,
  CourseChunk,
  RagManifest,
  StudyPointerV1,
  RagQueryRequestV1,
  ChunkHitV1,
};

export class CourseNotFoundError extends Error {
  constructor(courseId: string) {
    super(`Course not found: ${courseId}`);
    this.name = 'CourseNotFoundError';
  }
}

export class LectureNotFoundError extends Error {
  constructor(courseId: string, lectureId: string) {
    super(`Lecture not found: courseId=${courseId}, lectureId=${lectureId}`);
    this.name = 'LectureNotFoundError';
  }
}

export class UnsupportedLectureTypeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedLectureTypeError';
  }
}

export class IndexNotBuiltError extends Error {
  code = 'INDEX_NOT_BUILT';
  constructor(courseId: string) {
    super(`Index not built for courseId=${courseId}`);
    this.name = 'IndexNotBuiltError';
  }
}

export interface CreateCourseParams {
  title: string;
}

export interface UploadLectureParams {
  courseId: string;
  title: string;
  originalName: string;
  buffer: Buffer;
  contentType?: string;
}

export interface RebuildIndexResult {
  manifest: RagManifest;
  chunkCount: number;
  lectureCount: number;
}

export interface RagQueryOptions {
  query: string;
  k?: number;
  method?: 'lexical_v1';
}

export interface RagQueryResult {
  hits: ChunkHitV1[];
  method: 'lexical_v1';
}

export interface SuggestStudyPointersOptions {
  issueText: string;
  k?: number;
}

export interface SuggestStudyPointersResult {
  pointers: StudyPointerV1[];
}
