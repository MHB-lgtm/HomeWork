import { NextRequest, NextResponse } from 'next/server';
import { PostgresCourseRagCourseNotFoundError } from '@hg/postgres-store';
import { getServerPersistence } from '../../../../../../lib/server/persistence';
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

export async function POST(
  _request: NextRequest,
  { params }: { params: { courseId: string } }
) {
  const access = await requireStaffApiAccess();
  if (access instanceof NextResponse) return access;

  const persistence = ensurePersistence();
  if (persistence instanceof NextResponse) return persistence;

  try {
    const result = await persistence.courseRag.rebuildCourseRagIndex(params.courseId);

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
    if (error instanceof PostgresCourseRagCourseNotFoundError) {
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
