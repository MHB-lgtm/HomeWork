import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { PrismaAssignmentStore } from '../src';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dirPath) => fs.rm(dirPath, { recursive: true, force: true }))
  );
});

const createTempDir = async () => {
  const dirPath = await fs.mkdtemp(path.join(os.tmpdir(), 'hg-postgres-assignment-store-'));
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

    if (typeof value === 'object' && value.select && row[key] && typeof row[key] === 'object') {
      if (Array.isArray(row[key])) {
        result[key] = (row[key] as Array<Record<string, unknown>>).map((entry) =>
          selectFields(entry, value.select)
        );
      } else {
        result[key] = selectFields(row[key] as Record<string, unknown>, value.select);
      }
      continue;
    }

    result[key] = row[key];
  }

  return result;
};

const createFakeAssignmentPrisma = () => {
  const courseRows = new Map<string, Record<string, unknown>>();
  const courseRowsById = new Map<string, Record<string, unknown>>();
  const weekRows = new Map<string, Record<string, unknown>>();
  const assetRows = new Map<string, Record<string, unknown>>();
  const examRows = new Map<string, Record<string, unknown>>();
  const examRowsById = new Map<string, Record<string, unknown>>();
  const materialRows = new Map<string, Record<string, unknown>>();
  const materialRowsById = new Map<string, Record<string, unknown>>();
  const assignmentRows = new Map<string, Record<string, unknown>>();
  const assignmentRowsById = new Map<string, Record<string, unknown>>();
  const assignmentMaterialRows = new Map<string, Record<string, unknown>>();
  const membershipRows = new Map<string, Record<string, unknown>>();

  let courseSequence = 0;
  let weekSequence = 0;
  let assetSequence = 0;
  let examSequence = 0;
  let materialSequence = 0;
  let assignmentSequence = 0;
  let assignmentMaterialSequence = 0;
  let membershipSequence = 0;

  const buildAssignmentRow = (row: Record<string, unknown>) => {
    const courseRow = courseRowsById.get(String(row.courseId));
    const weekRow = weekRows.get(String(row.weekId));
    const examRow =
      typeof row.examRowId === 'string' ? examRowsById.get(String(row.examRowId)) ?? null : null;
    const materials = [...assignmentMaterialRows.values()]
      .filter((entry) => entry.assignmentId === row.id)
      .map((entry) => {
        const material = materialRowsById.get(String(entry.materialId));
        const asset = material ? assetRows.get(String(material.assetId)) : null;
        return {
          role: entry.role,
          material: {
            ...material,
            asset,
          },
        };
      });

    return {
      ...row,
      course: courseRow
        ? {
            domainId: courseRow.domainId,
          }
        : null,
      week: weekRow
        ? {
            domainId: weekRow.domainId,
          }
        : null,
      exam: examRow
        ? {
            domainId: examRow.domainId,
            asset: examRow.assetId ? assetRows.get(String(examRow.assetId)) ?? null : null,
          }
        : null,
      materials,
    };
  };

  const courseHasMembership = (
    courseInternalId: string,
    membershipWhere: Record<string, any> | undefined
  ) => {
    if (!membershipWhere) {
      return true;
    }

    return [...membershipRows.values()].some(
      (membership) =>
        membership.courseId === courseInternalId &&
        membership.userId === membershipWhere.userId &&
        membership.role === membershipWhere.role &&
        membership.status === membershipWhere.status
    );
  };

  const course = {
    async findUnique(args: { where: Record<string, unknown>; select?: Record<string, any> }) {
      const row =
        typeof args.where.domainId === 'string'
          ? courseRows.get(String(args.where.domainId)) ?? null
          : typeof args.where.id === 'string'
            ? courseRowsById.get(String(args.where.id)) ?? null
            : null;

      return row ? selectFields(row, args.select) : null;
    },
  };

  const week = {
    async findUnique(args: { where: Record<string, unknown>; select?: Record<string, any> }) {
      const row =
        typeof args.where.domainId === 'string' ? weekRows.get(String(args.where.domainId)) ?? null : null;
      return row ? selectFields(row, args.select) : null;
    },
    async create(args: { data: Record<string, unknown>; select?: Record<string, any> }) {
      const row = {
        id: `week-row-${++weekSequence}`,
        ...args.data,
      };
      weekRows.set(String(row.domainId), row);
      return selectFields(row, args.select);
    },
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
    async update(args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
      select?: Record<string, any>;
    }) {
      const existing = assetRows.get(String(args.where.id));
      if (!existing) {
        throw new Error(`StoredAsset ${String(args.where.id)} not found`);
      }

      const updated = {
        ...existing,
        ...args.data,
      };
      assetRows.set(String(updated.id), updated);
      return selectFields(updated, args.select);
    },
  };

  const exam = {
    async create(args: { data: Record<string, unknown>; select?: Record<string, any> }) {
      const now = new Date();
      const row = {
        id: `exam-row-${++examSequence}`,
        createdAt: now,
        updatedAt: now,
        ...args.data,
      };
      examRows.set(String(row.domainId), row);
      examRowsById.set(String(row.id), row);
      return selectFields(row, args.select);
    },
    async update(args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
      select?: Record<string, any>;
    }) {
      const existing = examRowsById.get(String(args.where.id));
      if (!existing) {
        throw new Error(`Exam ${String(args.where.id)} not found`);
      }

      const updated = {
        ...existing,
        ...args.data,
        updatedAt: new Date(),
      };
      examRows.set(String(updated.domainId), updated);
      examRowsById.set(String(updated.id), updated);
      return selectFields(updated, args.select);
    },
  };

  const courseMaterial = {
    async create(args: { data: Record<string, unknown>; select?: Record<string, any> }) {
      const row = {
        id: `material-row-${++materialSequence}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...args.data,
      };
      materialRows.set(String(row.domainId), row);
      materialRowsById.set(String(row.id), row);
      return selectFields(row, args.select);
    },
    async update(args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
      select?: Record<string, any>;
    }) {
      const existing = materialRowsById.get(String(args.where.id));
      if (!existing) {
        throw new Error(`CourseMaterial ${String(args.where.id)} not found`);
      }

      const updated = {
        ...existing,
        ...args.data,
        updatedAt: new Date(),
      };
      materialRows.set(String(updated.domainId), updated);
      materialRowsById.set(String(updated.id), updated);
      return selectFields(updated, args.select);
    },
  };

  const assignmentMaterial = {
    async create(args: { data: Record<string, unknown> }) {
      const row = {
        id: `assignment-material-row-${++assignmentMaterialSequence}`,
        ...args.data,
      };
      assignmentMaterialRows.set(String(row.id), row);
      return row;
    },
  };

  const assignment = {
    async create(args: { data: Record<string, unknown>; select?: Record<string, any> }) {
      const now = new Date();
      const row = {
        id: `assignment-row-${++assignmentSequence}`,
        createdAt: now,
        updatedAt: now,
        ...args.data,
      };
      assignmentRows.set(String(row.domainId), row);
      assignmentRowsById.set(String(row.id), row);
      return selectFields(buildAssignmentRow(row), args.select);
    },
    async findUnique(args: { where: Record<string, unknown>; select?: Record<string, any> }) {
      const row =
        typeof args.where.domainId === 'string'
          ? assignmentRows.get(String(args.where.domainId)) ?? null
          : typeof args.where.id === 'string'
            ? assignmentRowsById.get(String(args.where.id)) ?? null
            : null;

      return row ? selectFields(buildAssignmentRow(row), args.select) : null;
    },
    async findMany(args: { where?: Record<string, any>; select?: Record<string, any> }) {
      let rows = [...assignmentRows.values()];

      if (typeof args.where?.courseId === 'string') {
        rows = rows.filter((row) => row.courseId === args.where.courseId);
      }

      if (args.where?.state?.not) {
        rows = rows.filter((row) => row.state !== args.where.state.not);
      }

      if (args.where?.openAt?.lte instanceof Date) {
        rows = rows.filter((row) => (row.openAt as Date) <= args.where.openAt.lte);
      }

      const membershipWhere = args.where?.course?.memberships?.some;
      if (membershipWhere) {
        rows = rows.filter((row) => courseHasMembership(String(row.courseId), membershipWhere));
      }

      rows.sort((left, right) => (left.openAt as Date).getTime() - (right.openAt as Date).getTime());
      return rows.map((row) => selectFields(buildAssignmentRow(row), args.select));
    },
    async findFirst(args: { where?: Record<string, any>; select?: Record<string, any> }) {
      const rows = await assignment.findMany(args);
      return rows[0] ?? null;
    },
    async update(args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
      select?: Record<string, any>;
    }) {
      const existing = assignmentRowsById.get(String(args.where.id));
      if (!existing) {
        throw new Error(`Assignment ${String(args.where.id)} not found`);
      }

      const updated = {
        ...existing,
        ...args.data,
        updatedAt: new Date(),
      };
      assignmentRows.set(String(updated.domainId), updated);
      assignmentRowsById.set(String(updated.id), updated);
      return selectFields(buildAssignmentRow(updated), args.select);
    },
  };

  return {
    prisma: {
      course,
      week,
      storedAsset,
      exam,
      courseMaterial,
      assignment,
      assignmentMaterial,
      courseMembership: {},
      async $transaction<T>(callback: (tx: any) => Promise<T>) {
        return callback({
          course,
          week,
          storedAsset,
          exam,
          courseMaterial,
          assignment,
          assignmentMaterial,
        });
      },
    },
    seedCourse(args?: { domainId?: string; title?: string }) {
      const now = new Date();
      const row = {
        id: `course-row-${++courseSequence}`,
        domainId: args?.domainId ?? `course-${courseSequence}`,
        title: args?.title ?? `Course ${courseSequence}`,
        createdAt: now,
        updatedAt: now,
      };
      courseRows.set(String(row.domainId), row);
      courseRowsById.set(String(row.id), row);
      return row;
    },
    seedStudentMembership(args: { courseId: string; userId: string; status?: 'ACTIVE' | 'SUSPENDED' }) {
      const course = courseRows.get(args.courseId);
      if (!course) {
        throw new Error(`Course ${args.courseId} not seeded`);
      }

      const row = {
        id: `membership-row-${++membershipSequence}`,
        courseId: course.id,
        userId: args.userId,
        role: 'STUDENT',
        status: args.status ?? 'ACTIVE',
      };
      membershipRows.set(String(row.id), row);
      return row;
    },
    stores: {
      weekRows,
      assetRows,
      examRows,
    },
  };
};

describe('PrismaAssignmentStore', () => {
  it('creates assignments with a default week and a backing exam source', async () => {
    const dataDir = await createTempDir();
    const fake = createFakeAssignmentPrisma();
    const course = fake.seedCourse({ domainId: 'course-algebra', title: 'Algebra' });
    const store = new PrismaAssignmentStore(fake.prisma as any);

    const assignment = await store.createAssignment({
      dataDir,
      courseId: course.domainId,
      title: 'Homework 1',
      openAt: '2026-03-30T08:00:00.000Z',
      deadlineAt: '2026-03-31T08:00:00.000Z',
      state: 'open',
      source: {
        originalName: 'assignment.pdf',
        buffer: Buffer.from('assignment-source-bytes'),
        mimeType: 'application/pdf',
      },
    });

    expect(assignment.courseId).toBe(course.domainId);
    expect(assignment.weekId).toBe(`week:${course.domainId}:default`);
    expect(assignment.state).toBe('open');
    expect(assignment.examId).toMatch(/^exam-/);
    expect(assignment.promptMaterialId).toBe(`assignment-material:${assignment.assignmentId}:prompt`);
    expect(assignment.solutionMaterialId).toBeUndefined();
    expect(fake.stores.weekRows.has(`week:${course.domainId}:default`)).toBe(true);
    expect(fake.stores.examRows.has(assignment.examId)).toBe(true);

    const assetPaths = [...fake.stores.assetRows.values()].map((row) => String(row.path));
    expect(assetPaths).toHaveLength(1);
    expect(assetPaths[0]).toContain(path.join('exams', assignment.examId, 'assets'));
    await expect(fs.readFile(assetPaths[0], 'utf-8')).resolves.toContain('assignment-source-bytes');
  });

  it('lists only assignments visible to active student memberships and exposes prompt assets', async () => {
    const dataDir = await createTempDir();
    const fake = createFakeAssignmentPrisma();
    const visibleCourse = fake.seedCourse({ domainId: 'course-visible', title: 'Visible' });
    const hiddenCourse = fake.seedCourse({ domainId: 'course-hidden', title: 'Hidden' });
    fake.seedStudentMembership({ courseId: visibleCourse.domainId, userId: 'student-1', status: 'ACTIVE' });
    fake.seedStudentMembership({ courseId: hiddenCourse.domainId, userId: 'student-1', status: 'SUSPENDED' });
    const store = new PrismaAssignmentStore(fake.prisma as any);

    const visible = await store.createAssignment({
      dataDir,
      courseId: visibleCourse.domainId,
      title: 'Visible Homework',
      openAt: '2026-03-29T08:00:00.000Z',
      deadlineAt: '2099-03-31T08:00:00.000Z',
      state: 'open',
      source: {
        originalName: 'visible-assignment.pdf',
        buffer: Buffer.from('visible-prompt'),
        mimeType: 'application/pdf',
      },
    });

    await store.createAssignment({
      dataDir,
      courseId: hiddenCourse.domainId,
      title: 'Hidden Homework',
      openAt: '2026-03-29T08:00:00.000Z',
      deadlineAt: '2099-03-31T08:00:00.000Z',
      state: 'open',
      source: {
        originalName: 'hidden-assignment.pdf',
        buffer: Buffer.from('hidden-prompt'),
        mimeType: 'application/pdf',
      },
    });

    const visibleAssignments = await store.listVisibleAssignmentsForStudent('student-1');
    const promptAsset = await store.getAssignmentPromptAssetForStudent('student-1', visible.assignmentId);

    expect(visibleAssignments.map((assignment) => assignment.assignmentId)).toEqual([
      visible.assignmentId,
    ]);
    expect(visibleAssignments[0]?.examId).toBeTruthy();
    expect(promptAsset?.originalName).toBe('visible-assignment.pdf');
    expect(promptAsset?.path).toContain(path.join('exams', visible.examId, 'assets'));
  });

  it('replaces the backing exam source when updating an assignment source file', async () => {
    const dataDir = await createTempDir();
    const fake = createFakeAssignmentPrisma();
    const course = fake.seedCourse({ domainId: 'course-geometry', title: 'Geometry' });
    const store = new PrismaAssignmentStore(fake.prisma as any);

    const assignment = await store.createAssignment({
      dataDir,
      courseId: course.domainId,
      title: 'Geometry Homework',
      openAt: '2026-03-30T08:00:00.000Z',
      deadlineAt: '2026-04-01T08:00:00.000Z',
      state: 'draft',
      source: {
        originalName: 'geometry-v1.pdf',
        buffer: Buffer.from('geometry-source-v1'),
        mimeType: 'application/pdf',
      },
    });

    const originalAssetPath = [...fake.stores.assetRows.values()].map((row) => String(row.path))[0];

    const updated = await store.updateAssignment({
      assignmentId: assignment.assignmentId,
      dataDir,
      title: 'Geometry Homework Revised',
      source: {
        originalName: 'geometry-v2.pdf',
        buffer: Buffer.from('geometry-source-v2'),
        mimeType: 'application/pdf',
      },
    });

    expect(updated.title).toBe('Geometry Homework Revised');
    expect(updated.examId).toBe(assignment.examId);

    const updatedAssetPath = [...fake.stores.assetRows.values()].map((row) => String(row.path))[0];
    expect(updatedAssetPath).not.toBe(originalAssetPath);
    await expect(fs.readFile(updatedAssetPath, 'utf-8')).resolves.toContain('geometry-source-v2');
    await expect(fs.access(originalAssetPath)).rejects.toThrow();
  });
});
