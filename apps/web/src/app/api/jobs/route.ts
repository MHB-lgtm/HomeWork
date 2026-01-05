import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createJob } from '@hg/local-job-store';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const dataDir = process.env.HG_DATA_DIR;
    if (!dataDir) {
      return NextResponse.json(
        { error: 'HG_DATA_DIR is not set in environment' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const questionFile = formData.get('question') as File | null;
    const submissionFile = formData.get('submission') as File | null;
    const notes = formData.get('notes') as string | null;

    if (!questionFile || !submissionFile) {
      return NextResponse.json(
        { error: 'Both question and submission files are required' },
        { status: 400 }
      );
    }

    const DATA_DIR = path.resolve(dataDir);
    const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
    await fs.mkdir(UPLOADS_DIR, { recursive: true });

    // Generate unique filenames
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    const questionExt = path.extname(questionFile.name);
    const submissionExt = path.extname(submissionFile.name);

    const questionFileName = `question_${timestamp}_${random}${questionExt}`;
    const submissionFileName = `submission_${timestamp}_${random}${submissionExt}`;

    const questionPath = path.join(UPLOADS_DIR, questionFileName);
    const submissionPath = path.join(UPLOADS_DIR, submissionFileName);

    // Write files
    const questionBuffer = Buffer.from(await questionFile.arrayBuffer());
    const submissionBuffer = Buffer.from(await submissionFile.arrayBuffer());

    await fs.writeFile(questionPath, questionBuffer);
    await fs.writeFile(submissionPath, submissionBuffer);

    // Create job
    const { jobId } = await createJob({
      questionSourcePath: questionPath,
      submissionSourcePath: submissionPath,
      notes: notes || undefined,
    });

    return NextResponse.json({ jobId });
  } catch (error) {
    console.error('Error creating job:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Failed to create job: ${errorMessage}` },
      { status: 500 }
    );
  }
}

