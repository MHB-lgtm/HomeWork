import { NextRequest, NextResponse } from 'next/server';
import { getServerPersistence } from '../../../lib/server/persistence';
import { requireStaffApiAccess } from '@/lib/server/session';

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
  const access = await requireStaffApiAccess();
  if (access instanceof NextResponse) return access;

  const persistence = ensurePersistence();
  if (persistence instanceof NextResponse) return persistence;

  try {
    const courses =
      access.globalRole === 'SUPER_ADMIN'
        ? await persistence.courses.listCourses()
        : await persistence.courseMemberships.listStaffCoursesForUser(access.userId);
    return NextResponse.json({ ok: true, data: courses });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, error: `Failed to list courses: ${message}`, code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const access = await requireStaffApiAccess({ requireSuperAdmin: true });
  if (access instanceof NextResponse) return access;

  const persistence = ensurePersistence();
  if (persistence instanceof NextResponse) return persistence;

  try {
    const body = await request.json();
    const title = (body?.title as string | undefined)?.trim();

    if (!title) {
      return NextResponse.json(
        { ok: false, error: 'title is required', code: 'BAD_REQUEST' },
        { status: 400 }
      );
    }

    const course = await persistence.courses.createCourse({ title });

    return NextResponse.json({ ok: true, data: { courseId: course.courseId } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, error: `Failed to create course: ${message}`, code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
