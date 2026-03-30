export type SubmissionStatus = 'SUBMITTED' | 'PROCESSING' | 'READY_FOR_REVIEW' | 'PUBLISHED';

export type SubmissionRow = {
  jobId: string;
  displayName: string | null;
  studentName: string | null;
  courseName: string | null;
  courseId: string | null;
  assignmentTitle: string | null;
  assignmentId: string | null;
  submittedAt: string | null;
  deadlineAt: string | null;
  status: SubmissionStatus;
  score: number | null;
  maxScore: number | null;
  annotationCount: number;
  gradingMode: string | null;
};

export type DashboardStats = {
  total: number;
  submitted: number;
  processing: number;
  readyForReview: number;
  published: number;
};

export type DashboardData = {
  submissions: SubmissionRow[];
  stats: DashboardStats;
};

export async function fetchLecturerDashboard(): Promise<
  | { ok: true; data: DashboardData }
  | { ok: false; error: string }
> {
  try {
    const response = await fetch('/api/lecturer/dashboard');

    const payload = await response.json().catch(() => ({
      ok: false,
      error: 'Failed to parse response',
    }));

    if (!response.ok || !payload.ok) {
      return {
        ok: false,
        error: payload.error || 'Failed to fetch dashboard data',
      };
    }

    return { ok: true, data: payload.data as DashboardData };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to fetch dashboard data',
    };
  }
}
