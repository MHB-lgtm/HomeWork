import * as fs from 'fs/promises';
import * as path from 'path';
import { Lecture, LectureSchema } from '@hg/shared-schemas';
import {
  LectureNotFoundError,
  UnsupportedLectureTypeError,
  UploadLectureParams,
} from './types';
import { parseSrtToSegments, parseVttToSegments } from './utils/transcript';
import {
  ensureCourseDirs,
  getCourse,
  getDataDirOnce,
  resolveCourseDir,
  resolveLectureDir,
} from './fileCourseStore';

const SUPPORTED_MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown']);
const SUPPORTED_TEXT_EXTENSIONS = new Set(['.txt']);
const SUPPORTED_VTT_EXTENSIONS = new Set(['.vtt']);
const SUPPORTED_SRT_EXTENSIONS = new Set(['.srt']);
const MARKDOWN_CONTENT_TYPES = new Set([
  'text/markdown',
  'text/x-markdown',
  'application/markdown',
]);
const TEXT_CONTENT_TYPES = new Set(['text/plain']);
const VTT_CONTENT_TYPES = new Set(['text/vtt']);
const SRT_CONTENT_TYPES = new Set(['application/x-subrip', 'text/srt']);

const generateId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

const writeJsonAtomic = async (filePath: string, data: unknown): Promise<void> => {
  const tempFilePath = `${filePath}.tmp`;
  await fs.writeFile(tempFilePath, JSON.stringify(data, null, 2), 'utf-8');
  await fs.rename(tempFilePath, filePath);
};

const inferSourceType = (
  originalName: string,
  contentType?: string
): 'text' | 'markdown' | 'transcript_vtt' | 'transcript_srt' => {
  const ext = path.extname(originalName || '').toLowerCase();

  if (SUPPORTED_MARKDOWN_EXTENSIONS.has(ext)) {
    return 'markdown';
  }

  if (SUPPORTED_TEXT_EXTENSIONS.has(ext)) {
    return 'text';
  }

  if (SUPPORTED_VTT_EXTENSIONS.has(ext)) {
    return 'transcript_vtt';
  }

  if (SUPPORTED_SRT_EXTENSIONS.has(ext)) {
    return 'transcript_srt';
  }

  const normalizedContentType = contentType?.toLowerCase();
  if (normalizedContentType) {
    if (MARKDOWN_CONTENT_TYPES.has(normalizedContentType)) {
      return 'markdown';
    }
    if (TEXT_CONTENT_TYPES.has(normalizedContentType)) {
      return 'text';
    }
    if (VTT_CONTENT_TYPES.has(normalizedContentType)) {
      return 'transcript_vtt';
    }
    if (SRT_CONTENT_TYPES.has(normalizedContentType)) {
      return 'transcript_srt';
    }
  }

  throw new UnsupportedLectureTypeError(
    'Unsupported lecture file type. Acceptable extensions: .txt, .md, .markdown, .vtt, .srt'
  );
};

type UploadLectureParamsWithUrl = UploadLectureParams & { externalUrl?: string };

const validateTranscript = (sourceType: string, text: string) => {
  try {
    if (sourceType === 'transcript_vtt') {
      parseVttToSegments(text);
      return;
    }
    if (sourceType === 'transcript_srt') {
      parseSrtToSegments(text);
      return;
    }
  } catch (error) {
    throw new UnsupportedLectureTypeError('Invalid transcript format. Expected VTT/SRT timecodes.');
  }
};

export const uploadLecture = async (params: UploadLectureParamsWithUrl): Promise<{ lectureId: string }> => {
  const title = params.title.trim();
  if (!title) {
    throw new Error('title is required');
  }

  // Ensure course exists before writing files
  await getCourse(params.courseId);
  await ensureCourseDirs(params.courseId);

  const sourceType = inferSourceType(params.originalName, params.contentType);
  if (sourceType === 'transcript_vtt' || sourceType === 'transcript_srt') {
    const text = params.buffer.toString('utf-8');
    validateTranscript(sourceType, text);
  }
  const lectureId = generateId('lecture');
  const lectureDir = resolveLectureDir(params.courseId, lectureId);
  const assetsDir = path.join(lectureDir, 'assets');
  await fs.mkdir(assetsDir, { recursive: true });

  const safeFileName = path.basename(params.originalName || `lecture-${lectureId}.txt`);
  const assetPath = path.join(assetsDir, safeFileName);
  await fs.writeFile(assetPath, params.buffer);

  const dataDir = getDataDirOnce();
  const relativeAssetPath = path.relative(dataDir, assetPath);
  const now = new Date().toISOString();

  const lecture: Lecture = LectureSchema.parse({
    version: '1.0.0',
    lectureId,
    courseId: params.courseId,
    title,
    sourceType,
    assetPath: relativeAssetPath,
    externalUrl: params.externalUrl?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  });

  const lectureFilePath = path.join(lectureDir, 'lecture.json');
  await writeJsonAtomic(lectureFilePath, lecture);

  console.log(`[courses] uploaded lectureId=${lectureId} courseId=${params.courseId} sourceType=${sourceType}`);

  return { lectureId };
};

export const getLecture = async (courseId: string, lectureId: string): Promise<Lecture> => {
  const lectureFilePath = path.join(resolveLectureDir(courseId, lectureId), 'lecture.json');

  try {
    const content = await fs.readFile(lectureFilePath, 'utf-8');
    const parsed = JSON.parse(content);
    return LectureSchema.parse(parsed);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new LectureNotFoundError(courseId, lectureId);
    }
    throw error;
  }
};

export const listLectures = async (courseId: string): Promise<Lecture[]> => {
  // Ensure course exists (will throw if missing)
  await getCourse(courseId);

  const lecturesDir = path.join(resolveCourseDir(courseId), 'lectures');
  try {
    const lectureDirs = await fs.readdir(lecturesDir, { withFileTypes: true });
    const lectures: Lecture[] = [];

    for (const entry of lectureDirs) {
      if (!entry.isDirectory()) continue;
      const lectureId = entry.name;
      const lectureFilePath = path.join(resolveLectureDir(courseId, lectureId), 'lecture.json');

      try {
        const content = await fs.readFile(lectureFilePath, 'utf-8');
        const parsed = JSON.parse(content);
        const lecture = LectureSchema.parse(parsed);
        lectures.push(lecture);
      } catch (error) {
        // Skip invalid or unreadable lectures
        continue;
      }
    }

    lectures.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return lectures;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
};
