import { afterEach, describe, expect, it } from 'vitest';
import {
  CourseMembershipCourseNotFoundError,
  PrismaCourseMembershipStore,
} from '../src';

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

const createFakeMembershipPrisma = () => {
  const courseRows = new Map<string, Record<string, unknown>>();
  const courseRowsById = new Map<string, Record<string, unknown>>();
  const userRows = new Map<string, Record<string, unknown>>();
  const aliasRows = new Map<string, Record<string, unknown>>();
  const membershipRows = new Map<string, Record<string, unknown>>();

  let courseSequence = 0;
  let userSequence = 0;
  let aliasSequence = 0;
  let membershipSequence = 0;

  const course = {
    async findUnique(args: { where: Record<string, unknown>; select?: Record<string, any> }) {
      let row: Record<string, unknown> | null = null;
      if (typeof args.where.domainId === 'string') {
        row = courseRows.get(args.where.domainId) ?? null;
      } else if (typeof args.where.id === 'string') {
        row = courseRowsById.get(args.where.id) ?? null;
      }

      return row ? selectFields(row, args.select) : null;
    },
    async findMany(args: { where?: Record<string, any>; select?: Record<string, any> }) {
      let rows = [...courseRows.values()];
      const excludedDomainId = args.where?.domainId?.not;
      if (typeof excludedDomainId === 'string') {
        rows = rows.filter((row) => row.domainId !== excludedDomainId);
      }

      const membershipWhere = args.where?.memberships?.some;
      if (membershipWhere) {
        rows = rows.filter((row) =>
          [...membershipRows.values()].some(
            (membership) =>
              membership.courseId === row.id &&
              membership.userId === membershipWhere.userId &&
              membership.status === membershipWhere.status &&
              membershipWhere.role?.in?.includes(membership.role)
          )
        );
      }

      rows.sort((left, right) =>
        (right.createdAt as Date).getTime() - (left.createdAt as Date).getTime()
      );

      return rows.map((row) => selectFields(row, args.select));
    },
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
  };

  const user = {
    async findUnique(args: { where: Record<string, unknown>; select?: Record<string, any> }) {
      let row: Record<string, unknown> | null = null;
      if (typeof args.where.id === 'string') {
        row = userRows.get(args.where.id) ?? null;
      } else if (typeof args.where.normalizedEmail === 'string') {
        row =
          [...userRows.values()].find(
            (candidate) => candidate.normalizedEmail === args.where.normalizedEmail
          ) ?? null;
      }

      return row ? selectFields(row, args.select) : null;
    },
    async create(args: { data: Record<string, unknown>; select?: Record<string, any> }) {
      const now = new Date();
      const row = {
        id: `user-row-${++userSequence}`,
        createdAt: now,
        updatedAt: now,
        ...args.data,
      };
      userRows.set(String(row.id), row);
      return selectFields(row, args.select);
    },
    async update(args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
      select?: Record<string, any>;
    }) {
      const existing = userRows.get(String(args.where.id));
      if (!existing) {
        throw new Error(`User ${String(args.where.id)} not found`);
      }

      const updated = {
        ...existing,
        ...args.data,
        updatedAt: new Date(),
      };
      userRows.set(String(updated.id), updated);
      return selectFields(updated, args.select);
    },
  };

  const identityAlias = {
    async findUnique(args: { where: Record<string, any>; select?: Record<string, any> }) {
      const key =
        typeof args.where.kind_normalizedValue?.kind === 'string' &&
        typeof args.where.kind_normalizedValue?.normalizedValue === 'string'
          ? `${args.where.kind_normalizedValue.kind}:${args.where.kind_normalizedValue.normalizedValue}`
          : null;

      if (!key) {
        return null;
      }

      const row = aliasRows.get(key) ?? null;
      return row ? selectFields(row, args.select) : null;
    },
    async upsert(args: {
      where: Record<string, any>;
      update: Record<string, unknown>;
      create: Record<string, unknown>;
    }) {
      const key = `${args.where.kind_normalizedValue.kind}:${args.where.kind_normalizedValue.normalizedValue}`;
      const existing = aliasRows.get(key);
      if (existing) {
        const updated = {
          ...existing,
          ...args.update,
        };
        aliasRows.set(key, updated);
        return updated;
      }

      const row = {
        id: `alias-row-${++aliasSequence}`,
        ...args.create,
      };
      aliasRows.set(key, row);
      return row;
    },
  };

  const courseMembership = {
    async findFirst(args: { where: Record<string, any>; select?: Record<string, any> }) {
      const row =
        [...membershipRows.values()].find((candidate) => {
          const courseRow = courseRowsById.get(String(candidate.courseId));
          return (
            candidate.userId === args.where.userId &&
            courseRow?.domainId === args.where.course?.domainId
          );
        }) ?? null;

      if (!row) {
        return null;
      }

      const courseRow = courseRowsById.get(String(row.courseId));
      return selectFields(
        {
          ...row,
          course: {
            domainId: courseRow?.domainId,
            title: courseRow?.title,
          },
        },
        args.select
      );
    },
    async findMany(args: { where: Record<string, any>; select?: Record<string, any>; orderBy?: Array<Record<string, unknown>> }) {
      let rows = [...membershipRows.values()];
      if (typeof args.where.courseId === 'string') {
        rows = rows.filter((candidate) => candidate.courseId === args.where.courseId);
      }

      rows.sort((left, right) => {
        const roleComparison = String(left.role).localeCompare(String(right.role));
        if (roleComparison !== 0) return roleComparison;
        const statusComparison = String(left.status).localeCompare(String(right.status));
        if (statusComparison !== 0) return statusComparison;
        return (left.createdAt as Date).getTime() - (right.createdAt as Date).getTime();
      });

      return rows.map((row) => {
        const courseRow = courseRowsById.get(String(row.courseId));
        const userRow = userRows.get(String(row.userId));
        return selectFields(
          {
            ...row,
            course: {
              domainId: courseRow?.domainId,
              title: courseRow?.title,
            },
            user: {
              id: userRow?.id,
              normalizedEmail: userRow?.normalizedEmail,
              displayName: userRow?.displayName,
            },
          },
          args.select
        );
      });
    },
    async findUnique(args: { where: Record<string, any>; select?: Record<string, any> }) {
      let row: Record<string, unknown> | null = null;
      if (typeof args.where.id === 'string') {
        row = membershipRows.get(args.where.id) ?? null;
      } else if (
        typeof args.where.courseId_userId?.courseId === 'string' &&
        typeof args.where.courseId_userId?.userId === 'string'
      ) {
        row =
          [...membershipRows.values()].find(
            (candidate) =>
              candidate.courseId === args.where.courseId_userId.courseId &&
              candidate.userId === args.where.courseId_userId.userId
          ) ?? null;
      }

      return row ? selectFields(row, args.select) : null;
    },
    async create(args: { data: Record<string, unknown>; select?: Record<string, any> }) {
      const now = new Date();
      const row = {
        id: `membership-row-${++membershipSequence}`,
        createdAt: now,
        updatedAt: now,
        ...args.data,
      };
      membershipRows.set(String(row.id), row);
      const courseRow = courseRowsById.get(String(row.courseId));
      const userRow = userRows.get(String(row.userId));
      return selectFields(
        {
          ...row,
          course: {
            domainId: courseRow?.domainId,
            title: courseRow?.title,
          },
          user: {
            id: userRow?.id,
            normalizedEmail: userRow?.normalizedEmail,
            displayName: userRow?.displayName,
          },
        },
        args.select
      );
    },
    async update(args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
      select?: Record<string, any>;
    }) {
      const existing = membershipRows.get(String(args.where.id));
      if (!existing) {
        throw new Error(`Membership ${String(args.where.id)} not found`);
      }

      const row = {
        ...existing,
        ...args.data,
        updatedAt: new Date(),
      };
      membershipRows.set(String(row.id), row);
      const courseRow = courseRowsById.get(String(row.courseId));
      const userRow = userRows.get(String(row.userId));
      return selectFields(
        {
          ...row,
          course: {
            domainId: courseRow?.domainId,
            title: courseRow?.title,
          },
          user: {
            id: userRow?.id,
            normalizedEmail: userRow?.normalizedEmail,
            displayName: userRow?.displayName,
          },
        },
        args.select
      );
    },
  };

  return {
    prisma: {
      course,
      user,
      identityAlias,
      courseMembership,
      async $transaction<T>(callback: (tx: any) => Promise<T>) {
        return callback({ course, user, identityAlias, courseMembership });
      },
    },
    seedCourse(args?: { domainId?: string; title?: string }) {
      const row = {
        id: `course-row-${++courseSequence}`,
        domainId: args?.domainId ?? `course-${courseSequence}`,
        title: args?.title ?? `Course ${courseSequence}`,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      courseRows.set(row.domainId, row);
      courseRowsById.set(row.id, row);
      return row;
    },
    seedUser(args?: {
      normalizedEmail?: string | null;
      displayName?: string | null;
      status?: 'ACTIVE' | 'DISABLED';
      globalRole?: 'USER' | 'SUPER_ADMIN';
    }) {
      const row = {
        id: `user-row-${++userSequence}`,
        normalizedEmail: args?.normalizedEmail ?? null,
        displayName: args?.displayName ?? null,
        status: args?.status ?? 'ACTIVE',
        globalRole: args?.globalRole ?? 'USER',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      userRows.set(row.id, row);
      return row;
    },
    seedMembership(args: {
      courseId: string;
      userId: string;
      role: 'COURSE_ADMIN' | 'LECTURER' | 'STUDENT';
      status?: 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'REMOVED';
      joinedAt?: Date | null;
    }) {
      const courseRow = courseRows.get(args.courseId);
      if (!courseRow) {
        throw new Error(`Course ${args.courseId} not seeded`);
      }

      const row = {
        id: `membership-row-${++membershipSequence}`,
        courseId: courseRow.id,
        userId: args.userId,
        role: args.role,
        status: args.status ?? 'ACTIVE',
        joinedAt: args.joinedAt ?? (args.status === 'ACTIVE' || !args.status ? new Date() : null),
        invitedByUserId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      membershipRows.set(row.id, row);
      return row;
    },
  };
};

afterEach(() => {
  // no-op to mirror test style and leave room for future env cleanup
});

describe('PrismaCourseMembershipStore', () => {
  it('upserts memberships by email idempotently and reuses the same canonical user plus alias', async () => {
    const fake = createFakeMembershipPrisma();
    const course = fake.seedCourse({ domainId: 'course-signals', title: 'Signals' });
    const store = new PrismaCourseMembershipStore(fake.prisma as any);

    const created = await store.upsertMembershipByEmail({
      courseId: course.domainId,
      email: 'Lecturer@Example.edu',
      displayName: 'Signals Lecturer',
      role: 'LECTURER',
      status: 'ACTIVE',
      invitedByUserId: 'admin-user',
    });

    const updated = await store.upsertMembershipByEmail({
      courseId: course.domainId,
      email: 'lecturer@example.edu',
      role: 'LECTURER',
      status: 'ACTIVE',
      invitedByUserId: 'admin-user',
    });

    expect(created.userId).toBe(updated.userId);
    expect(created.membershipId).toBe(updated.membershipId);
    expect(created.normalizedEmail).toBe('lecturer@example.edu');
    expect(updated.role).toBe('LECTURER');
    expect(updated.status).toBe('ACTIVE');
  });

  it('evaluates active staff vs student and suspended memberships correctly', async () => {
    const fake = createFakeMembershipPrisma();
    const course = fake.seedCourse({ domainId: 'course-authz', title: 'AuthZ' });
    const lecturer = fake.seedUser({ normalizedEmail: 'lecturer@example.edu' });
    const student = fake.seedUser({ normalizedEmail: 'student@example.edu' });
    const suspendedAdmin = fake.seedUser({ normalizedEmail: 'admin@example.edu' });
    fake.seedMembership({ courseId: course.domainId, userId: lecturer.id, role: 'LECTURER', status: 'ACTIVE' });
    fake.seedMembership({ courseId: course.domainId, userId: student.id, role: 'STUDENT', status: 'ACTIVE' });
    fake.seedMembership({
      courseId: course.domainId,
      userId: suspendedAdmin.id,
      role: 'COURSE_ADMIN',
      status: 'SUSPENDED',
      joinedAt: null,
    });

    const store = new PrismaCourseMembershipStore(fake.prisma as any);

    await expect(store.getCourseAccessForUser(lecturer.id, course.domainId)).resolves.toMatchObject({
      role: 'LECTURER',
      status: 'ACTIVE',
      isStaff: true,
    });
    await expect(store.getCourseAccessForUser(student.id, course.domainId)).resolves.toMatchObject({
      role: 'STUDENT',
      status: 'ACTIVE',
      isStaff: false,
    });
    await expect(
      store.getCourseAccessForUser(suspendedAdmin.id, course.domainId)
    ).resolves.toMatchObject({
      role: 'COURSE_ADMIN',
      status: 'SUSPENDED',
      isStaff: false,
    });
  });

  it('lists only active staff courses for non-super-admin authorization filters', async () => {
    const fake = createFakeMembershipPrisma();
    const visibleCourse = fake.seedCourse({ domainId: 'course-visible', title: 'Visible' });
    const hiddenStudentCourse = fake.seedCourse({ domainId: 'course-student', title: 'Student Only' });
    const hiddenSuspendedCourse = fake.seedCourse({ domainId: 'course-suspended', title: 'Suspended' });
    const user = fake.seedUser({ normalizedEmail: 'staff@example.edu' });
    fake.seedMembership({ courseId: visibleCourse.domainId, userId: user.id, role: 'COURSE_ADMIN', status: 'ACTIVE' });
    fake.seedMembership({ courseId: hiddenStudentCourse.domainId, userId: user.id, role: 'STUDENT', status: 'ACTIVE' });
    fake.seedMembership({ courseId: hiddenSuspendedCourse.domainId, userId: user.id, role: 'LECTURER', status: 'SUSPENDED' });

    const store = new PrismaCourseMembershipStore(fake.prisma as any);
    const courses = await store.listStaffCoursesForUser(user.id);

    expect(courses.map((course) => course.courseId)).toEqual(['course-visible']);
  });

  it('lists memberships for course admins and throws a typed error for missing courses', async () => {
    const fake = createFakeMembershipPrisma();
    const course = fake.seedCourse({ domainId: 'course-members', title: 'Members' });
    const courseAdmin = fake.seedUser({
      normalizedEmail: 'admin@example.edu',
      displayName: 'Course Admin',
    });
    fake.seedMembership({ courseId: course.domainId, userId: courseAdmin.id, role: 'COURSE_ADMIN' });

    const store = new PrismaCourseMembershipStore(fake.prisma as any);
    const memberships = await store.listCourseMemberships(course.domainId);

    expect(memberships).toHaveLength(1);
    expect(memberships[0]).toMatchObject({
      courseId: 'course-members',
      normalizedEmail: 'admin@example.edu',
      role: 'COURSE_ADMIN',
      status: 'ACTIVE',
    });

    await expect(store.listCourseMemberships('missing-course')).rejects.toBeInstanceOf(
      CourseMembershipCourseNotFoundError
    );
  });
});
