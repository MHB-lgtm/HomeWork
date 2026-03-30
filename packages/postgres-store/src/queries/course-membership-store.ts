import type { Course } from '@hg/shared-schemas';
import { CourseSchema } from '@hg/shared-schemas';
import type { PrismaClient } from '@prisma/client';
import {
  CourseMembershipRole,
  CourseMembershipStatus,
  UserGlobalRole,
  UserStatus,
} from '@prisma/client';
import type {
  CourseAccessRecord,
  CourseMembershipRecord,
  CourseMembershipRoleValue,
  CourseMembershipStatusValue,
} from '../types';
import { PLACEHOLDER_COURSE_DOMAIN_ID } from '../mappers/import';
import { toIsoString } from '../mappers/domain';

type CourseMembershipPrisma = Pick<
  PrismaClient,
  '$transaction' | 'course' | 'courseMembership' | 'identityAlias' | 'user'
>;

type CourseAccessRow = {
  role: CourseMembershipRole;
  status: CourseMembershipStatus;
  userId: string;
  course: {
    domainId: string;
    title: string;
  };
};

type MembershipRow = {
  id: string;
  role: CourseMembershipRole;
  status: CourseMembershipStatus;
  joinedAt: Date | null;
  invitedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  course: {
    domainId: string;
    title: string;
  };
  user: {
    id: string;
    normalizedEmail: string | null;
    displayName: string | null;
  };
};

const STAFF_ROLES: CourseMembershipRole[] = [
  CourseMembershipRole.COURSE_ADMIN,
  CourseMembershipRole.LECTURER,
];
const EMAIL_ALIAS_KIND = 'email';

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

const normalizeOptionalValue = (value?: string | null): string | null => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

const mapCourseRow = (row: {
  domainId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}): Course =>
  CourseSchema.parse({
    version: '1.0.0',
    courseId: row.domainId,
    title: row.title,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  });

const mapCourseAccessRow = (row: CourseAccessRow): CourseAccessRecord => ({
  courseId: row.course.domainId,
  courseTitle: row.course.title,
  userId: row.userId,
  role: row.role,
  status: row.status,
  isStaff: row.status === CourseMembershipStatus.ACTIVE && STAFF_ROLES.includes(row.role),
});

const mapMembershipRow = (row: MembershipRow): CourseMembershipRecord => ({
  membershipId: row.id,
  courseId: row.course.domainId,
  courseTitle: row.course.title,
  userId: row.user.id,
  normalizedEmail: row.user.normalizedEmail ?? null,
  displayName: row.user.displayName ?? null,
  role: row.role,
  status: row.status,
  joinedAt: row.joinedAt ? toIsoString(row.joinedAt) : null,
  invitedByUserId: row.invitedByUserId ?? null,
  createdAt: toIsoString(row.createdAt),
  updatedAt: toIsoString(row.updatedAt),
});

const membershipSelect = {
  id: true,
  role: true,
  status: true,
  joinedAt: true,
  invitedByUserId: true,
  createdAt: true,
  updatedAt: true,
  course: {
    select: {
      domainId: true,
      title: true,
    },
  },
  user: {
    select: {
      id: true,
      normalizedEmail: true,
      displayName: true,
    },
  },
} as const;

export class CourseMembershipCourseNotFoundError extends Error {
  constructor(courseId: string) {
    super(`Course not found: ${courseId}`);
    this.name = 'CourseMembershipCourseNotFoundError';
  }
}

export class PrismaCourseMembershipStore {
  constructor(private readonly prisma: CourseMembershipPrisma) {}

  async getCourseAccessForUser(
    userId: string,
    courseId: string
  ): Promise<CourseAccessRecord | null> {
    const row = await this.prisma.courseMembership.findFirst({
      where: {
        userId,
        course: {
          domainId: courseId,
        },
      },
      select: {
        role: true,
        status: true,
        userId: true,
        course: {
          select: {
            domainId: true,
            title: true,
          },
        },
      },
    });

    return row ? mapCourseAccessRow(row) : null;
  }

