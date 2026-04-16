import { NextRequest, NextResponse } from 'next/server';
import { ExamIndexSchema, ExamIndex } from '@hg/shared-schemas';
import { getServerPersistence } from '../../../../../lib/server/persistence';
import { requireStaffApiAccess } from '@/lib/server/session';

export const runtime = 'nodejs';

/**
 * GET /api/exams/[examId]/index
 * Get exam index for an exam
 */
export async function GET(
  request: NextRequest,
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

    const examIndex = await persistence.examIndexes.getExamIndex(examId);

    // Return null if not found (consistent behavior)
    return NextResponse.json({ ok: true, data: examIndex });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Failed to fetch exam index: ${errorMessage}`, code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/exams/[examId]/index
 * Update exam index for an exam
 */
export async function PUT(
  request: NextRequest,
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
    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body', code: 'BAD_REQUEST' },
        { status: 400 }
      );
    }

    // Validate with schema
    let examIndex: ExamIndex;
    try {
      examIndex = ExamIndexSchema.parse(body);
    } catch (error) {
      const validationError = error instanceof Error ? error.message : String(error);
      return NextResponse.json(
        { error: `Validation failed: ${validationError}`, code: 'BAD_REQUEST' },
        { status: 400 }
      );
    }

    // Ensure examId matches route param
    if (examIndex.examId !== examId) {
      return NextResponse.json(
        { error: `examId mismatch: expected "${examId}", got "${examIndex.examId}"`, code: 'BAD_REQUEST' },
        { status: 400 }
      );
    }

    // Check if this is a new index (for setting generatedAt)
    const existingIndex = await persistence.examIndexes.getExamIndex(examId);
    const now = new Date().toISOString();

    // Set updatedAt to now (ignore client value)
    examIndex.updatedAt = now;

    // If generatedAt is missing or this is a new index, set it
    if (!examIndex.generatedAt || !existingIndex) {
      examIndex.generatedAt = now;
    }

    await persistence.examIndexes.saveExamIndex(examIndex);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Failed to save exam index: ${errorMessage}`, code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
