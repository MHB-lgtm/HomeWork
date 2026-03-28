import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  PrismaCourseStore,
  PrismaLectureStore,
  PostgresUnsupportedLectureTypeError,
  materializeCourseCompatibility,
} from '../src';
import { PLACEHOLDER_COURSE_DOMAIN_ID } from '../src/mappers/import';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dirPath) => fs.rm(dirPath, { recursive: true, force: true }))
  );
});

const createTempDir = async () => {
  const dirPath = await fs.mkdtemp(path.join(os.tmpdir(), 'hg-postgres-course-store-'));
  tempDirs.push(dirPath);
  return dirPath;
};

const selectFields = (
  row: Record<string, unknown>,
  select?: Record<string, any>
): Record<string, unknown> => {
  if (!select) {
    return row;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(select)) {
    if (!value) {
      continue;
    }

    if (typeof value === 'object' && row[key] && typeof row[key] === 'object') {
      result[key] = selectFields(row[key] as Record<string, unknown>, value.select);
      continue;
    }

    result[key] = row[key];
  }

  return result;
};

const createFakeCoursePersistence = () => {
  const courseRows = new Map<string, Record<string, unknown>>();
  const courseRowsById = new Map<string, Record<string, unknown>>();
  const storedAssetRows = new Map<string, Record<string, unknown>>();
  const lectureRows = new Map<string, Record<string, unknown>>();
  const lectureRowsById = new Map<string, Record<string, unknown>>();
  const courseMaterialRows = new Map<string, Record<string, unknown>>();

  let courseSequence = 0;
  let assetSequence = 0;
  let lectureSequence = 0;
  let materialSequence = 0;

  const course = {
    async create(args: { data: Record<string, unknown>; select?: Record<string, any> }) {
      const now = new Date();
      const row = {
        id: `course-row-${++courseSequence}`,
        createdAt: now,
        updatedAt: now,
        ...args.data,
      };
      courseRows.set(String(row.domainId), row);
      courseRowsById.set(String(row.id), row);
      return selectFields(row, args.select);
    },
    async findUnique(args: { where: Record<string, unknown>; select?: Record<string, any> }) {
      let row: Record<string, unknown> | null = null;
      if (typeof args.where.domainId === 'string') {
        row = courseRows.get(args.where.domainId) ?? null;
      } else if (typeof args.where.id === 'string') {
        row = courseRowsById.get(args.where.id) ?? null;
      }

      return row ? selectFields(row, args.select) : null;
    },
    async findMany(args?: { where?: Record<string, any>; select?: Record<string, any> }) {
      let rows = [...courseRows.values()];
      const excludedDomainId = args?.where?.domainId?.not;
      if (typeof excludedDomainId === 'string') {
        rows = rows.filter((row) => row.domainId !== excludedDomainId);
      }

      rows.sort((left, right) =>
        (right.createdAt as Date).getTime() - (left.createdAt as Date).getTime()
      );

      return rows.map((row) => selectFields(row, args?.select));
    },
  };

  const storedAsset = {
    async create(args: { data: Record<string, unknown>; select?: Record<string, any> }) {
      const row = {
        id: `asset-row-${++assetSequence}`,
        ...args.data,
      };
      storedAssetRows.set(String(row.id), row);
      return selectFields(row, args.select);
    },
  };

  const lecture = {
    async create(args: { data: Record<string, unknown>; select?: Record<string, any> }) {
      const row = {
        id: `lecture-row-${++lectureSequence}`,
        createdAt: args.data.createdAt ?? new Date(),
        updatedAt: args.data.updatedAt ?? new Date(),
        ...args.data,
      };
      lectureRows.set(String(row.domainId), row);
      lectureRowsById.set(String(row.id), row);
      const courseRow = courseRowsById.get(String(row.courseId));
      return selectFields(
        {
          ...row,
          course: { domainId: courseRow?.domainId },
        },
        args.select
      );
    },
    async update(args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
      select?: Record<string, any>;
    }) {
      const current = lectureRowsById.get(String(args.where.id));
      if (!current) {
        throw new Error('lecture row not found');
      }

      const row = { ...current, ...args.data };
      lectureRows.set(String(row.domainId), row);
      lectureRowsById.set(String(row.id), row);
      const courseRow = courseRowsById.get(String(row.courseId));
      return selectFields(
        {
          ...row,
          course: { domainId: courseRow?.domainId },
        },
        args.select
      );
    },
    async findUnique(args: { where: Record<string, unknown>; select?: Record<string, any> }) {
      let row: Record<string, unknown> | null = null;
      if (typeof args.where.domainId === 'string') {
        row = lectureRows.get(args.where.domainId) ?? null;
      } else if (typeof args.where.id === 'string') {
        row = lectureRowsById.get(args.where.id) ?? null;
      }

      if (!row) {
        return null;
      }

      const courseRow = courseRowsById.get(String(row.courseId));
      return selectFields(
        {
          ...row,
          course: { domainId: courseRow?.domainId },
        },
        args.select
      );
    },
    async findFirst(args: { where: Record<string, any>; select?: Record<string, any> }) {
      const row =
        [...lectureRows.values()].find((candidate) => {
          const matchesDomain =
            !args.where.domainId || candidate.domainId === args.where.domainId;
          const courseRow = courseRowsById.get(String(candidate.courseId));
          const matchesCourse =
            !args.where.course?.domainId || courseRow?.domainId === args.where.course.domainId;
          return matchesDomain && matchesCourse;
        }) ?? null;

      if (!row) {
        return null;
      }

      const courseRow = courseRowsById.get(String(row.courseId));
      return selectFields(
        {
          ...row,
          course: { domainId: courseRow?.domainId },
        },
        args.select
      );
    },
    async findMany(args: { where: Record<string, any>; select?: Record<string, any> }) {
      const rows = [...lectureRows.values()]
        .filter((candidate) => candidate.courseId === args.where.courseId)
        .sort(
          (left, right) =>
            (right.createdAt as Date).getTime() - (left.createdAt as Date).getTime()
        );

      return rows.map((row) => {
        const courseRow = courseRowsById.get(String(row.courseId));
        return selectFields(
          {
            ...row,
            course: { domainId: courseRow?.domainId },
          },
          args.select
        );
      });
    },
  };

  const courseMaterial = {
    async create(args: { data: Record<string, unknown>; select?: Record<string, any> }) {
      const row = {
        id: `material-row-${++materialSequence}`,
        ...args.data,
      };
      courseMaterialRows.set(String(row.domainId), row);
      return selectFields(row, args.select);
    },
  };

  return {
    prisma: {
      course,
      storedAsset,
      lecture,
      courseMaterial,
      async $transaction(fn: (tx: any) => Promise<unknown>) {
        return fn({ course, storedAsset, lecture, courseMaterial });
      },
    },
    stores: {
      courseRows,
      storedAssetRows,
      lectureRows,
      courseMaterialRows,
    },
  };
};

