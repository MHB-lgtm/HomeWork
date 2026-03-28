import { NextRequest, NextResponse } from 'next/server';
import * as path from 'path';
import { materializeRubricCompatibility } from '@hg/postgres-store';
import { RubricSpecSchema } from '@hg/shared-schemas';
import { getServerPersistence } from '../../../lib/server/persistence';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const persistence = getServerPersistence();
    if (!persistence) {
      return NextResponse.json(
        { ok: false, error: 'DATABASE_URL is not set in environment' },
        { status: 500 }
      );
    }

    const dataDir = process.env.HG_DATA_DIR;
    if (!dataDir) {
      return NextResponse.json(
        { ok: false, error: 'HG_DATA_DIR is not set in environment' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const examId = searchParams.get('examId');

    if (!examId) {
      return NextResponse.json(
        { ok: false, error: 'examId is required' },
        { status: 400 }
      );
    }

    const questionIds = await persistence.rubrics.listRubricQuestionIds(examId);
    return NextResponse.json({ ok: true, data: { questionIds } });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, error: `Failed to list questionIds: ${errorMessage}` },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const persistence = getServerPersistence();
    if (!persistence) {
      return NextResponse.json(
        { error: 'DATABASE_URL is not set in environment' },
        { status: 500 }
      );
    }

    const dataDir = process.env.HG_DATA_DIR;
    if (!dataDir) {
      return NextResponse.json(
        { error: 'HG_DATA_DIR is not set in environment' },
        { status: 500 }
      );
    }

    const body = await request.json();

    let rubric;
    try {
      rubric = RubricSpecSchema.parse(body);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return NextResponse.json(
        { error: `Invalid rubric: ${errorMessage}` },
        { status: 400 }
      );
    }

    const savedRubric = await persistence.rubrics.saveRubric(rubric);
    await materializeRubricCompatibility({
      dataDir: path.resolve(dataDir),
      rubric: savedRubric,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Exam not found:')) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Failed to save rubric: ${errorMessage}` },
      { status: 500 }
    );
  }
}
