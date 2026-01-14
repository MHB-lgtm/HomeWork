export type {
  Course,
  Lecture,
  CourseChunk,
  RagManifest,
  CreateCourseParams,
  UploadLectureParams,
  RebuildIndexResult,
  RagQueryOptions,
  RagQueryResult,
  SuggestStudyPointersOptions,
  SuggestStudyPointersResult,
} from './types';

export {
  CourseNotFoundError,
  LectureNotFoundError,
  UnsupportedLectureTypeError,
  IndexNotBuiltError,
} from './types';

export {
  ensureCourseDirs,
  getCourse,
  listCourses,
  createCourse,
  resolveCourseDir,
  resolveLectureDir,
  resolveRagDir,
  getDataDirOnce,
} from './fileCourseStore';

export {
  uploadLecture,
  listLectures,
  getLecture,
} from './fileLectureStore';

export {
  rebuildCourseIndex,
  loadRagManifest,
  rebuildCourseRagIndex,
  getCourseRagManifest,
  queryCourseIndex,
  suggestStudyPointers,
} from './fileCourseRagIndex';
