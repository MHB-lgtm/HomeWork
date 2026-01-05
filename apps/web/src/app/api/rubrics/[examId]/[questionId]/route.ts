import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';

export const runtime = 'nodejs';

/**
 * GET /api/rubrics/[examId]/[questionId]
 * Retrieve a rubric by examId and questionId
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ examId: string; questionId: string }> }
) {
  try {
    const dataDir = process.env.HG_DATA_DIR;
    if (!dataDir) {
      return NextResponse.json(
        { error: 'HG_DATA_DIR is not set in environment' },
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

    const DATA_DIR = path.resolve(dataDir);
    const rubricFilePath = path.join(DATA_DIR, 'rubrics', examId, `${questionId}.json`);

    try {
      const content = await fs.readFile(rubricFilePath, 'utf-8');
      const rubric = JSON.parse(content);
      return NextResponse.json(rubric);
    } catch (error) {
      // Check if file doesn't exist
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return NextResponse.json(
          { error: 'Rubric not found' },
          { status: 404 }
        );
      }
      throw error;
    }
  } catch (error) {
    console.error('Error fetching rubric:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Failed to fetch rubric: ${errorMessage}` },
      { status: 500 }
    );
  }
}

