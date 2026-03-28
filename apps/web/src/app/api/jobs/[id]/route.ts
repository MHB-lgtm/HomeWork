import { NextRequest, NextResponse } from 'next/server';
import { getJob } from '@hg/local-job-store';
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
    const runtimeJob = persistence ? await persistence.jobs.getJobStatus(jobId) : null;
    if (runtimeJob) {
      return NextResponse.json({
        status: runtimeJob.status,
        resultJson: runtimeJob.resultJson,
        errorMessage: runtimeJob.errorMessage,
        submissionMimeType: runtimeJob.submissionMimeType,
        gradingMode: runtimeJob.gradingMode,
        gradingScope: runtimeJob.gradingScope,
      });
    }

    if (!process.env.HG_DATA_DIR) {
      return NextResponse.json(
        { error: 'HG_DATA_DIR is not set in environment' },
        { status: 500 }
      );
    }

    const job = await getJob(jobId);

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      status: job.status,
      resultJson: job.resultJson,
      errorMessage: job.errorMessage,
      submissionMimeType: job.inputs.submissionMimeType,
      gradingMode: job.inputs.gradingMode,
      gradingScope: job.inputs.gradingScope,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Failed to fetch job: ${errorMessage}` },
      { status: 500 }
    );
  }
}

