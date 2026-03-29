import { NextRequest, NextResponse } from 'next/server';
import {
  RagQueryRequestV1Schema,
  RagQueryResponseV1,
} from '@hg/shared-schemas';
import {
  PostgresCourseRagCourseNotFoundError,
  PostgresCourseRagIndexNotBuiltError,
} from '@hg/postgres-store';
import { getServerPersistence } from '../../../../../../lib/server/persistence';

export const runtime = 'nodejs';

const ensurePersistence = () => {
  const persistence = getServerPersistence();
  if (!persistence) {
    return NextResponse.json<{ ok: false; error: string; code: 'DATABASE_URL_MISSING' }>(
      { ok: false, error: 'DATABASE_URL is not set in environment', code: 'DATABASE_URL_MISSING' },
      { status: 500 }
    );
  }
  return persistence;
};

export async function POST(
  request: NextRequest,
  { params }: { params: { courseId: string } }
): Promise<NextResponse<RagQueryResponseV1 | { ok: false; error: string; code?: string }>> {
  const persistence = ensurePersistence();
  if (persistence instanceof NextResponse) return persistence;

  try {
    const body = await request.json();
    const parsed = RagQueryRequestV1Schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.message, code: 'BAD_REQUEST' },
        { status: 400 }
      );
    }

    const k = parsed.data.k ?? 5;
    const queryText = parsed.data.query.trim();
    if (queryText.length < 3) {
      return NextResponse.json(
        { ok: false, error: 'query must be at least 3 characters', code: 'BAD_REQUEST' },
        { status: 400 }
      );
    }

    const result = await persistence.courseRag.queryCourseIndex(params.courseId, {
      query: queryText,
      k,
      method: parsed.data.method ?? 'lexical_v1',
    });

    console.log(
      `[courses] rag.query courseId=${params.courseId} k=${k} hits=${result.hits.length} method=${result.method}`
    );

    return NextResponse.json({
      ok: true,
      data: {
        hits: result.hits,
        method: result.method,
      },
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { ok: false, error: 'Invalid JSON body', code: 'BAD_REQUEST' },
        { status: 400 }
      );
    }

    if (error instanceof PostgresCourseRagIndexNotBuiltError) {
      return NextResponse.json(
        { ok: false, error: 'INDEX_NOT_BUILT', code: 'INDEX_NOT_BUILT' },
        { status: 409 }
      );
    }

    if (error instanceof PostgresCourseRagCourseNotFoundError) {
      return NextResponse.json(
        { ok: false, error: 'COURSE_NOT_FOUND', code: 'COURSE_NOT_FOUND' },
        { status: 404 }
      );
    }

    if (error instanceof Error && error.message.startsWith('Unsupported query method')) {
      return NextResponse.json(
        { ok: false, error: error.message, code: 'BAD_REQUEST' },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, error: `Failed to query course index: ${message}` },
      { status: 500 }
    );
  }
}
