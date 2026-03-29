import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';
import { getServerPersistence } from '@/lib/server/persistence';
import { requireStaffApiAccess } from '@/lib/server/session';

export const runtime = 'nodejs';

/**
 * GET /api/jobs/[id]/submission
 * Get the submission image file for a job
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireStaffApiAccess();
  if (access instanceof NextResponse) return access;

  try {
    const { id: jobId } = await params;

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    const persistence = getServerPersistence();
    if (!persistence) {
      return NextResponse.json(
        { error: 'DATABASE_URL is not set in environment' },
        { status: 500 }
      );
    }

    const runtimeSubmission = await persistence.jobs.getJobSubmissionAsset(jobId);
    const submissionPath: string | null = runtimeSubmission?.path ?? null;
    if (!submissionPath) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    const ext = path.extname(submissionPath).toLowerCase();
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
      fileBuffer = await fs.readFile(submissionPath);
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
    return new NextResponse(new Uint8Array(fileBuffer), {
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

