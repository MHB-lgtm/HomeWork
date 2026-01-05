import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';
import { RubricSpecSchema } from '@hg/shared-schemas';

export const runtime = 'nodejs';

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

