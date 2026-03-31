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
  {
    params,
  }: {
    params: { courseId: string; assignmentId: string; submissionId: string };
  }
) {
  const access = await requireActiveCourseRoleApiAccess(params.courseId, [
    'COURSE_ADMIN',
    'LECTURER',
  ]);
  if (access instanceof NextResponse) return access;

  const persistence = ensurePersistence();
  if (persistence instanceof NextResponse) return persistence;

  try {
    const detail = await persistence.staffOperations.getAssignmentSubmissionDetail(
      access.access.userId,
      params.courseId,
      params.assignmentId,
      params.submissionId,
      {
        bypassCourseScope: access.access.globalRole === 'SUPER_ADMIN',
      }
    );

    if (!detail) {
      return NextResponse.json(
        { ok: false, error: 'Submission not found', code: 'SUBMISSION_NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, data: detail });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        ok: false,
        error: `Failed to load submission detail: ${message}`,
        code: 'SUBMISSION_DETAIL_FAILED',
      },
      { status: 500 }
    );
  }
}
