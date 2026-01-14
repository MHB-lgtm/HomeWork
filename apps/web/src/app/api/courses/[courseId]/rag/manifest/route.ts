import { NextRequest, NextResponse } from 'next/server';
import { CourseNotFoundError, getCourse, getCourseRagManifest } from '@hg/local-course-store';

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
    await getCourse(params.courseId);
    const manifest = await getCourseRagManifest(params.courseId);

    if (!manifest) {
      return NextResponse.json(
        { ok: false, error: 'MANIFEST_NOT_FOUND', code: 'MANIFEST_NOT_FOUND' },
        { status: 404 }
      );
    }

    console.log(`[courses] rag.manifest courseId=${params.courseId} ok=true`);

    return NextResponse.json({ ok: true, data: manifest });
  } catch (error) {
    if (error instanceof CourseNotFoundError) {
      return NextResponse.json(
        { ok: false, error: 'COURSE_NOT_FOUND', code: 'COURSE_NOT_FOUND' },
        { status: 404 }
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, error: `Failed to load RAG manifest: ${message}`, code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
