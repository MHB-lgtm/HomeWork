import { NextRequest, NextResponse } from 'next/server';
import { PostgresCourseMembershipCourseNotFoundError } from '@hg/postgres-store';
import { getServerPersistence } from '../../../../../lib/server/persistence';
import { requireActiveCourseRoleApiAccess } from '@/lib/server/session';

export const runtime = 'nodejs';

const MEMBERSHIP_ROLES = ['COURSE_ADMIN', 'LECTURER', 'STUDENT'] as const;
const MEMBERSHIP_STATUSES = ['INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED'] as const;

const ensurePersistence = () => {
  const persistence = getServerPersistence();
  if (!persistence) {
    return NextResponse.json(
      { ok: false, error: 'DATABASE_URL is not set in environment', code: 'DATABASE_URL_MISSING' },
      { status: 500 }
    );
  }

  return persistence;
};

const parsePayload = (body: unknown) => {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false as const, error: 'Payload must be an object' };
  }

  const record = body as Record<string, unknown>;
  const email = typeof record.email === 'string' ? record.email.trim() : '';
  const displayName =
    typeof record.displayName === 'string' ? record.displayName.trim() : record.displayName === null ? null : undefined;
  const role =
    typeof record.role === 'string' && MEMBERSHIP_ROLES.includes(record.role as (typeof MEMBERSHIP_ROLES)[number])
      ? (record.role as (typeof MEMBERSHIP_ROLES)[number])
      : null;
  const status =
    typeof record.status === 'string' && MEMBERSHIP_STATUSES.includes(record.status as (typeof MEMBERSHIP_STATUSES)[number])
      ? (record.status as (typeof MEMBERSHIP_STATUSES)[number])
      : null;

  if (!email) {
    return { ok: false as const, error: 'email is required' };
  }

  if (!role) {
    return { ok: false as const, error: 'role must be one of COURSE_ADMIN, LECTURER, STUDENT' };
  }

  if (!status) {
    return { ok: false as const, error: 'status must be one of INVITED, ACTIVE, SUSPENDED, REMOVED' };
  }

  if (displayName !== undefined && displayName !== null && displayName.length === 0) {
    return { ok: true as const, data: { email, displayName: null, role, status } };
  }

  return {
    ok: true as const,
    data: {
      email,
      displayName: displayName ?? null,
      role,
      status,
    },
  };
};

export async function GET(
  _request: NextRequest,
  { params }: { params: { courseId: string } }
) {
  const access = await requireActiveCourseRoleApiAccess(params.courseId, ['COURSE_ADMIN']);
  if (access instanceof NextResponse) return access;

  const persistence = ensurePersistence();
  if (persistence instanceof NextResponse) return persistence;

  try {
    const memberships = await persistence.courseMemberships.listCourseMemberships(params.courseId);
    return NextResponse.json({ ok: true, data: memberships });
  } catch (error) {
    if (error instanceof PostgresCourseMembershipCourseNotFoundError) {
      return NextResponse.json(
        { ok: false, error: 'Course not found', code: 'COURSE_NOT_FOUND' },
        { status: 404 }
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, error: `Failed to list memberships: ${message}`, code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { courseId: string } }
) {
  const access = await requireActiveCourseRoleApiAccess(params.courseId, ['COURSE_ADMIN']);
  if (access instanceof NextResponse) return access;

  const persistence = ensurePersistence();
  if (persistence instanceof NextResponse) return persistence;

  try {
    const body = await request.json();
    const parsed = parsePayload(body);
    if (!parsed.ok) {
      return NextResponse.json(
        { ok: false, error: parsed.error, code: 'BAD_REQUEST' },
        { status: 400 }
      );
    }

    const membership = await persistence.courseMemberships.upsertMembershipByEmail({
      courseId: params.courseId,
      email: parsed.data.email,
      displayName: parsed.data.displayName,
      role: parsed.data.role,
      status: parsed.data.status,
      invitedByUserId: access.access.userId,
    });

    return NextResponse.json({ ok: true, data: membership });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { ok: false, error: 'Invalid JSON body', code: 'BAD_REQUEST' },
        { status: 400 }
      );
    }

    if (error instanceof PostgresCourseMembershipCourseNotFoundError) {
      return NextResponse.json(
        { ok: false, error: 'Course not found', code: 'COURSE_NOT_FOUND' },
        { status: 404 }
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, error: `Failed to save membership: ${message}`, code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
