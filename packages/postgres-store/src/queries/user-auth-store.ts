import type { PrismaClient } from '@prisma/client';
import { CourseMembershipRole, CourseMembershipStatus, UserGlobalRole, UserStatus } from '@prisma/client';
import type { UserAuthAccessRecord } from '../types';

type UserAuthPrisma = Pick<
  PrismaClient,
  '$transaction' | 'authAccount' | 'courseMembership' | 'identityAlias' | 'user'
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
}
