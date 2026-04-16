import { NextResponse } from 'next/server';
import { isSupabaseObjectStorageEnabled } from '@hg/postgres-store';
import * as path from 'path';
import { getServerPersistence } from '@/lib/server/persistence';
import { requireStudentAssignmentAccess } from '@/lib/server/session';

export const runtime = 'nodejs';

const ensurePersistence = () => {
  const persistence = getServerPersistence();
  if (!persistence) {
    return NextResponse.json(
      { ok: false, error: 'DATABASE_URL is not set in environment', code: 'DATABASE_URL_MISSING' },
      { status: 500 }
    );
  }

  return persistence;
};

export async function POST(
  request: Request,
  { params }: { params: { assignmentId: string } }
) {
  try {
    const access = await requireStudentAssignmentAccess(params.assignmentId);
    const persistence = ensurePersistence();
    if (persistence instanceof NextResponse) return persistence;

    const dataDir = process.env.HG_DATA_DIR;
    if (!dataDir && !isSupabaseObjectStorageEnabled()) {
      return NextResponse.json(
        {
          ok: false,
          error: 'HG_DATA_DIR or Supabase object storage configuration is required',
          code: 'ASSET_STORAGE_MISSING',
        },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const submission = formData.get('submission') as File | null;
    if (!submission) {
      return NextResponse.json(
        { ok: false, error: 'submission is required', code: 'BAD_REQUEST' },
        { status: 400 }
      );
    }

    const { jobId } = await persistence.jobs.createAssignmentSubmissionJob({
      dataDir: dataDir ? path.resolve(dataDir) : undefined,
      assignmentId: params.assignmentId,
      studentUserId: access.access.userId,
      submission: {
        originalName: submission.name,
        buffer: Buffer.from(await submission.arrayBuffer()),
        mimeType: submission.type || undefined,
      },
    });

    return NextResponse.json({ ok: true, data: { jobId } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'Authentication required') {
      return NextResponse.json(
        { ok: false, error: message, code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    if (
      message.includes('Assignment is not open') ||
      message.includes('Assignment is closed') ||
      message.includes('deadline has passed') ||
      message.includes('Assignment exam index is not ready')
    ) {
      return NextResponse.json(
        { ok: false, error: message, code: 'ASSIGNMENT_NOT_ACCEPTING_SUBMISSIONS' },
        { status: 409 }
      );
    }

    if (message.includes('Assignment not found')) {
      return NextResponse.json(
        { ok: false, error: 'Assignment not found', code: 'ASSIGNMENT_NOT_FOUND' },
        { status: 404 }
      );
    }

    if (message === 'Forbidden') {
      return NextResponse.json(
        { ok: false, error: message, code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { ok: false, error: `Failed to submit assignment: ${message}`, code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
