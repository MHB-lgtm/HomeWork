import { NextRequest, NextResponse } from 'next/server';
import { getServerPersistence } from '../../../../lib/server/persistence';
import { requireStaffApiAccess } from '@/lib/server/session';

export const runtime = 'nodejs';

/**
 * GET /api/exams/[examId]
 * Get a single exam by ID
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  const access = await requireStaffApiAccess();
  if (access instanceof NextResponse) return access;

  try {
    const persistence = getServerPersistence();
    if (!persistence) {
      return NextResponse.json(
        { error: 'DATABASE_URL is not set in environment', code: 'DATABASE_URL_MISSING' },
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

    const exam = await persistence.exams.getExam(examId);
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

