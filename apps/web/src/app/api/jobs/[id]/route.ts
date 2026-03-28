import { NextRequest, NextResponse } from 'next/server';
import { getServerPersistence } from '@/lib/server/persistence';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const runtimeJob = await persistence.jobs.getJobStatus(jobId);
    if (!runtimeJob) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      status: runtimeJob.status,
      resultJson: runtimeJob.resultJson,
      errorMessage: runtimeJob.errorMessage,
      submissionMimeType: runtimeJob.submissionMimeType,
      gradingMode: runtimeJob.gradingMode,
      gradingScope: runtimeJob.gradingScope,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Failed to fetch job: ${errorMessage}` },
      { status: 500 }
    );
  }
}

