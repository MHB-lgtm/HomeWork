import { NextResponse } from 'next/server';
import { getServerPersistence } from '@/lib/server/persistence';
import { requireActiveCourseRoleApiAccess } from '@/lib/server/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
  { params }: { params: { courseId: string; assignmentId: string } }
) {
  const access = await requireActiveCourseRoleApiAccess(params.courseId, [
    'COURSE_ADMIN',
    'LECTURER',
  ]);
  if (access instanceof NextResponse) return access;

  const persistence = ensurePersistence();
  if (persistence instanceof NextResponse) return persistence;

  try {
    const [dashboardRows, submissions] = await Promise.all([
      persistence.staffOperations.listStaffDashboardAssignments(access.access.userId, {
        bypassCourseScope: access.access.globalRole === 'SUPER_ADMIN',
      }),
      persistence.staffOperations.listAssignmentSubmissionRows(
        access.access.userId,
        params.courseId,
        params.assignmentId,
        {
          bypassCourseScope: access.access.globalRole === 'SUPER_ADMIN',
        }
      ),
    ]);

    const assignment = dashboardRows.find(
      (row) =>
        row.courseId === params.courseId && row.assignmentId === params.assignmentId
    );
    if (!assignment) {
      return NextResponse.json(
        { ok: false, error: 'Assignment not found', code: 'ASSIGNMENT_NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: {
        assignment,
        submissions,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        ok: false,
        error: `Failed to load assignment submissions: ${message}`,
        code: 'ASSIGNMENT_SUBMISSIONS_FAILED',
      },
      { status: 500 }
    );
  }
}
