import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { PrismaExamStore } from '../src';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dirPath) => fs.rm(dirPath, { recursive: true, force: true }))
  );
});

const createTempDir = async () => {
  const dirPath = await fs.mkdtemp(path.join(os.tmpdir(), 'hg-postgres-exam-store-'));
  tempDirs.push(dirPath);
  return dirPath;
};

const createFakeExamPersistence = () => {
  const assetRows = new Map<string, Record<string, unknown>>();
  const examRows = new Map<string, Record<string, unknown>>();
  const examRowsById = new Map<string, Record<string, unknown>>();
  let assetSequence = 0;
  let examSequence = 0;

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

  const storedAsset = {
    async create(args: { data: Record<string, unknown>; select?: Record<string, any> }) {
      const row = {
        id: `asset-row-${++assetSequence}`,
        ...args.data,
      };
      assetRows.set(String(row.id), row);
      return selectFields(row, args.select);
    },
  };

  const exam = {
    async create(args: { data: Record<string, unknown>; include?: Record<string, any> }) {
      const row = {
        id: `exam-row-${++examSequence}`,
        createdAt: args.data.createdAt ?? new Date(),
        updatedAt: args.data.updatedAt ?? new Date(),
        ...args.data,
      };
      examRows.set(String(row.domainId), row);
      examRowsById.set(String(row.id), row);
      const asset = assetRows.get(String(row.assetId));
      return args.include?.asset
        ? { ...row, asset: selectFields(asset ?? {}, args.include.asset.select) }
        : row;
    },
    async findFirst(args: {
      where?: Record<string, any>;
      include?: Record<string, any>;
    }) {
      const rows = await exam.findMany({
        where: args.where,
        include: args.include,
      });
      return rows[0] ?? null;
    },
    async findMany(args?: {
      where?: Record<string, any>;
      include?: Record<string, any>;
      orderBy?: Record<string, 'asc' | 'desc'>;
    }) {
      let rows = [...examRows.values()];
      if (args?.where?.assignmentBacking?.is === null) {
        rows = rows.filter((row) => row.assignmentBacking == null);
      }
      if (typeof args?.where?.domainId === 'string') {
        rows = rows.filter((row) => row.domainId === args.where.domainId);
      }
      if (args?.orderBy?.createdAt === 'desc') {
        rows.sort(
          (left, right) => (right.createdAt as Date).getTime() - (left.createdAt as Date).getTime()
        );
      }

      return rows.map((row) => {
        const asset = assetRows.get(String(row.assetId));
        return args?.include?.asset
          ? { ...row, asset: selectFields(asset ?? {}, args.include.asset.select) }
          : row;
      });
    },
  };

  return {
    prisma: {
      exam,
      storedAsset,
      async $transaction(fn: (tx: any) => Promise<unknown>) {
        return fn({ exam, storedAsset });
      },
    },
    stores: {
      assetRows,
      examRows,
    },
  };
};

describe('PrismaExamStore', () => {
  it('lists and loads exams with bucket-relative examFilePath without needing HG_DATA_DIR', async () => {
    const { prisma, stores } = createFakeExamPersistence();
    const store = new PrismaExamStore(prisma as any);

    stores.assetRows.set('asset-row-existing', {
      id: 'asset-row-existing',
      logicalBucket: 'exams',
      path: 'C:\\data\\exams\\exam-1\\assets\\midterm.pdf',
    });
    stores.examRows.set('exam-1', {
      id: 'exam-row-existing',
      domainId: 'exam-1',
      title: 'Midterm 1',
      assetId: 'asset-row-existing',
      createdAt: new Date('2026-03-29T10:00:00.000Z'),
      updatedAt: new Date('2026-03-29T10:05:00.000Z'),
    });

    const listed = await store.listExams();
    const loaded = await store.getExam('exam-1');

    expect(listed).toHaveLength(1);
    expect(listed[0].examFilePath).toBe('exams/exam-1/assets/midterm.pdf');
    expect(loaded?.examFilePath).toBe('exams/exam-1/assets/midterm.pdf');
  });

  it('hides assignment-backed exams from the public exam list and detail lookups', async () => {
    const { prisma, stores } = createFakeExamPersistence();
    const store = new PrismaExamStore(prisma as any);

    stores.assetRows.set('asset-row-visible', {
      id: 'asset-row-visible',
      logicalBucket: 'exams',
      path: 'C:\\data\\exams\\exam-visible\\assets\\visible.pdf',
    });
    stores.examRows.set('exam-visible', {
      id: 'exam-row-visible',
      domainId: 'exam-visible',
      title: 'Visible Exam',
      assetId: 'asset-row-visible',
      createdAt: new Date('2026-03-29T10:00:00.000Z'),
      updatedAt: new Date('2026-03-29T10:05:00.000Z'),
      assignmentBacking: null,
    });

    stores.assetRows.set('asset-row-assignment', {
      id: 'asset-row-assignment',
      logicalBucket: 'exams',
      path: 'C:\\data\\exams\\exam-assignment\\assets\\assignment.pdf',
    });
    stores.examRows.set('exam-assignment', {
      id: 'exam-row-assignment',
      domainId: 'exam-assignment',
      title: 'Assignment Backing Exam',
      assetId: 'asset-row-assignment',
      createdAt: new Date('2026-03-30T10:00:00.000Z'),
      updatedAt: new Date('2026-03-30T10:05:00.000Z'),
      assignmentBacking: { id: 'assignment-row-1' },
    });

    const listed = await store.listExams();
    const hidden = await store.getExam('exam-assignment');

    expect(listed.map((exam) => exam.examId)).toEqual(['exam-visible']);
    expect(hidden).toBeNull();
  });

  it('creates an exam and returns the legacy-compatible relative examFilePath shape', async () => {
    const dataDir = await createTempDir();
    const { prisma } = createFakeExamPersistence();
    const store = new PrismaExamStore(prisma as any);

    const created = await store.createExam({
      dataDir,
      title: 'Midterm 1',
      originalName: 'midterm.pdf',
      buffer: Buffer.from('pdf-bytes'),
      mimeType: 'application/pdf',
    });

    expect(created.exam.examId).toMatch(/^exam-/);
    expect(created.exam.examFilePath).toMatch(
      new RegExp(`^exams/${created.exam.examId}/assets/midterm_.*\\.pdf$`)
    );
    expect(await fs.readFile(created.assetPath, 'utf-8')).toBe('pdf-bytes');
  });
});
