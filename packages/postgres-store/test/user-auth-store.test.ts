import { afterEach, describe, expect, it, vi } from 'vitest';
import { PrismaUserAuthStore } from '../src';

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

const createFakeAuthPrisma = () => {
  const userRows = new Map<string, Record<string, unknown>>();
  const authAccountRows = new Map<string, Record<string, unknown>>();
  const aliasRows = new Map<string, Record<string, unknown>>();
  const membershipRows = new Map<string, Record<string, unknown>>();

  let userSequence = 0;
  let authAccountSequence = 0;
  let aliasSequence = 0;
  let membershipSequence = 0;

  const buildUserRow = (row: Record<string, unknown>, select?: Record<string, any>) => {
    const memberships = [...membershipRows.values()].filter(
      (membership) =>
        membership.userId === row.id &&
        membership.status === 'ACTIVE' &&
        ['COURSE_ADMIN', 'LECTURER'].includes(String(membership.role))
    );

    return selectFields(
      {
        ...row,
        memberships,
      },
      select
    );
  };

  const user = {
    async create(args: { data: Record<string, unknown>; select?: Record<string, any> }) {
      const now = new Date();
      const row = {
        id: `user-row-${++userSequence}`,
        createdAt: now,
        updatedAt: now,
        ...args.data,
      };
      userRows.set(String(row.id), row);
      return buildUserRow(row, args.select);
    },
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

      return row ? buildUserRow(row, args.select) : null;
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
      };
      userRows.set(String(updated.id), updated);
      return buildUserRow(updated, args.select);
    },
  };

  const authAccount = {
    async findUnique(args: { where: Record<string, any>; select?: Record<string, any> }) {
      const key =
        typeof args.where.provider_providerAccountId?.provider === 'string' &&
        typeof args.where.provider_providerAccountId?.providerAccountId === 'string'
          ? `${args.where.provider_providerAccountId.provider}:${args.where.provider_providerAccountId.providerAccountId}`
          : null;
      if (!key) {
        return null;
      }

      const row = authAccountRows.get(key);
      if (!row) {
        return null;
      }

      return selectFields(
        {
          ...row,
          user: buildUserRow(userRows.get(String(row.userId))!, args.select?.user?.select),
        },
        args.select
      );
    },
    async upsert(args: {
      where: Record<string, any>;
      update: Record<string, unknown>;
      create: Record<string, unknown>;
    }) {
      const key = `${args.where.provider_providerAccountId.provider}:${args.where.provider_providerAccountId.providerAccountId}`;
      const existing = authAccountRows.get(key);
      if (existing) {
        const updated = {
          ...existing,
          ...args.update,
        };
        authAccountRows.set(key, updated);
        return updated;
      }

      const row = {
        id: `auth-account-row-${++authAccountSequence}`,
        ...args.create,
      };
      authAccountRows.set(key, row);
      return row;
    },
  };

  const identityAlias = {
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

  const prisma: any = {
    user,
    authAccount,
    identityAlias,
    courseMembership: {},
    async $transaction<T>(callback: (tx: any) => Promise<T>) {
      return callback({
        user,
        authAccount,
        identityAlias,
      });
    },
  };

  return {
    prisma,
    seedUser(args: {
      normalizedEmail?: string | null;
      displayName?: string | null;
      globalRole?: 'USER' | 'SUPER_ADMIN';
      status?: 'ACTIVE' | 'DISABLED';
    }) {
      const row = {
        id: `user-row-${++userSequence}`,
        normalizedEmail: args.normalizedEmail ?? null,
        displayName: args.displayName ?? null,
        globalRole: args.globalRole ?? 'USER',
        status: args.status ?? 'ACTIVE',
      };
      userRows.set(row.id, row);
      return row;
    },
    seedStaffMembership(userId: string, role: 'COURSE_ADMIN' | 'LECTURER' | 'STUDENT') {
      const row = {
        id: `membership-row-${++membershipSequence}`,
        userId,
        role,
        status: 'ACTIVE',
      };
      membershipRows.set(row.id, row);
      return row;
    },
    getAlias(kind: string, normalizedValue: string) {
      return aliasRows.get(`${kind}:${normalizedValue}`) ?? null;
    },
    getAuthAccount(provider: string, providerAccountId: string) {
      return authAccountRows.get(`${provider}:${providerAccountId}`) ?? null;
    },
  };
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('PrismaUserAuthStore', () => {
  it('returns active staff access when a user has an active lecturer membership', async () => {
    const fake = createFakeAuthPrisma();
    const user = fake.seedUser({
      normalizedEmail: 'lecturer@example.edu',
      displayName: 'Lecturer',
    });
    fake.seedStaffMembership(user.id, 'LECTURER');

    const store = new PrismaUserAuthStore(fake.prisma);
    const access = await store.getUserAccessById(user.id);

    expect(access).toEqual({
      userId: user.id,
      normalizedEmail: 'lecturer@example.edu',
      displayName: 'Lecturer',
      globalRole: 'USER',
      status: 'ACTIVE',
      hasStaffAccess: true,
    });
  });

  it('links an existing user by email and records auth account plus email alias on first sign-in', async () => {
    const fake = createFakeAuthPrisma();
    const user = fake.seedUser({
      normalizedEmail: 'teacher@example.edu',
      displayName: 'Teacher',
    });
    fake.seedStaffMembership(user.id, 'COURSE_ADMIN');

    const store = new PrismaUserAuthStore(fake.prisma);
    const access = await store.resolveUserForSignIn({
      provider: 'google',
      providerAccountId: 'google-sub-1',
      email: 'Teacher@Example.edu',
      displayName: 'Teacher Name',
    });

    expect(access).toEqual({
      userId: user.id,
      normalizedEmail: 'teacher@example.edu',
      displayName: 'Teacher Name',
      globalRole: 'USER',
      status: 'ACTIVE',
      hasStaffAccess: true,
    });
    expect(fake.getAuthAccount('google', 'google-sub-1')).toMatchObject({
      userId: user.id,
      provider: 'google',
      providerAccountId: 'google-sub-1',
    });
    expect(fake.getAlias('email', 'teacher@example.edu')).toMatchObject({
      userId: user.id,
      value: 'Teacher@Example.edu',
    });
  });

  it('bootstraps a super admin when the email is explicitly allowed', async () => {
    vi.stubEnv('AUTH_BOOTSTRAP_SUPER_ADMIN_EMAILS', 'admin@example.edu');
    const fake = createFakeAuthPrisma();
    const store = new PrismaUserAuthStore(fake.prisma);

    const access = await store.resolveUserForSignIn({
      provider: 'google',
      providerAccountId: 'bootstrap-sub',
      email: 'Admin@Example.edu',
      displayName: 'Bootstrap Admin',
    });

    expect(access).toMatchObject({
      normalizedEmail: 'admin@example.edu',
      displayName: 'Bootstrap Admin',
      globalRole: 'SUPER_ADMIN',
      status: 'ACTIVE',
      hasStaffAccess: true,
    });
    expect(fake.getAuthAccount('google', 'bootstrap-sub')).toBeTruthy();
  });

  it('denies sign-in for unknown non-bootstrap emails', async () => {
    const fake = createFakeAuthPrisma();
    const store = new PrismaUserAuthStore(fake.prisma);

    const access = await store.resolveUserForSignIn({
      provider: 'google',
      providerAccountId: 'unknown-sub',
      email: 'unknown@example.edu',
    });

    expect(access).toBeNull();
  });
});
