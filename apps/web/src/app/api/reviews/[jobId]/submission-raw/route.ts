import { NextRequest, NextResponse } from 'next/server';
import * as path from 'path';
import { readStoredAssetBytes } from '@hg/postgres-store';
import { resolveReviewSubmissionAsset } from '@/lib/server/reviewDetail';
import { requireStaffApiAccess } from '@/lib/server/session';

export const runtime = 'nodejs';

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
 * GET /api/reviews/[jobId]/submission-raw
 * Get the raw submission file (PDF or image) for a review
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

    let mimeType: string;
    try {
      mimeType = asset.mimeType || inferMimeType(asset.originalName || asset.path);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Unsupported file type' },
        { status: 415 }
      );
    }

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
