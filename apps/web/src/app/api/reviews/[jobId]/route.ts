import { NextRequest, NextResponse } from 'next/server';
import * as path from 'path';
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

