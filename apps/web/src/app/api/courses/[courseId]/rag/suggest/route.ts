import { NextRequest, NextResponse } from 'next/server';
import {
  SuggestRequestV1Schema,
  SuggestResponseV1,
} from '@hg/shared-schemas';
import { CourseNotFoundError, IndexNotBuiltError, suggestStudyPointers } from '@hg/local-course-store';

export const runtime = 'nodejs';

const ensureDataDir = () => {
  if (!process.env.HG_DATA_DIR) {
    return NextResponse.json<{ ok: false; error: string; code: 'HG_DATA_DIR_MISSING' }>(
      { ok: false, error: 'HG_DATA_DIR is not set in environment', code: 'HG_DATA_DIR_MISSING' },
      { status: 500 }
    );
  }
  return null;
};

export async function POST(
  request: NextRequest,
  { params }: { params: { courseId: string } }
): Promise<NextResponse<SuggestResponseV1 | { ok: false; error: string; code?: string }>> {
  const dataDirError = ensureDataDir();
  if (dataDirError) return dataDirError;

  try {
    const body = await request.json();
    const parsed = SuggestRequestV1Schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.message, code: 'BAD_REQUEST' },
        { status: 400 }
      );
    }

    const k = parsed.data.k ?? 3;
    const issueText = parsed.data.issueText.trim();
    if (issueText.length < 10) {
      return NextResponse.json(
        { ok: false, error: 'issueText must be at least 10 characters', code: 'BAD_REQUEST' },
        { status: 400 }
      );
    }

    const result = await suggestStudyPointers(params.courseId, {
      issueText,
      k,
    });

    console.log(
      `[courses] rag.suggest courseId=${params.courseId} k=${k} pointers=${result.pointers.length}`
    );

    return NextResponse.json({
      ok: true,
      data: {
        pointers: result.pointers,
      },
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { ok: false, error: 'Invalid JSON body', code: 'BAD_REQUEST' },
        { status: 400 }
      );
    }

    if (error instanceof IndexNotBuiltError) {
      return NextResponse.json(
        { ok: false, error: 'INDEX_NOT_BUILT', code: 'INDEX_NOT_BUILT' },
        { status: 409 }
      );
    }

    if (error instanceof CourseNotFoundError) {
      return NextResponse.json(
        { ok: false, error: 'COURSE_NOT_FOUND', code: 'COURSE_NOT_FOUND' },
        { status: 404 }
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, error: `Failed to suggest study pointers: ${message}` },
      { status: 500 }
    );
  }
}
