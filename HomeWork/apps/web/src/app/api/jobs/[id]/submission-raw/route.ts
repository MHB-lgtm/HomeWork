import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';
import { getServerPersistence } from '@/lib/server/persistence';
import { requireStaffApiAccess } from '@/lib/server/session';

export const runtime = 'nodejs';

/**
 * Infer MIME type from file extension
 */
function inferMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
  };

  const mimeType = mimeMap[ext];
  if (!mimeType) {
    throw new Error(`Unsupported file extension: ${ext}. Supported: .png, .jpg, .jpeg, .webp, .pdf`);
  }

  return mimeType;
}

/**
 * GET /api/jobs/[id]/submission-raw
 * Get the raw submission file (PDF or image) for a job
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
    const submissionPath = runtimeSubmission?.path ?? null;
    const submissionMimeType = runtimeSubmission?.mimeType ?? null;
    if (!submissionPath) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Determine MIME type: prefer job.inputs.submissionMimeType, else infer from extension
    let mimeType: string;
    try {
      mimeType = submissionMimeType || inferMimeType(submissionPath);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Unsupported file type' },
        { status: 415 }
      );
    }

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

    // Return file with appropriate headers
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