  async listStaffCoursesForUser(userId: string): Promise<Course[]> {
    const rows = await this.prisma.course.findMany({
      where: {
        domainId: {
          not: PLACEHOLDER_COURSE_DOMAIN_ID,
        },
        memberships: {
          some: {
            userId,
            status: CourseMembershipStatus.ACTIVE,
            role: {
              in: STAFF_ROLES,
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        domainId: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return rows.map(mapCourseRow);
  }

  async listCourseMemberships(courseId: string): Promise<CourseMembershipRecord[]> {
    const course = await this.prisma.course.findUnique({
      where: { domainId: courseId },
      select: { id: true },
    });

    if (!course) {
      throw new CourseMembershipCourseNotFoundError(courseId);
    }

    const rows = await this.prisma.courseMembership.findMany({
      where: {
        courseId: course.id,
      },
      select: membershipSelect,
      orderBy: [
        { role: 'asc' },
        { status: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    return rows.map(mapMembershipRow);
  }

  async upsertMembershipByEmail(args: {
    courseId: string;
    email: string;
    displayName?: string | null;
    role: CourseMembershipRole | CourseMembershipRoleValue;
    status: CourseMembershipStatus | CourseMembershipStatusValue;
    invitedByUserId?: string | null;
  }): Promise<CourseMembershipRecord> {
    const rawEmail = args.email.trim();
    if (!rawEmail) {
      throw new Error('email is required');
    }

    const normalizedEmail = normalizeEmail(rawEmail);
    const normalizedDisplayName = normalizeOptionalValue(args.displayName);

    return this.prisma.$transaction(async (tx: any) => {
      const course = await tx.course.findUnique({
        where: { domainId: args.courseId },
        select: { id: true },
      });

      if (!course) {
        throw new CourseMembershipCourseNotFoundError(args.courseId);
      }

      const existingAlias = await tx.identityAlias.findUnique({
        where: {
          kind_normalizedValue: {
            kind: EMAIL_ALIAS_KIND,
            normalizedValue: normalizedEmail,
          },
        },
        select: {
          userId: true,
        },
      });

      let user =
        (await tx.user.findUnique({
          where: { normalizedEmail },
          select: {
            id: true,
            normalizedEmail: true,
            displayName: true,
            status: true,
            globalRole: true,
          },
        })) ??
        (existingAlias?.userId
          ? await tx.user.findUnique({
              where: { id: existingAlias.userId },
              select: {
                id: true,
                normalizedEmail: true,
                displayName: true,
                status: true,
                globalRole: true,
              },
            })
          : null);

      if (!user) {
        user = await tx.user.create({
          data: {
            normalizedEmail,
            displayName: normalizedDisplayName ?? rawEmail,
            globalRole: UserGlobalRole.USER,
            status: UserStatus.ACTIVE,
          },
          select: {
            id: true,
            normalizedEmail: true,
            displayName: true,
            status: true,
            globalRole: true,
          },
        });
      } else if (normalizedDisplayName && normalizedDisplayName !== user.displayName) {
        user = await tx.user.update({
          where: { id: user.id },
          data: {
            displayName: normalizedDisplayName,
          },
          select: {
            id: true,
            normalizedEmail: true,
            displayName: true,
            status: true,
            globalRole: true,
          },
        });
      }

      await tx.identityAlias.upsert({
        where: {
          kind_normalizedValue: {
            kind: EMAIL_ALIAS_KIND,
            normalizedValue: normalizedEmail,
          },
        },
        update: {
          userId: user.id,
          value: rawEmail,
        },
        create: {
          userId: user.id,
          kind: EMAIL_ALIAS_KIND,
          value: rawEmail,
          normalizedValue: normalizedEmail,
        },
      });

      const existingMembership = await tx.courseMembership.findUnique({
        where: {
          courseId_userId: {
            courseId: course.id,
            userId: user.id,
          },
        },
        select: {
          id: true,
          joinedAt: true,
          invitedByUserId: true,
        },
      });

      const joinedAt =
        args.status === CourseMembershipStatus.ACTIVE
          ? existingMembership?.joinedAt ?? new Date()
          : existingMembership?.joinedAt ?? null;

      const membership = existingMembership
        ? await tx.courseMembership.update({
            where: { id: existingMembership.id },
            data: {
              role: args.role as CourseMembershipRole,
              status: args.status as CourseMembershipStatus,
              invitedByUserId: args.invitedByUserId ?? existingMembership.invitedByUserId ?? null,
              joinedAt,
            },
            select: membershipSelect,
          })
        : await tx.courseMembership.create({
            data: {
              courseId: course.id,
              userId: user.id,
              role: args.role as CourseMembershipRole,
              status: args.status as CourseMembershipStatus,
              invitedByUserId: args.invitedByUserId ?? null,
              joinedAt,
            },
            select: membershipSelect,
          });

      return mapMembershipRow(membership);
    });
  }
}
