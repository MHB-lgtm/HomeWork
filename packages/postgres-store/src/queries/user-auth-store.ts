import type { PrismaClient } from '@prisma/client';
import {
  CourseMembershipRole,
  CourseMembershipStatus,
  UserGlobalRole,
  UserStatus,
} from '@prisma/client';
import type { UserAuthAccessRecord } from '../types';

type UserAuthPrisma = Pick<
  PrismaClient,
  '$transaction' | 'authAccount' | 'course' | 'courseMembership' | 'identityAlias' | 'user'
>;

type UserAccessRow = {
  id: string;
  normalizedEmail: string | null;
  displayName: string | null;
  globalRole: UserGlobalRole;
  status: UserStatus;
  memberships: Array<{ id: string }>;
};

const STAFF_ROLES = [CourseMembershipRole.COURSE_ADMIN, CourseMembershipRole.LECTURER];
const EMAIL_ALIAS_KIND = 'email';
const DEMO_PROVIDER = 'demo-login';
const DEMO_COURSE_DOMAIN_ID = 'course-demo-authz';
const DEMO_COURSE_TITLE = 'Demo Authorization Course';

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

const normalizeOptionalName = (value?: string | null): string | null => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

const getBootstrapSuperAdminEmails = (): Set<string> =>
  new Set(
    (process.env.AUTH_BOOTSTRAP_SUPER_ADMIN_EMAILS ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .map(normalizeEmail)
  );

const userAccessSelect = {
  id: true,
  normalizedEmail: true,
  displayName: true,
  globalRole: true,
  status: true,
  memberships: {
    where: {
      status: CourseMembershipStatus.ACTIVE,
      role: { in: STAFF_ROLES },
    },
    select: { id: true },
    take: 1,
  },
} as const;

const mapUserAccessRow = (row: UserAccessRow): UserAuthAccessRecord => ({
  userId: row.id,
  normalizedEmail: row.normalizedEmail ?? null,
  displayName: row.displayName ?? null,
  globalRole: row.globalRole,
  status: row.status,
  hasStaffAccess: row.globalRole === UserGlobalRole.SUPER_ADMIN || row.memberships.length > 0,
});

const DEMO_IDENTITIES = {
  'demo-super-admin': {
    accountId: 'demo-super-admin',
    label: 'Demo Super Admin',
    email: 'demo.superadmin@homework-grader.local',
    displayName: 'Demo Super Admin',
    globalRole: UserGlobalRole.SUPER_ADMIN,
    membershipRole: null,
  },
  'demo-course-admin': {
    accountId: 'demo-course-admin',
    label: 'Demo Course Admin',
    email: 'demo.courseadmin@homework-grader.local',
    displayName: 'Demo Course Admin',
    globalRole: UserGlobalRole.USER,
    membershipRole: CourseMembershipRole.COURSE_ADMIN,
  },
  'demo-lecturer': {
    accountId: 'demo-lecturer',
    label: 'Demo Lecturer',
    email: 'demo.lecturer@homework-grader.local',
    displayName: 'Demo Lecturer',
    globalRole: UserGlobalRole.USER,
    membershipRole: CourseMembershipRole.LECTURER,
  },
  'demo-student': {
    accountId: 'demo-student',
    label: 'Demo Student',
    email: 'demo.student@homework-grader.local',
    displayName: 'Demo Student',
    globalRole: UserGlobalRole.USER,
    membershipRole: CourseMembershipRole.STUDENT,
  },
} as const;

export type DevelopmentDemoAccountId = keyof typeof DEMO_IDENTITIES;

export const DEVELOPMENT_DEMO_SIGN_IN_OPTIONS = Object.values(DEMO_IDENTITIES).map(
  ({ accountId, label }) => ({
    accountId,
    label,
  })
);

const isDevelopment = (): boolean => process.env.NODE_ENV === 'development';

export class PrismaUserAuthStore {
  constructor(private readonly prisma: UserAuthPrisma) {}

  async getUserAccessById(userId: string): Promise<UserAuthAccessRecord | null> {
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: userAccessSelect,
    });

    return row ? mapUserAccessRow(row) : null;
  }

  async resolveUserForSignIn(args: {
    provider: string;
    providerAccountId: string;
    email?: string | null;
    displayName?: string | null;
  }): Promise<UserAuthAccessRecord | null> {
    const provider = args.provider.trim();
    const providerAccountId = args.providerAccountId.trim();

    if (!provider || !providerAccountId) {
      throw new Error('provider and providerAccountId are required');
    }

    const existingAccount = await this.prisma.authAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId,
        },
      },
      select: {
        user: {
          select: userAccessSelect,
        },
      },
    });

    if (existingAccount?.user) {
      return mapUserAccessRow(existingAccount.user);
    }

    const rawEmail = args.email?.trim() ?? '';
    if (!rawEmail) {
      return null;
    }

    const normalizedEmail = normalizeEmail(rawEmail);
    const displayName = normalizeOptionalName(args.displayName);
    const bootstrapEmails = getBootstrapSuperAdminEmails();

    return this.prisma.$transaction(async (tx) => {
      const linkedAccount = await tx.authAccount.findUnique({
        where: {
          provider_providerAccountId: {
            provider,
            providerAccountId,
          },
        },
        select: {
          user: {
            select: userAccessSelect,
          },
        },
      });

      if (linkedAccount?.user) {
        return mapUserAccessRow(linkedAccount.user);
      }

      let user = await tx.user.findUnique({
        where: { normalizedEmail },
        select: userAccessSelect,
      });

      if (!user) {
        if (!bootstrapEmails.has(normalizedEmail)) {
          return null;
        }

        user = await tx.user.create({
          data: {
            normalizedEmail,
            displayName: displayName ?? rawEmail,
            globalRole: UserGlobalRole.SUPER_ADMIN,
            status: UserStatus.ACTIVE,
          },
          select: userAccessSelect,
        });
      } else if (user.status !== UserStatus.ACTIVE) {
        return mapUserAccessRow(user);
      } else if (displayName && displayName !== user.displayName) {
        user = await tx.user.update({
          where: { id: user.id },
          data: {
            displayName,
          },
          select: userAccessSelect,
        });
      }

      await tx.authAccount.upsert({
        where: {
          provider_providerAccountId: {
            provider,
            providerAccountId,
          },
        },
        update: {
          userId: user.id,
        },
        create: {
          userId: user.id,
          provider,
          providerAccountId,
        },
      });

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

      return mapUserAccessRow(user);
    });
  }

  async resolveDemoUserForDevelopment(
    accountId: string
  ): Promise<UserAuthAccessRecord | null> {
    if (!isDevelopment()) {
      throw new Error('Demo sign-in is only available in development');
    }

    if (!Object.prototype.hasOwnProperty.call(DEMO_IDENTITIES, accountId)) {
      return null;
    }

    const demoIdentity = DEMO_IDENTITIES[accountId as DevelopmentDemoAccountId];
    const normalizedEmail = normalizeEmail(demoIdentity.email);

    return this.prisma.$transaction(async (tx) => {
      let user = await tx.user.findUnique({
        where: { normalizedEmail },
        select: userAccessSelect,
      });

      if (!user) {
        user = await tx.user.create({
          data: {
            normalizedEmail,
            displayName: demoIdentity.displayName,
            globalRole: demoIdentity.globalRole,
            status: UserStatus.ACTIVE,
          },
          select: userAccessSelect,
        });
      } else {
        user = await tx.user.update({
          where: { id: user.id },
          data: {
            displayName: demoIdentity.displayName,
            globalRole: demoIdentity.globalRole,
            status: UserStatus.ACTIVE,
          },
          select: userAccessSelect,
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
          value: demoIdentity.email,
        },
        create: {
          userId: user.id,
          kind: EMAIL_ALIAS_KIND,
          value: demoIdentity.email,
          normalizedValue: normalizedEmail,
        },
      });

      await tx.authAccount.upsert({
        where: {
          provider_providerAccountId: {
            provider: DEMO_PROVIDER,
            providerAccountId: demoIdentity.accountId,
          },
        },
        update: {
          userId: user.id,
        },
        create: {
          userId: user.id,
          provider: DEMO_PROVIDER,
          providerAccountId: demoIdentity.accountId,
        },
      });

      const course =
        (await tx.course.findUnique({
          where: { domainId: DEMO_COURSE_DOMAIN_ID },
          select: { id: true },
        })) ??
        (await tx.course.create({
          data: {
            domainId: DEMO_COURSE_DOMAIN_ID,
            legacyCourseKey: null,
            title: DEMO_COURSE_TITLE,
            status: 'ACTIVE',
          },
          select: { id: true },
        }));

      if (demoIdentity.membershipRole) {
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
          },
        });

        const joinedAt = existingMembership?.joinedAt ?? new Date();

        if (existingMembership) {
          await tx.courseMembership.update({
            where: { id: existingMembership.id },
            data: {
              role: demoIdentity.membershipRole,
              status: CourseMembershipStatus.ACTIVE,
              joinedAt,
            },
          });
        } else {
          await tx.courseMembership.create({
            data: {
              courseId: course.id,
              userId: user.id,
              role: demoIdentity.membershipRole,
              status: CourseMembershipStatus.ACTIVE,
              joinedAt,
            },
          });
        }
      }

      const refreshed = await tx.user.findUnique({
        where: { id: user.id },
        select: userAccessSelect,
      });

      return refreshed ? mapUserAccessRow(refreshed) : null;
    });
  }
}
