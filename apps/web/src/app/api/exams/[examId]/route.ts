import { NextRequest, NextResponse } from 'next/server';
import * as path from 'path';
import { getServerPersistence } from '../../../../lib/server/persistence';

export const runtime = 'nodejs';

/**
 * GET /api/exams/[examId]
 * Get a single exam by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  try {
    const persistence = getServerPersistence();
    if (!persistence) {
      return NextResponse.json(
        { error: 'DATABASE_URL is not set in environment', code: 'DATABASE_URL_MISSING' },
        { status: 500 }
      );
    }

    const dataDir = process.env.HG_DATA_DIR;
    if (!dataDir) {
      return NextResponse.json(
        { error: 'HG_DATA_DIR is not set in environment', code: 'HG_DATA_DIR_MISSING' },
        { status: 500 }
      );
    }

    const { examId } = await params;

    if (!examId) {
      return NextResponse.json(
        { error: 'examId is required', code: 'BAD_REQUEST' },
        { status: 400 }
      );
    }

    const DATA_DIR = path.resolve(dataDir);
    const exam = await persistence.exams.getExam(DATA_DIR, examId);
    if (!exam) {
      return NextResponse.json(
        { error: `Exam not found: ${examId}`, code: 'EXAM_NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json(exam);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Failed to fetch exam: ${errorMessage}`, code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

