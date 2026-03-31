import { NextResponse } from 'next/server';
import { getServerPersistence } from '@/lib/server/persistence';
import { requireStudentAssignmentAccess } from '@/lib/server/session';

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

export async function GET(
  _request: Request,
  { params }: { params: { assignmentId: string } }
) {
  try {
    const access = await requireStudentAssignmentAccess(params.assignmentId);
    const persistence = ensurePersistence();
    if (persistence instanceof NextResponse) return persistence;

    const assignment =
      access.access.globalRole === 'SUPER_ADMIN'
        ? await persistence.assignments.getAssignment(params.assignmentId)
        : access.assignment;
    if (!assignment) {
      return NextResponse.json(
        { ok: false, error: 'Assignment not found', code: 'ASSIGNMENT_NOT_FOUND' },
        { status: 404 }
      );
    }

    const result =
      access.access.globalRole === 'SUPER_ADMIN'
        ? null
        : await persistence.studentResults.getStudentAssignmentResult(
            access.access.userId,
            params.assignmentId
          );

    return NextResponse.json({
      ok: true,
      data: {
        ...assignment,
        visibleStatus: result?.visibleStatus ?? 'OPEN',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'Authentication required') {
      return NextResponse.json(
        { ok: false, error: message, code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { ok: false, error: 'Forbidden', code: 'FORBIDDEN' },
      { status: 403 }
    );
  }
}
