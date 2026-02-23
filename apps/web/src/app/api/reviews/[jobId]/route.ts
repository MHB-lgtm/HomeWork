import { NextRequest, NextResponse } from 'next/server';
import { ReviewRecordSchema, ReviewRecord } from '@hg/shared-schemas';
import { getOrCreateReview, saveReview } from '@hg/local-job-store';

export const runtime = 'nodejs';

/**
 * GET /api/reviews/[jobId]
 * Get a review record (returns empty record if none exists)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const dataDir = process.env.HG_DATA_DIR;
    if (!dataDir) {
      return NextResponse.json(
        { ok: false, error: 'HG_DATA_DIR is not set in environment' },
        { status: 500 }
      );
    }

    const { jobId } = await params;

    if (!jobId) {
      return NextResponse.json(
        { ok: false, error: 'jobId is required' },
        { status: 400 }
      );
    }

    // Get or create review (returns empty if not found)
    const review = await getOrCreateReview(jobId);

    return NextResponse.json({ ok: true, data: review });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, error: `Failed to fetch review: ${errorMessage}` },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/reviews/[jobId]
 * Create or update a review record
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const dataDir = process.env.HG_DATA_DIR;
    if (!dataDir) {
      return NextResponse.json(
        { ok: false, error: 'HG_DATA_DIR is not set in environment' },
        { status: 500 }
      );
    }

    const { jobId } = await params;

    if (!jobId) {
      return NextResponse.json(
        { ok: false, error: 'jobId is required' },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Validate request body with ReviewRecordSchema
    let review: ReviewRecord;
    try {
      review = ReviewRecordSchema.parse(body);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return NextResponse.json(
        { ok: false, error: `Invalid review: ${errorMessage}` },
        { status: 400 }
      );
    }

    // Ensure body.jobId matches route param
    if (review.jobId !== jobId) {
      return NextResponse.json(
        { ok: false, error: `jobId mismatch: route param is "${jobId}", body has "${review.jobId}"` },
        { status: 400 }
      );
    }

    // Save review atomically
    await saveReview(review);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, error: `Failed to save review: ${errorMessage}` },
      { status: 500 }
    );
  }
}

type UpdateReviewDisplayNamePayload = {
  displayName?: string | null;
};

function parseUpdateReviewDisplayNamePayload(body: unknown):
  | { ok: true; data: UpdateReviewDisplayNamePayload }
  | { ok: false; error: string } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, error: 'Payload must be an object' };
  }

  const record = body as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(record, 'displayName')) {
    return { ok: true, data: {} };
  }

  const value = record.displayName;
  if (value !== null && typeof value !== 'string') {
    return { ok: false, error: 'displayName must be a string or null' };
  }

  if (typeof value === 'string' && value.trim().length > 120) {
    return { ok: false, error: 'displayName must be at most 120 characters' };
  }

  return { ok: true, data: { displayName: value as string | null } };
}

/**
 * PATCH /api/reviews/[jobId]
 * Update review metadata (currently displayName only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const dataDir = process.env.HG_DATA_DIR;
    if (!dataDir) {
      return NextResponse.json(
        { ok: false, error: 'HG_DATA_DIR is not set in environment' },
        { status: 500 }
      );
    }

    const { jobId } = await params;
    if (!jobId) {
      return NextResponse.json(
        { ok: false, error: 'jobId is required' },
        { status: 400 }
      );
    }

    const body = await request.json();

    const parsedPayload = parseUpdateReviewDisplayNamePayload(body);
    if (!parsedPayload.ok) {
      return NextResponse.json(
        { ok: false, error: `Invalid payload: ${parsedPayload.error}` },
        { status: 400 }
      );
    }

    const review = await getOrCreateReview(jobId);
    const nextDisplayName = parsedPayload.data.displayName?.trim() || undefined;

    if (nextDisplayName) {
      review.displayName = nextDisplayName;
    } else {
      delete review.displayName;
    }
    review.updatedAt = new Date().toISOString();

    await saveReview(review);

    return NextResponse.json({ ok: true, data: review });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, error: `Failed to update review: ${errorMessage}` },
      { status: 500 }
    );
  }
}

