import { NextRequest, NextResponse } from 'next/server';
import { getServerPersistence } from '@/lib/server/persistence';
import { getResolvedReviewDetail } from '@/lib/server/reviewDetail';

export const runtime = 'nodejs';

const isPublicationConflictError = (error: unknown): error is Error =>
  error instanceof Error &&
  error.name === 'LegacyReviewPublicationConflictError';

/**
 * POST /api/reviews/[jobId]/publish
 * Publish the current imported review version into PublishedResult / GradebookEntry.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    if (!jobId) {
      return NextResponse.json(
        { ok: false, error: 'jobId is required' },
        { status: 400 }
      );
    }

    const persistence = getServerPersistence();
    if (!persistence) {
      return NextResponse.json(
        { ok: false, error: 'Publish is only available when Postgres persistence is configured' },
        { status: 409 }
      );
    }

    const resolved = await getResolvedReviewDetail(jobId);
    const publication = await persistence.reviewRecords.publishReviewByLegacyJobId(jobId, {
      actorRef: 'legacy:review-route',
      reviewRecord: resolved.review,
      context: resolved.context,
    });
    return NextResponse.json({
      ok: true,
      data: publication,
    });
  } catch (error) {
    if (isPublicationConflictError(error)) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 409 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, error: `Failed to publish review: ${errorMessage}` },
      { status: 500 }
    );
  }
}
