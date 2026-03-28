import { NextRequest, NextResponse } from 'next/server';
import { getServerPersistence } from '../../../../lib/server/persistence';

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
  _request: NextRequest,
  { params }: { params: { courseId: string } }
) {
  const persistence = ensurePersistence();
  if (persistence instanceof NextResponse) return persistence;

  try {
    const course = await persistence.courses.getCourse(params.courseId);
    if (!course) {
      return NextResponse.json(
        { ok: false, error: 'Course not found', code: 'COURSE_NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, data: course });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, error: `Failed to load course: ${message}`, code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
