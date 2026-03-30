import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  CourseNotFoundError,
  IndexNotBuiltError,
  PrismaCourseRagStore,
} from '../src/queries/course-rag-store';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dirPath) => fs.rm(dirPath, { recursive: true, force: true }))
  );
});

const createTempDir = async () => {
  const dirPath = await fs.mkdtemp(path.join(os.tmpdir(), 'hg-postgres-course-rag-'));
  tempDirs.push(dirPath);
  return dirPath;
};

const selectFields = (row: Record<string, any>, select?: Record<string, any>): Record<string, any> => {
  if (!select) {
    return row;
  }

  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(select)) {
    if (!value) {
      continue;
    }

    if (typeof value === 'object' && row[key] && typeof row[key] === 'object') {
      result[key] = selectFields(row[key], value.select);
      continue;
    }

    result[key] = row[key];
  }

  return result;
};

const createFakeRagPersistence = (args: {
  courses: Array<{ id: string; domainId: string }>;
  lectures: Array<{
    id: string;
    domainId: string;
    courseId: string;
    title: string;
    sourceType: 'TEXT' | 'MARKDOWN' | 'TRANSCRIPT_VTT' | 'TRANSCRIPT_SRT';
    externalUrl?: string | null;
    assetPath: string;
    createdAt?: Date;
  }>;
}) => {
  const courseRowsByDomainId = new Map<string, Record<string, any>>();
  const lectureRowsById = new Map<string, Record<string, any>>();
  const ragIndexRowsByCourseId = new Map<string, Record<string, any>>();
  const ragIndexRowsById = new Map<string, Record<string, any>>();
  const ragChunkRows = new Map<string, Record<string, any>>();
  let indexSequence = 0;
  let chunkSequence = 0;

  for (const course of args.courses) {
    courseRowsByDomainId.set(course.domainId, {
      id: course.id,
      domainId: course.domainId,
    });
  }

  for (const lecture of args.lectures) {
    lectureRowsById.set(lecture.id, {
      id: lecture.id,
      domainId: lecture.domainId,
      courseId: lecture.courseId,
      title: lecture.title,
      sourceType: lecture.sourceType,
      externalUrl: lecture.externalUrl ?? null,
      createdAt: lecture.createdAt ?? new Date(),
      asset: {
        path: lecture.assetPath,
      },
    });
  }

  const course = {
    async findUnique(args: { where: Record<string, any>; select?: Record<string, any> }) {
      const row =
        typeof args.where.domainId === 'string'
          ? courseRowsByDomainId.get(args.where.domainId) ?? null
          : null;
      return row ? selectFields(row, args.select) : null;
    },
  };

  const lecture = {
    async findMany(args: { where: Record<string, any>; select?: Record<string, any>; orderBy?: Record<string, 'asc' | 'desc'> }) {
      const rows = [...lectureRowsById.values()]
        .filter((row) => row.courseId === args.where.courseId)
        .sort((left, right) => {
          const leftTime = (left.createdAt as Date).getTime();
          const rightTime = (right.createdAt as Date).getTime();
          return args.orderBy?.createdAt === 'asc' ? leftTime - rightTime : rightTime - leftTime;
        });

      return rows.map((row) => selectFields(row, args.select));
    },
  };

  const courseRagIndex = {
    async findUnique(args: { where: Record<string, any>; select?: Record<string, any> }) {
      let row: Record<string, any> | null = null;

      if (typeof args.where.courseId === 'string') {
        row = ragIndexRowsByCourseId.get(args.where.courseId) ?? null;
      } else if (typeof args.where.id === 'string') {
        row = ragIndexRowsById.get(args.where.id) ?? null;
      }

      return row ? selectFields(row, args.select) : null;
    },
    async create(args: { data: Record<string, any>; select?: Record<string, any> }) {
      const row = {
        id: `rag-index-${++indexSequence}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...args.data,
      };
      ragIndexRowsByCourseId.set(String(row.courseId), row);
      ragIndexRowsById.set(String(row.id), row);
      return selectFields(row, args.select);
    },
    async update(args: { where: Record<string, any>; data: Record<string, any>; select?: Record<string, any> }) {
      const current = ragIndexRowsById.get(String(args.where.id));
      if (!current) {
        throw new Error('rag index not found');
      }

      const row = {
        ...current,
        ...args.data,
        updatedAt: new Date(),
      };
      ragIndexRowsByCourseId.set(String(row.courseId), row);
      ragIndexRowsById.set(String(row.id), row);
      return selectFields(row, args.select);
    },
  };

  const courseRagChunk = {
    async deleteMany(args: { where: Record<string, any> }) {
      for (const [id, row] of [...ragChunkRows.entries()]) {
        if (row.indexId === args.where.indexId) {
          ragChunkRows.delete(id);
        }
      }
    },
    async create(args: { data: Record<string, any> }) {
      const row = {
        id: `rag-chunk-${++chunkSequence}`,
        createdAt: new Date(),
        ...args.data,
      };
      ragChunkRows.set(String(row.id), row);
      return row;
    },
    async findMany(args: { where: Record<string, any>; select?: Record<string, any> }) {
      const rows = [...ragChunkRows.values()]
        .filter((row) => row.courseId === args.where.courseId)
        .sort((left, right) => Number(left.order) - Number(right.order));

      return rows.map((row) => {
        const lectureRow = lectureRowsById.get(String(row.lectureId));
        return selectFields(
          {
            ...row,
            lecture: lectureRow
              ? {
                  domainId: lectureRow.domainId,
                  title: lectureRow.title,
                  externalUrl: lectureRow.externalUrl,
                }
              : null,
          },
          args.select
        );
      });
    },
  };

  const prisma = {
    course,
    lecture,
    courseRagIndex,
    courseRagChunk,
    async $transaction<T>(callback: (tx: any) => Promise<T>) {
      return callback({
        courseRagIndex,
        courseRagChunk,
      });
    },
  };

  return prisma;
};

describe('PrismaCourseRagStore', () => {
  it('rebuilds the lexical index in Postgres and serves manifest/query/suggest from DB-backed rows', async () => {
    const tempDir = await createTempDir();
    const lectureTextPath = path.join(tempDir, 'lecture-1.md');
    const transcriptPath = path.join(tempDir, 'lecture-2.vtt');

    await fs.writeFile(
      lectureTextPath,
      'Matrix diagonalization relies on eigenvalues and eigenvectors.\n\nUse a basis of eigenvectors whenever possible.',
      'utf-8'
    );
    await fs.writeFile(
      transcriptPath,
      ['WEBVTT', '', '00:00:01.000 --> 00:00:05.000', 'Diagonalization review and eigenvalue intuition.'].join('\n'),
      'utf-8'
    );

    const prisma = createFakeRagPersistence({
      courses: [{ id: 'course-row-1', domainId: 'course-1' }],
      lectures: [
        {
          id: 'lecture-row-1',
          domainId: 'lecture-1',
          courseId: 'course-row-1',
          title: 'Linear Algebra Notes',
          sourceType: 'MARKDOWN',
          assetPath: lectureTextPath,
          createdAt: new Date('2026-03-29T10:00:00.000Z'),
        },
        {
          id: 'lecture-row-2',
          domainId: 'lecture-2',
          courseId: 'course-row-1',
          title: 'Lecture Recording',
          sourceType: 'TRANSCRIPT_VTT',
          externalUrl: 'https://youtube.com/watch?v=abc123',
          assetPath: transcriptPath,
          createdAt: new Date('2026-03-29T09:00:00.000Z'),
        },
      ],
    });

    const store = new PrismaCourseRagStore(prisma as any);
    const rebuilt = await store.rebuildCourseRagIndex('course-1');

    expect(rebuilt.lectureCount).toBe(2);
    expect(rebuilt.chunkCount).toBeGreaterThan(0);
    expect(rebuilt.manifest.chunkCount).toBe(rebuilt.chunkCount);

    const manifest = await store.getCourseRagManifest('course-1');
    expect(manifest).toMatchObject({
      courseId: 'course-1',
      lectureCount: 2,
      chunkCount: rebuilt.chunkCount,
      chunking: {
        maxChars: 1200,
        overlapChars: 200,
      },
    });

    const queryResult = await store.queryCourseIndex('course-1', {
      query: 'eigenvalues diagonalization',
      k: 3,
    });
    expect(queryResult.method).toBe('lexical_v1');
    expect(queryResult.hits[0]?.courseId).toBe('course-1');
    expect(['lecture-1', 'lecture-2']).toContain(queryResult.hits[0]?.lectureId);
    expect(['Linear Algebra Notes', 'Lecture Recording']).toContain(queryResult.hits[0]?.lectureTitle);

    const suggestions = await store.suggestStudyPointers('course-1', {
      issueText: 'I am confused about eigenvalue intuition in diagonalization',
      k: 2,
    });
    expect(suggestions.pointers.length).toBeGreaterThan(0);
    expect(suggestions.pointers[0]).toMatchObject({
      courseId: 'course-1',
    });
    expect(
      suggestions.pointers.some(
        (pointer) => pointer.deepLink?.url === 'https://youtube.com/watch?v=abc123&t=1'
      )
    ).toBe(true);
  });

  it('returns null before an index is built and throws DB-native errors for missing courses or indexes', async () => {
    const tempDir = await createTempDir();
    const lectureTextPath = path.join(tempDir, 'lecture.md');
    await fs.writeFile(lectureTextPath, 'Short text lecture', 'utf-8');

    const prisma = createFakeRagPersistence({
      courses: [{ id: 'course-row-1', domainId: 'course-1' }],
      lectures: [
        {
          id: 'lecture-row-1',
          domainId: 'lecture-1',
          courseId: 'course-row-1',
          title: 'Intro',
          sourceType: 'TEXT',
          assetPath: lectureTextPath,
        },
      ],
    });

    const store = new PrismaCourseRagStore(prisma as any);

    await expect(store.getCourseRagManifest('missing-course')).rejects.toBeInstanceOf(CourseNotFoundError);
    await expect(store.queryCourseIndex('course-1', { query: 'intro' })).rejects.toBeInstanceOf(IndexNotBuiltError);
    await expect(store.suggestStudyPointers('course-1', { issueText: 'intro topic confusion' })).rejects.toBeInstanceOf(IndexNotBuiltError);
    await expect(store.getCourseRagManifest('course-1')).resolves.toBeNull();
  });
});
