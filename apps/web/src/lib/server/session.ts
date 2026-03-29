import 'server-only';

import { cache } from 'react';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import type { UserAuthAccessRecord } from '@hg/postgres-store';
import { authOptions } from '@/auth';
import { getServerPersistence } from './persistence';

type AccessOptions = {
  requireSuperAdmin?: boolean;
};

const getCurrentSessionUser = cache(async (): Promise<UserAuthAccessRecord | null> => {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return null;
  }

  const persistence = getServerPersistence();
  if (!persistence) {
    throw new Error('DATABASE_URL is not set in environment');
  }

  const access = await persistence.userAuth.getUserAccessById(userId);
  if (!access || access.status !== 'ACTIVE') {
    return null;
  }

  return access;
});

export const getCurrentSessionAccess = getCurrentSessionUser;

export const requireStaffPageAccess = async (): Promise<UserAuthAccessRecord> => {
  const access = await getCurrentSessionUser();

  if (!access) {
    redirect('/sign-in');
  }

  if (!access.hasStaffAccess) {
    redirect('/forbidden');
  }

  return access;
};

const unauthorizedResponse = () =>
  NextResponse.json(
    { error: 'Authentication required', code: 'AUTH_REQUIRED' },
    { status: 401 }
  );

const forbiddenResponse = () =>
  NextResponse.json(
    { error: 'Forbidden', code: 'FORBIDDEN' },
    { status: 403 }
  );

const superAdminRequiredResponse = () =>
  NextResponse.json(
    { error: 'Super admin access required', code: 'SUPER_ADMIN_REQUIRED' },
    { status: 403 }
  );

export const requireStaffApiAccess = async (
  options?: AccessOptions
): Promise<UserAuthAccessRecord | NextResponse> => {
  let access: UserAuthAccessRecord | null;
  try {
    access = await getCurrentSessionUser();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: message, code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }

  if (!access) {
    return unauthorizedResponse();
  }

  if (options?.requireSuperAdmin) {
    return access.globalRole === 'SUPER_ADMIN' ? access : superAdminRequiredResponse();
  }

  return access.hasStaffAccess ? access : forbiddenResponse();
};
