import { NextRequest, NextResponse } from 'next/server';
import * as path from 'path';
import { getExam, ExamNotFoundError } from '../../../../lib/exams';

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

    try {
      const exam = await getExam(DATA_DIR, examId);
      return NextResponse.json(exam);
    } catch (error) {
      if (error instanceof ExamNotFoundError) {
        return NextResponse.json(
          { error: error.message, code: 'EXAM_NOT_FOUND' },
          { status: 404 }
        );
      }
      throw error;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Failed to fetch exam: ${errorMessage}`, code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

