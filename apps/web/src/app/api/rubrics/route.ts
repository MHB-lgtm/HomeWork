import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';
import { RubricSpecSchema } from '@hg/shared-schemas';

export const runtime = 'nodejs';

/**
 * Helper: List questionIds for an exam
 */
async function listQuestionIdsForExam(dataDir: string, examId: string): Promise<string[]> {
  const EXAM_DIR = path.join(dataDir, 'rubrics', examId);
  
  try {
    const files = await fs.readdir(EXAM_DIR);
    return files
      .filter((file) => file.endsWith('.json'))
      .map((file) => file.replace(/\.json$/, ''));
  } catch (error) {
    // Directory doesn't exist -> return empty list
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

/**
 * GET /api/rubrics?examId=<id>
 * List questionIds for an exam
 */
export async function GET(request: NextRequest) {
  try {
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

    const DATA_DIR = path.resolve(dataDir);
    const questionIds = await listQuestionIdsForExam(DATA_DIR, examId);

    return NextResponse.json({ ok: true, data: { questionIds } });
  } catch (error) {
    console.error('Error listing rubric questionIds:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, error: `Failed to list questionIds: ${errorMessage}` },
      { status: 500 }
    );
  }
}

/**
 * POST /api/rubrics
 * Create or update a rubric
 * Body: RubricSpec JSON
 */
export async function POST(request: NextRequest) {
  try {
    const dataDir = process.env.HG_DATA_DIR;
    if (!dataDir) {
      return NextResponse.json(
        { error: 'HG_DATA_DIR is not set in environment' },
        { status: 500 }
      );
    }

    const body = await request.json();

    // Validate with RubricSpecSchema
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

    const DATA_DIR = path.resolve(dataDir);
    const RUBRICS_DIR = path.join(DATA_DIR, 'rubrics');
    const EXAM_DIR = path.join(RUBRICS_DIR, rubric.examId);

    // Create directories if missing
    await fs.mkdir(EXAM_DIR, { recursive: true });

    // Write file atomically (write to temp file, then rename)
    const rubricFilePath = path.join(EXAM_DIR, `${rubric.questionId}.json`);
    const tempFilePath = `${rubricFilePath}.tmp`;

    await fs.writeFile(tempFilePath, JSON.stringify(rubric, null, 2), 'utf-8');
    await fs.rename(tempFilePath, rubricFilePath);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error saving rubric:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Failed to save rubric: ${errorMessage}` },
      { status: 500 }
    );
  }
}

