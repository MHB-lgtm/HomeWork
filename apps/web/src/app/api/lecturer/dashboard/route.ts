import { NextResponse } from 'next/server';
import { getServerPersistence } from '@/lib/server/persistence';
import { requireStaffApiAccess } from '@/lib/server/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SubmissionRow = {
  jobId: string;
  displayName: string | null;
  studentName: string | null;
  courseName: string | null;
  courseId: string | null;
  assignmentTitle: string | null;
  assignmentId: string | null;
  submittedAt: string | null;
  deadlineAt: string | null;
  status: 'SUBMITTED' | 'PROCESSING' | 'READY_FOR_REVIEW' | 'PUBLISHED';
  score: number | null;
  maxScore: number | null;
  annotationCount: number;
  gradingMode: string | null;
};

function mapJobStatus(
  jobStatus: string | undefined | null,
  isPublished: boolean
): SubmissionRow['status'] {
  if (isPublished) return 'PUBLISHED';
  if (jobStatus === 'DONE') return 'READY_FOR_REVIEW';
  if (jobStatus === 'RUNNING' || jobStatus === 'PENDING') return 'PROCESSING';
  return 'SUBMITTED';
}

export async function GET() {
  const access = await requireStaffApiAccess();
  if (access instanceof NextResponse) return access;

  try {
    const persistence = getServerPersistence();
    if (!persistence) {
      return NextResponse.json(
        { ok: false, error: 'DATABASE_URL is not set' },
        { status: 500 }
      );
    }

    // Fetch reviews (the main data source for submissions)
    const runtimeSummaries = await persistence.jobs.listRuntimeReviewSummaries();
    const dbSummaries = await persistence.reviewRecords.listReviewSummariesByLegacyJobId();

    // Merge runtime + db summaries (runtime takes priority)
    const summariesByJobId = new Map<string, any>();
    for (const s of runtimeSummaries) {
      summariesByJobId.set(s.jobId, s);
    }
    for (const s of dbSummaries) {
      if (!summariesByJobId.has(s.jobId)) {
        summariesByJobId.set(s.jobId, s);
      }
    }

    // Fetch all courses for name mapping
    const courses = await persistence.courses.listCourses();
    const courseNameMap = new Map<string, string>();
    for (const c of courses) {
      courseNameMap.set(c.courseId, c.title);
    }

    // Build submission rows from reviews
    const submissions: SubmissionRow[] = [];

    for (const [jobId, summary] of summariesByJobId) {
      const isPublished = summary.publication?.isPublished === true;
      const status = mapJobStatus(summary.status, isPublished);

      submissions.push({
        jobId,
        displayName: summary.displayName || null,
        studentName: summary.displayName || null,
        courseName: summary.examId ? (courseNameMap.get(summary.examId) || null) : null,
        courseId: summary.examId || null,
        assignmentTitle: summary.displayName || (summary.examId ? `Exam ${summary.examId}` : null),
        assignmentId: summary.examId || null,
        submittedAt: summary.createdAt || null,
        deadlineAt: null,
        status,
        score: isPublished ? (summary.publication?.score ?? null) : null,
        maxScore: isPublished ? (summary.publication?.maxScore ?? null) : null,
        annotationCount: summary.annotationCount || 0,
        gradingMode: summary.gradingMode || null,
      });
    }

    // Sort by most recent first
    submissions.sort((a, b) => {
      const ta = a.submittedAt ? Date.parse(a.submittedAt) : 0;
      const tb = b.submittedAt ? Date.parse(b.submittedAt) : 0;
      return tb - ta;
    });

    // Compute stats
    const stats = {
      total: submissions.length,
      submitted: submissions.filter((s) => s.status === 'SUBMITTED').length,
      processing: submissions.filter((s) => s.status === 'PROCESSING').length,
      readyForReview: submissions.filter((s) => s.status === 'READY_FOR_REVIEW').length,
      published: submissions.filter((s) => s.status === 'PUBLISHED').length,
    };

    return NextResponse.json({ ok: true, data: { submissions, stats } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, error: `Failed to load dashboard: ${message}` },
      { status: 500 }
    );
  }
}