describe('PrismaCourseStore', () => {
  it('creates and lists courses while excluding the legacy placeholder course', async () => {
    const { prisma } = createFakeCoursePersistence();
    const store = new PrismaCourseStore(prisma as any);

    await prisma.course.create({
      data: {
        domainId: PLACEHOLDER_COURSE_DOMAIN_ID,
        title: 'Placeholder',
        status: 'ARCHIVED',
      },
    });

    const created = await store.createCourse({ title: 'Signals 101' });
    const listed = await store.listCourses();
    const loaded = await store.getCourse(created.courseId);

    expect(created.title).toBe('Signals 101');
    expect(listed).toHaveLength(1);
    expect(listed[0].courseId).toBe(created.courseId);
    expect(loaded?.courseId).toBe(created.courseId);
  });
});

describe('PrismaLectureStore', () => {
  it('creates, loads, and lists lectures with the legacy-compatible relative asset path', async () => {
    const dataDir = await createTempDir();
    const { prisma, stores } = createFakeCoursePersistence();
    const courseStore = new PrismaCourseStore(prisma as any);
    const lectureStore = new PrismaLectureStore(prisma as any);

    const course = await courseStore.createCourse({ title: 'Signals 101' });
    const created = await lectureStore.createLecture({
      dataDir,
      courseId: course.courseId,
      title: 'Lecture 1',
      originalName: 'lecture.md',
      buffer: Buffer.from('# Hello', 'utf-8'),
      contentType: 'text/markdown',
      externalUrl: 'https://example.com/watch?v=1',
    });

    const listed = await lectureStore.listLectures(course.courseId);
    const loaded = await lectureStore.getLecture(course.courseId, created.lecture.lectureId);

    expect(created.lecture.assetPath).toMatch(
      new RegExp(`^courses/${course.courseId}/lectures/${created.lecture.lectureId}/assets/lecture\\.md$`)
    );
    expect(await fs.readFile(created.absoluteAssetPath, 'utf-8')).toBe('# Hello');
    expect(listed).toHaveLength(1);
    expect(loaded.externalUrl).toBe('https://example.com/watch?v=1');
    expect(stores.storedAssetRows.size).toBe(1);
    expect(stores.courseMaterialRows.size).toBe(1);
    expect(stores.lectureRows.size).toBe(1);
  });

  it('rejects invalid transcript uploads with the existing 415-compatible validation message', async () => {
    const dataDir = await createTempDir();
    const { prisma } = createFakeCoursePersistence();
    const courseStore = new PrismaCourseStore(prisma as any);
    const lectureStore = new PrismaLectureStore(prisma as any);

    const course = await courseStore.createCourse({ title: 'Signals 101' });

    await expect(
      lectureStore.createLecture({
        dataDir,
        courseId: course.courseId,
        title: 'Broken Transcript',
        originalName: 'broken.vtt',
        buffer: Buffer.from('not-a-vtt', 'utf-8'),
        contentType: 'text/vtt',
      })
    ).rejects.toBeInstanceOf(PostgresUnsupportedLectureTypeError);
  });
});

describe('course compatibility materialization', () => {
  it('throws a typed compatibility export error when the filesystem target cannot be created', async () => {
    const dataDir = await createTempDir();
    await fs.writeFile(path.join(dataDir, 'courses'), 'blocked', 'utf-8');

    await expect(
      materializeCourseCompatibility({
        dataDir,
        course: {
          version: '1.0.0',
          courseId: 'course-1',
          title: 'Signals 101',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      })
    ).rejects.toMatchObject({
      code: 'COMPAT_EXPORT_FAILED',
      entityType: 'course',
      entityId: 'course-1',
    });
  });
});
