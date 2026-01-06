import { NextRequest, NextResponse } from 'next/server';
import * as path from 'path';
import { createExam, listExams, ExamLoadError } from '../../../lib/exams';

export const runtime = 'nodejs';

/**
 * POST /api/exams
 * Create a new exam package
 */
export async function POST(request: NextRequest) {
  try {
    const dataDir = process.env.HG_DATA_DIR;
    if (!dataDir) {
      return NextResponse.json(
        { error: 'HG_DATA_DIR is not set in environment', code: 'HG_DATA_DIR_MISSING' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const title = formData.get('title') as string | null;
    const examFile = formData.get('examFile') as File | null;

    if (!title || !title.trim()) {
      return NextResponse.json(
        { error: 'title is required', code: 'BAD_REQUEST' },
        { status: 400 }
      );
    }

    if (!examFile) {
      return NextResponse.json(
        { error: 'examFile is required', code: 'BAD_REQUEST' },
        { status: 400 }
      );
    }

    const DATA_DIR = path.resolve(dataDir);
    const examFileBuffer = Buffer.from(await examFile.arrayBuffer());

    const { examId } = await createExam(
      DATA_DIR,
      title.trim(),
      examFile.name,
      examFileBuffer
    );

    return NextResponse.json({ examId });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Failed to create exam: ${errorMessage}`, code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/exams
 * List all exams
 */
export async function GET(request: NextRequest) {
  try {
    const dataDir = process.env.HG_DATA_DIR;
    if (!dataDir) {
      return NextResponse.json(
        { error: 'HG_DATA_DIR is not set in environment', code: 'HG_DATA_DIR_MISSING' },
        { status: 500 }
      );
    }

    const DATA_DIR = path.resolve(dataDir);
    const exams = await listExams(DATA_DIR);

    return NextResponse.json(exams);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Failed to list exams: ${errorMessage}`, code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

