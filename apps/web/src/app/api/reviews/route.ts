import { NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { ReviewRecord } from '@hg/shared-schemas';
import type { LegacyReviewSummaryRecord } from '@hg/postgres-store';
import type { JobRecord } from '@hg/local-job-store';
import { getReviewDir, loadReview } from '@hg/local-job-store';
import { getServerPersistence } from '@/lib/server/persistence';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

type LegacyJobMetadata = JobRecord | null;

const toTimestamp = (value?: string | null): number => {
  if (!value) return 0;
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? 0 : ts;
};

const getDataDir = (): string => {
  const dataDir = process.env.HG_DATA_DIR;
  if (!dataDir) {
    throw new Error('HG_DATA_DIR is not set in environment');
  }

  return path.resolve(dataDir);
};

const getJobDirectories = (dataDir: string): string[] => [
  path.join(dataDir, 'jobs', 'pending'),
  path.join(dataDir, 'jobs', 'running'),
  path.join(dataDir, 'jobs', 'done'),
  path.join(dataDir, 'jobs', 'failed'),
];

const toSummaryFromFileBackedData = (
  jobId: string,
  review: ReviewRecord | null,
  job: LegacyJobMetadata
): ReviewSummary => ({
  jobId,
  displayName: review?.displayName ?? null,
  status: job?.status ?? 'UNKNOWN',
  examId: job?.inputs?.examId,
  questionId: job?.inputs?.questionId,
  gradingMode: job?.inputs?.gradingMode,
  gradingScope: job?.inputs?.gradingScope,
  createdAt: review?.createdAt ?? job?.createdAt ?? null,
  updatedAt: review?.updatedAt ?? job?.updatedAt ?? review?.createdAt ?? job?.createdAt ?? null,
  annotationCount: Array.isArray(review?.annotations) ? review.annotations.length : 0,
  hasResult: Boolean(job?.resultJson),
});

const loadAllJobMetadata = async (): Promise<Map<string, JobRecord>> => {
  const dataDir = getDataDir();
  const directories = getJobDirectories(dataDir);

  const directoryEntries = await Promise.all(
    directories.map(async (directory) => {
      try {
        const files = await fs.readdir(directory);
        return files
          .filter((file) => file.endsWith('.json'))
          .map((file) => ({
            jobId: path.basename(file, '.json'),
            filePath: path.join(directory, file),
          }));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return [];
        }

        throw error;
      }
    })
  );

  const jobFiles = directoryEntries.flat();
  const jobs = await Promise.all(
    jobFiles.map(async ({ jobId, filePath }) => {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        return [jobId, JSON.parse(content) as JobRecord] as const;
      } catch (error) {
        console.warn(`[api/reviews] Failed to read job ${jobId}:`, error);
        return null;
      }
    })
  );

  return new Map(
    jobs.filter((entry): entry is readonly [string, JobRecord] => Boolean(entry))
  );
};

const loadFileBackedReviewSummaries = async (
  jobsById: ReadonlyMap<string, JobRecord>
): Promise<Map<string, ReviewSummary>> => {
  const reviewDir = getReviewDir();

  let files: string[] = [];
  try {
    files = await fs.readdir(reviewDir);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      return new Map();
    }
    throw error;
  }

  const reviewFiles = files.filter((file) => file.endsWith('.json'));
  const summaries = await Promise.all(
    reviewFiles.map(async (file) => {
      const jobId = path.basename(file, '.json');

      try {
        const review = await loadReview(jobId);
        return [jobId, toSummaryFromFileBackedData(jobId, review, jobsById.get(jobId) ?? null)] as const;
      } catch (error) {
        console.warn(`[api/reviews] Failed to load review ${jobId}:`, error);
        return null;
      }
    })
  );

  return new Map(
    summaries.filter((entry): entry is readonly [string, ReviewSummary] => Boolean(entry))
  );
};

const mergeDbSummary = (
  dbSummary: LegacyReviewSummaryRecord,
  existingSummary: ReviewSummary | undefined,
  job: LegacyJobMetadata
): ReviewSummary => ({
  jobId: dbSummary.jobId,
  displayName: dbSummary.displayName,
  status: existingSummary?.status ?? job?.status ?? 'UNKNOWN',
  examId: existingSummary?.examId ?? job?.inputs?.examId,
  questionId: existingSummary?.questionId ?? job?.inputs?.questionId,
  gradingMode: existingSummary?.gradingMode ?? job?.inputs?.gradingMode,
  gradingScope: existingSummary?.gradingScope ?? job?.inputs?.gradingScope,
  createdAt: dbSummary.createdAt,
  updatedAt: dbSummary.updatedAt,
  annotationCount: dbSummary.annotationCount,
  hasResult: dbSummary.hasResult,
});

export async function GET() {
  try {
    if (!process.env.HG_DATA_DIR) {
      return NextResponse.json(
        { ok: false, error: 'HG_DATA_DIR is not set in environment' },
        { status: 500 }
      );
    }

    const jobsById = await loadAllJobMetadata();
    const summariesByJobId = await loadFileBackedReviewSummaries(jobsById);
    const persistence = getServerPersistence();

    if (persistence) {
      const dbSummaries = await persistence.reviewRecords.listReviewSummariesByLegacyJobId();

      for (const dbSummary of dbSummaries) {
        const existingSummary = summariesByJobId.get(dbSummary.jobId);
        const job = existingSummary ? null : jobsById.get(dbSummary.jobId) ?? null;
        summariesByJobId.set(
          dbSummary.jobId,
          mergeDbSummary(dbSummary, existingSummary, job)
        );
      }
    }

    const summaries = [...summariesByJobId.values()].sort(
      (a, b) => toTimestamp(b.updatedAt) - toTimestamp(a.updatedAt)
    );

    return NextResponse.json({ ok: true, data: summaries });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, error: `Failed to list reviews: ${message}` },
      { status: 500 }
    );
  }
}
