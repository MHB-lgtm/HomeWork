import { NextRequest, NextResponse } from 'next/server';
import * as path from 'path';
import { readStoredAssetBytes } from '@hg/postgres-store';
import { resolveReviewSubmissionAsset } from '@/lib/server/reviewDetail';
import { requireStaffApiAccess } from '@/lib/server/session';

export const runtime = 'nodejs';

/**
 * GET /api/reviews/[jobId]/submission
 * Get the submission image file for a review
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const access = await requireStaffApiAccess();
  if (access instanceof NextResponse) return access;

  try {
    const { jobId } = await params;

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    const asset = await resolveReviewSubmissionAsset(jobId);
    if (!asset) {
      return NextResponse.json(
        { error: 'Submission file path not found for review' },
        { status: 404 }
      );
    }

    const ext = path.extname(asset.originalName || asset.path).toLowerCase();
    const supportedExtensions = ['.png', '.jpg', '.jpeg'];

    if (!supportedExtensions.includes(ext)) {
      return NextResponse.json(
        { error: 'Submission review supports PNG/JPG only for now.' },
        { status: 415 }
      );
    }

    const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';

    const fileBuffer = await readStoredAssetBytes(asset);

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
