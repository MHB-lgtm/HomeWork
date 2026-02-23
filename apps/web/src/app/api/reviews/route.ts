import { NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';
import { getReviewDir, loadReview, getJob } from '@hg/local-job-store';

export const runtime = 'nodejs';

type ReviewSummary = {
  jobId: string;
  displayName?: string | null;
  status: string;
  examId?: string;
  questionId?: string;
  gradingMode?: 'RUBRIC' | 'GENERAL';
  gradingScope?: 'QUESTION' | 'DOCUMENT';
  createdAt?: string | null;
  updatedAt?: string | null;
  annotationCount: number;
  hasResult: boolean;
};

const toTimestamp = (value?: string | null): number => {
  if (!value) return 0;
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? 0 : ts;
};

export async function GET() {
  try {
    // Ensure HG_DATA_DIR is set (getReviewDir will also validate)
    if (!process.env.HG_DATA_DIR) {
      return NextResponse.json(
        { ok: false, error: 'HG_DATA_DIR is not set in environment' },
        { status: 500 }
      );
    }

    const reviewDir = getReviewDir();

    let files: string[] = [];
    try {
      files = await fs.readdir(reviewDir);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        // No reviews directory yet -> return empty list
        return NextResponse.json({ ok: true, data: [] as ReviewSummary[] });
      }
      throw error;
    }

    const summaries: ReviewSummary[] = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const jobId = path.basename(file, '.json');

      let review = null;
      try {
        review = await loadReview(jobId);
      } catch (error) {
        // Skip invalid review files but continue listing others
        console.warn(`[api/reviews] Failed to load review ${jobId}:`, error);
        continue;
      }

      let job = null;
      try {
        job = await getJob(jobId);
      } catch (error) {
        console.warn(`[api/reviews] Failed to load job ${jobId}:`, error);
      }

      summaries.push({
        jobId,
        displayName: review?.displayName ?? null,
        status: job?.status || 'UNKNOWN',
        examId: job?.inputs?.examId,
        questionId: job?.inputs?.questionId,
        gradingMode: job?.inputs?.gradingMode,
        gradingScope: job?.inputs?.gradingScope,
        createdAt: review?.createdAt || job?.createdAt || null,
        updatedAt: review?.updatedAt || job?.updatedAt || review?.createdAt || job?.createdAt || null,
        annotationCount: Array.isArray(review?.annotations) ? review!.annotations.length : 0,
        hasResult: !!job?.resultJson,
      });
    }

    summaries.sort((a, b) => toTimestamp(b.updatedAt) - toTimestamp(a.updatedAt));

    return NextResponse.json({ ok: true, data: summaries });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, error: `Failed to list reviews: ${message}` },
      { status: 500 }
    );
  }
}
