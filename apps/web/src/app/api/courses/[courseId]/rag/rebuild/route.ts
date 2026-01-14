import { NextRequest, NextResponse } from 'next/server';
import { CourseNotFoundError, rebuildCourseRagIndex } from '@hg/local-course-store';

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

export async function POST(
  _request: NextRequest,
  { params }: { params: { courseId: string } }
) {
  const dataDirError = ensureDataDir();
  if (dataDirError) return dataDirError;

  try {
    const result = await rebuildCourseRagIndex(params.courseId);

    console.log(
      `[courses] rag.rebuild courseId=${params.courseId} lectureCount=${result.lectureCount} chunkCount=${result.chunkCount}`
    );

    return NextResponse.json({
      ok: true,
      data: {
        chunkCount: result.chunkCount,
        lectureCount: result.lectureCount,
        builtAt: result.manifest.builtAt,
      },
    });
  } catch (error) {
    if (error instanceof CourseNotFoundError) {
      return NextResponse.json(
        { ok: false, error: 'COURSE_NOT_FOUND', code: 'COURSE_NOT_FOUND' },
        { status: 404 }
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, error: `Failed to rebuild course index: ${message}`, code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
