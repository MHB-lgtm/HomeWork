import * as fs from 'fs/promises';
import * as path from 'path';
import type { Lecture } from '@hg/shared-schemas';
import { LectureSchema } from '@hg/shared-schemas';
import { LectureSourceType, StoredAssetStorageKind, type PrismaClient } from '@prisma/client';
import { toIsoString } from '../mappers/domain';
import { getLectureAssetKey, getLectureMaterialDomainId } from '../mappers/import';
import { assertValidSrt, assertValidVtt } from '../utils/transcript';

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

const createLectureId = (): string =>
  `lecture-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

const toRelativeDataPath = (dataDir: string, filePath: string): string =>
  path.relative(dataDir, filePath).split(path.sep).join('/');

const toStoredSourceType = (
  sourceType: Lecture['sourceType']
): LectureSourceType => {
  switch (sourceType) {
    case 'text':
      return LectureSourceType.TEXT;
    case 'markdown':
      return LectureSourceType.MARKDOWN;
    case 'transcript_vtt':
      return LectureSourceType.TRANSCRIPT_VTT;
    case 'transcript_srt':
      return LectureSourceType.TRANSCRIPT_SRT;
  }
};

const fromStoredSourceType = (
  sourceType: LectureSourceType
): Lecture['sourceType'] => {
  switch (sourceType) {
    case LectureSourceType.TEXT:
      return 'text';
    case LectureSourceType.MARKDOWN:
      return 'markdown';
    case LectureSourceType.TRANSCRIPT_VTT:
      return 'transcript_vtt';
    case LectureSourceType.TRANSCRIPT_SRT:
      return 'transcript_srt';
  }
};

const inferSourceType = (
  originalName: string,
  contentType?: string
): Lecture['sourceType'] => {
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

const validateTranscript = (sourceType: Lecture['sourceType'], text: string) => {
  try {
    if (sourceType === 'transcript_vtt') {
      assertValidVtt(text);
      return;
    }

    if (sourceType === 'transcript_srt') {
      assertValidSrt(text);
      return;
    }
  } catch {
    throw new UnsupportedLectureTypeError('Invalid transcript format. Expected VTT/SRT timecodes.');
  }
};

const mapLectureRow = (row: {
  domainId: string;
  course: { domainId: string };
  title: string;
  sourceType: LectureSourceType;
  assetPath: string;
  externalUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}): Lecture =>
  LectureSchema.parse({
    version: '1.0.0',
    lectureId: row.domainId,
    courseId: row.course.domainId,
    title: row.title,
    sourceType: fromStoredSourceType(row.sourceType),
    assetPath: row.assetPath,
    externalUrl: row.externalUrl ?? undefined,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  });

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

export class PrismaLectureStore {
  constructor(
    private readonly prisma: Pick<
      PrismaClient,
      'course' | 'lecture' | 'storedAsset' | 'courseMaterial' | '$transaction'
    >
  ) {}

  async listLectures(courseId: string): Promise<Lecture[]> {
    const course = await this.prisma.course.findUnique({
      where: { domainId: courseId },
      select: { id: true },
    });

    if (!course) {
      throw new CourseNotFoundError(courseId);
    }

    const rows = await this.prisma.lecture.findMany({
      where: {
        courseId: course.id,
      },
      select: {
        domainId: true,
        title: true,
        sourceType: true,
        assetPath: true,
        externalUrl: true,
        createdAt: true,
        updatedAt: true,
        course: {
          select: {
            domainId: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return rows.map(mapLectureRow);
  }

  async getLecture(courseId: string, lectureId: string): Promise<Lecture> {
    const row = await this.prisma.lecture.findFirst({
      where: {
        domainId: lectureId,
        course: {
          domainId: courseId,
        },
      },
      select: {
        domainId: true,
        title: true,
        sourceType: true,
        assetPath: true,
        externalUrl: true,
        createdAt: true,
        updatedAt: true,
        course: {
          select: {
            domainId: true,
          },
        },
      },
    });

    if (!row) {
      throw new LectureNotFoundError(courseId, lectureId);
    }

    return mapLectureRow(row);
  }

  async createLecture(args: {
    dataDir: string;
    courseId: string;
    title: string;
    originalName: string;
    buffer: Buffer;
    contentType?: string;
    externalUrl?: string;
  }): Promise<{ lecture: Lecture; absoluteAssetPath: string }> {
    const title = args.title.trim();
    if (!title) {
      throw new Error('title is required');
    }

    const course = await this.prisma.course.findUnique({
      where: { domainId: args.courseId },
      select: { id: true, domainId: true },
    });

    if (!course) {
      throw new CourseNotFoundError(args.courseId);
    }

    const sourceType = inferSourceType(args.originalName, args.contentType);
    if (sourceType === 'transcript_vtt' || sourceType === 'transcript_srt') {
      validateTranscript(sourceType, args.buffer.toString('utf-8'));
    }

    const lectureId = createLectureId();
    const safeFileName = path.basename(args.originalName || `lecture-${lectureId}.txt`);
    const absoluteAssetPath = path.resolve(
      args.dataDir,
      'courses',
      course.domainId,
      'lectures',
      lectureId,
      'assets',
      safeFileName
    );
    const relativeAssetPath = toRelativeDataPath(args.dataDir, absoluteAssetPath);

    await fs.mkdir(path.dirname(absoluteAssetPath), { recursive: true });
    const tempAssetPath = `${absoluteAssetPath}.tmp`;
    await fs.writeFile(tempAssetPath, args.buffer);
    await fs.rename(tempAssetPath, absoluteAssetPath);

    try {
      const row = await this.prisma.$transaction(async (tx: any) => {
        const storedAsset = await tx.storedAsset.create({
          data: {
            assetKey: getLectureAssetKey(course.domainId, lectureId),
            storageKind: StoredAssetStorageKind.LOCAL_FILE,
            logicalBucket: 'course_lectures',
            path: absoluteAssetPath,
            mimeType: args.contentType || undefined,
            sizeBytes: args.buffer.byteLength,
            originalName: safeFileName,
            metadata: {
              relativeDataPath: relativeAssetPath,
            },
          },
          select: {
            id: true,
          },
        });

        const lecture = await tx.lecture.create({
          data: {
            domainId: lectureId,
            courseId: course.id,
            assetId: storedAsset.id,
            title,
            sourceType: toStoredSourceType(sourceType),
            assetPath: relativeAssetPath,
            externalUrl: args.externalUrl?.trim() || null,
          },
          select: {
            domainId: true,
            title: true,
            sourceType: true,
            assetPath: true,
            externalUrl: true,
            createdAt: true,
            updatedAt: true,
            course: {
              select: {
                domainId: true,
              },
            },
          },
        });

        await tx.courseMaterial.create({
          data: {
            domainId: getLectureMaterialDomainId(course.domainId, lectureId),
            courseId: course.id,
            assetId: storedAsset.id,
            kind: 'LECTURE_ASSET',
            title,
            createdAt: lecture.createdAt,
            updatedAt: lecture.updatedAt,
          },
        });

        return lecture;
      });

      return {
        lecture: mapLectureRow(row),
        absoluteAssetPath,
      };
    } catch (error) {
      await fs.rm(absoluteAssetPath, { force: true });
      throw error;
    }
  }
}
