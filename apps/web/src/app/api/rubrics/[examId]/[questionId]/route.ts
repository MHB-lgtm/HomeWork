import { NextRequest, NextResponse } from 'next/server';
import { getServerPersistence } from '../../../../../lib/server/persistence';

export const runtime = 'nodejs';

/**
 * GET /api/rubrics/[examId]/[questionId]
 * Retrieve a rubric by examId and questionId
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ examId: string; questionId: string }> }
) {
  try {
    const persistence = getServerPersistence();
    if (!persistence) {
      return NextResponse.json(
        { error: 'DATABASE_URL is not set in environment' },
        { status: 500 }
      );
    }

    const { examId, questionId } = await params;

    if (!examId || !questionId) {
      return NextResponse.json(
        { error: 'examId and questionId are required' },
        { status: 400 }
      );
    }

    const rubric = await persistence.rubrics.getRubric(examId, questionId);
    if (!rubric) {
      return NextResponse.json(
        { error: 'Rubric not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(rubric);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Failed to fetch rubric: ${errorMessage}` },
      { status: 500 }
    );
  }
}

