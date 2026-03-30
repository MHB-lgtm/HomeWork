import { NextRequest, NextResponse } from 'next/server';
import { PostgresCourseRagCourseNotFoundError } from '@hg/postgres-store';
import { getServerPersistence } from '../../../../../../lib/server/persistence';
import { requireActiveCourseRoleApiAccess } from '@/lib/server/session';

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
  const access = await requireActiveCourseRoleApiAccess(params.courseId, [
    'COURSE_ADMIN',
    'LECTURER',
  ]);
  if (access instanceof NextResponse) return access;

  const persistence = ensurePersistence();
  if (persistence instanceof NextResponse) return persistence;

  try {
    const manifest = await persistence.courseRag.getCourseRagManifest(params.courseId);

    if (!manifest) {
      return NextResponse.json(
        { ok: false, error: 'MANIFEST_NOT_FOUND', code: 'MANIFEST_NOT_FOUND' },
        { status: 404 }
      );
    }

    console.log(`[courses] rag.manifest courseId=${params.courseId} ok=true`);

    return NextResponse.json({ ok: true, data: manifest });
  } catch (error) {
    if (error instanceof PostgresCourseRagCourseNotFoundError) {
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
