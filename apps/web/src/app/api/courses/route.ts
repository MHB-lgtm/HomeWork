import { NextRequest, NextResponse } from 'next/server';
import { createCourse, listCourses } from '@hg/local-course-store';

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

export async function GET() {
  const dataDirError = ensureDataDir();
  if (dataDirError) return dataDirError;

  try {
    const courses = await listCourses();
    return NextResponse.json({ ok: true, data: courses });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, error: `Failed to list courses: ${message}` },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const dataDirError = ensureDataDir();
  if (dataDirError) return dataDirError;

  try {
    const body = await request.json();
    const title = (body?.title as string | undefined)?.trim();

    if (!title) {
      return NextResponse.json(
        { ok: false, error: 'title is required' },
        { status: 400 }
      );
    }

    const { courseId } = await createCourse({ title });
    return NextResponse.json({ ok: true, data: { courseId } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, error: `Failed to create course: ${message}` },
      { status: 500 }
    );
  }
}
