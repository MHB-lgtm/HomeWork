import 'server-only';

import { cache } from 'react';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import type {
  CourseAccessRecord,
  CourseMembershipRoleValue,
  UserAuthAccessRecord,
} from '@hg/postgres-store';
import { authOptions } from '@/auth';
import { getServerPersistence } from './persistence';

type AccessOptions = {
  requireSuperAdmin?: boolean;
};

type CourseAuthorizationRecord = {
  access: UserAuthAccessRecord;
  courseAccess: CourseAccessRecord | null;
};

class AuthenticationRequiredError extends Error {
  constructor() {
    super('Authentication required');
    this.name = 'AuthenticationRequiredError';
  }
}

class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

class SuperAdminRequiredError extends ForbiddenError {
  constructor() {
    super('Super admin access required');
    this.name = 'SuperAdminRequiredError';
  }
}

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

const toApiAuthErrorResponse = (error: unknown) => {
  if (error instanceof AuthenticationRequiredError) {
    return unauthorizedResponse();
  }

  if (error instanceof SuperAdminRequiredError) {
    return superAdminRequiredResponse();
  }

  if (error instanceof ForbiddenError) {
    return forbiddenResponse();
  }

  const message = error instanceof Error ? error.message : String(error);
  return NextResponse.json(
    { error: message, code: 'INTERNAL_ERROR' },
    { status: 500 }
  );
};

export const requireAuthenticatedUser = async (): Promise<UserAuthAccessRecord> => {
  const access = await getCurrentSessionUser();
  if (!access) {
    throw new AuthenticationRequiredError();
  }

  return access;
};

export const requireStaffUser = async (): Promise<UserAuthAccessRecord> => {
  const access = await requireAuthenticatedUser();
  if (!access.hasStaffAccess) {
    throw new ForbiddenError();
  }

  return access;
};

export const requireSuperAdmin = async (): Promise<UserAuthAccessRecord> => {
  const access = await requireAuthenticatedUser();
  if (access.globalRole !== 'SUPER_ADMIN') {
    throw new SuperAdminRequiredError();
  }

  return access;
};

export const requireCourseMembership = async (
  courseId: string
): Promise<CourseAuthorizationRecord> => {
  const access = await requireAuthenticatedUser();
  if (access.globalRole === 'SUPER_ADMIN') {
    return { access, courseAccess: null };
  }

  const persistence = getServerPersistence();
  if (!persistence) {
    throw new Error('DATABASE_URL is not set in environment');
  }

  const courseAccess = await persistence.courseMemberships.getCourseAccessForUser(
    access.userId,
    courseId
  );

  if (!courseAccess) {
    throw new ForbiddenError();
  }

  return {
    access,
    courseAccess,
  };
};

export const requireCourseRole = async (
  courseId: string,
  allowedRoles: readonly CourseMembershipRoleValue[]
): Promise<CourseAuthorizationRecord> => {
  const result = await requireCourseMembership(courseId);
  if (result.access.globalRole === 'SUPER_ADMIN') {
    return result;
  }

  if (!result.courseAccess || !allowedRoles.includes(result.courseAccess.role)) {
    throw new ForbiddenError();
  }

  return result;
};

export const requireActiveCourseRole = async (
  courseId: string,
  allowedRoles: readonly CourseMembershipRoleValue[]
): Promise<CourseAuthorizationRecord> => {
  const result = await requireCourseRole(courseId, allowedRoles);
  if (result.access.globalRole === 'SUPER_ADMIN') {
    return result;
  }

  if (!result.courseAccess || result.courseAccess.status !== 'ACTIVE') {
    throw new ForbiddenError();
  }

  return result;
};

export const requireStaffPageAccess = async (): Promise<UserAuthAccessRecord> => {
  try {
    return await requireStaffUser();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      redirect('/sign-in');
    }

    redirect('/forbidden');
  }
};

export const requireActiveCourseRolePageAccess = async (
  courseId: string,
  allowedRoles: readonly CourseMembershipRoleValue[]
): Promise<CourseAuthorizationRecord> => {
  try {
    return await requireActiveCourseRole(courseId, allowedRoles);
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      redirect('/sign-in');
    }

    redirect('/forbidden');
  }
};

export const requireStaffApiAccess = async (
  options?: AccessOptions
): Promise<UserAuthAccessRecord | NextResponse> => {
  try {
    if (options?.requireSuperAdmin) {
      return await requireSuperAdmin();
    }

    return await requireStaffUser();
  } catch (error) {
    return toApiAuthErrorResponse(error);
  }
};

export const requireActiveCourseRoleApiAccess = async (
  courseId: string,
  allowedRoles: readonly CourseMembershipRoleValue[]
): Promise<CourseAuthorizationRecord | NextResponse> => {
  try {
    return await requireActiveCourseRole(courseId, allowedRoles);
  } catch (error) {
    return toApiAuthErrorResponse(error);
  }
};
