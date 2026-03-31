import { NextResponse } from 'next/server';
import type { LegacyReviewPublicationRecord, LegacyReviewSummaryRecord } from '@hg/postgres-store';
import { getServerPersistence } from '@/lib/server/persistence';
import { requireStaffApiAccess } from '@/lib/server/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ReviewSummary = {
  jobId: string;
  displayName?: string | null;
  status: string;
  operationalStatus?: import('@hg/postgres-store').OperationalSubmissionStatusValue;
  examId?: string;
  questionId?: string;
  gradingMode?: 'RUBRIC' | 'GENERAL';
  gradingScope?: 'QUESTION' | 'DOCUMENT';
  createdAt?: string | null;
  updatedAt?: string | null;
  annotationCount: number;
  hasResult: boolean;
  publication?: LegacyReviewPublicationRecord;
};

const toTimestamp = (value?: string | null): number => {
  if (!value) return 0;
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? 0 : ts;
};

const toImportedDbSummary = (dbSummary: LegacyReviewSummaryRecord): ReviewSummary => ({
  jobId: dbSummary.jobId,
  displayName: dbSummary.displayName,
  status: dbSummary.status ?? 'UNKNOWN',
  operationalStatus: dbSummary.operationalStatus,
  createdAt: dbSummary.createdAt,
  updatedAt: dbSummary.updatedAt,
  annotationCount: dbSummary.annotationCount,
  hasResult: dbSummary.hasResult,
  publication: dbSummary.publication,
});

export async function GET() {
  const access = await requireStaffApiAccess();
  if (access instanceof NextResponse) return access;

  try {
    const persistence = getServerPersistence();
    if (!persistence) {
      return NextResponse.json(
        { ok: false, error: 'DATABASE_URL is not set in environment' },
        { status: 500 }
      );
    }

    const summariesByJobId = new Map<string, ReviewSummary>();
    const runtimeSummaries = await persistence.jobs.listRuntimeReviewSummaries();
    for (const runtimeSummary of runtimeSummaries) {
      summariesByJobId.set(runtimeSummary.jobId, {
        ...runtimeSummary,
        questionId: runtimeSummary.questionId ?? undefined,
        gradingMode: runtimeSummary.gradingMode ?? undefined,
        gradingScope: runtimeSummary.gradingScope ?? undefined,
      });
    }

    const dbSummaries = await persistence.reviewRecords.listReviewSummariesByLegacyJobId();
    for (const dbSummary of dbSummaries) {
      if (!summariesByJobId.has(dbSummary.jobId)) {
        summariesByJobId.set(dbSummary.jobId, toImportedDbSummary(dbSummary));
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
