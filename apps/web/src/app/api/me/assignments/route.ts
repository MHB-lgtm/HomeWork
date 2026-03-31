import { NextResponse } from 'next/server';
import { getServerPersistence } from '@/lib/server/persistence';
import { requireAuthenticatedUser } from '@/lib/server/session';

export const runtime = 'nodejs';

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

export async function GET() {
  try {
    const access = await requireAuthenticatedUser();
    if (access.globalRole !== 'SUPER_ADMIN' && (access.hasStaffAccess || !access.hasStudentAccess)) {
      return NextResponse.json(
        { ok: false, error: 'Forbidden', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const persistence = ensurePersistence();
    if (persistence instanceof NextResponse) return persistence;

    const assignments =
      access.globalRole === 'SUPER_ADMIN'
        ? []
        : await persistence.assignments.listVisibleAssignmentsForStudent(access.userId);
    const results =
      access.globalRole === 'SUPER_ADMIN'
        ? []
        : await persistence.studentResults.listStudentAssignmentResults(access.userId);
    const visibleStatusByAssignmentId = new Map(
      results.map((result) => [result.assignmentId, result.visibleStatus] as const)
    );
    const data = assignments.map((assignment) => ({
      ...assignment,
      visibleStatus: visibleStatusByAssignmentId.get(assignment.assignmentId) ?? 'OPEN',
    }));

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: 'Authentication required', code: 'AUTH_REQUIRED' },
      { status: 401 }
    );
  }
}
