import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';
import { getJob } from '@hg/local-job-store';

export const runtime = 'nodejs';

/**
 * GET /api/jobs/[id]/submission
 * Get the submission image file for a job
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const dataDir = process.env.HG_DATA_DIR;
    if (!dataDir) {
      return NextResponse.json(
        { error: 'HG_DATA_DIR is not set in environment' },
        { status: 500 }
      );
    }

    const { id: jobId } = await params;

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    // Load job record
    const job = await getJob(jobId);

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Check if submission file path exists
    if (!job.inputs.submissionFilePath) {
      return NextResponse.json(
        { error: 'Submission file path not found in job' },
        { status: 404 }
      );
    }

    // Check file extension
    const ext = path.extname(job.inputs.submissionFilePath).toLowerCase();
    const supportedExtensions = ['.png', '.jpg', '.jpeg'];
    
    if (!supportedExtensions.includes(ext)) {
      return NextResponse.json(
        { error: 'Submission review supports PNG/JPG only for now.' },
        { status: 415 }
      );
    }

    // Determine MIME type
    const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';

    // Read file
    let fileBuffer: Buffer;
    try {
      fileBuffer = await fs.readFile(job.inputs.submissionFilePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return NextResponse.json(
          { error: 'Submission file not found' },
          { status: 404 }
        );
      }
      throw error;
    }

    // Return image with appropriate headers
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Failed to fetch submission: ${errorMessage}` },
      { status: 500 }
    );
  }
}

