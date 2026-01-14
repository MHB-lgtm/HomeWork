import { NextRequest, NextResponse } from 'next/server';
import { CourseNotFoundError, getCourse } from '@hg/local-course-store';

export const runtime = 'nodejs';

const ensureDataDir = () => {
  if (!process.env.HG_DATA_DIR) {
    return NextResponse.json(
      { ok: false, error: 'HG_DATA_DIR is not set in environment' },
      { status: 500 }
    );
  }
  return null;
};

export async function GET(
  _request: NextRequest,
  { params }: { params: { courseId: string } }
) {
  const dataDirError = ensureDataDir();
  if (dataDirError) return dataDirError;

  try {
    const course = await getCourse(params.courseId);
    return NextResponse.json({ ok: true, data: course });
  } catch (error) {
    if (error instanceof CourseNotFoundError) {
      return NextResponse.json(
        { ok: false, error: 'Course not found' },
        { status: 404 }
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, error: `Failed to load course: ${message}` },
      { status: 500 }
    );
  }
}
