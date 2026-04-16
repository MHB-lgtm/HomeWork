'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Eye, Zap, Send, FileText, CheckCircle2, Edit3 } from 'lucide-react';
import { PageHeader } from '../../../../../../../components/ui/page-header';
import { StatCard } from '../../../../../../../components/ui/stat-card';
import { StatusBadge } from '../../../../../../../components/ui/status-badge';
import { Button } from '../../../../../../../components/ui/button';
import { DataTable, Column } from '../../../../../../../components/ui/data-table';
import { Badge } from '../../../../../../../components/ui/badge';
import {
  getAssignment,
  getCourseOrFallback,
} from '../../../../../../../lib/demoSeed';

/* ── Types ── */

type SubmissionStatus = 'pending' | 'review' | 'published';

type Submission = {
  id: string;
  studentName: string;
  submittedAt: string;
  aiScore: number | null;
  status: SubmissionStatus;
};

/* ─────────────────────────────────────────────
   Roster — used to generate plausible per-assignment submissions
   ───────────────────────────────────────────── */

const ROSTER: { id: string; name: string }[] = [
  { id: 'st1', name: 'Sarah Cohen' },
  { id: 'st2', name: 'David Levy' },
  { id: 'st3', name: 'Maya Green' },
  { id: 'st4', name: 'Tom Shapira' },
  { id: 'st5', name: 'Noa Miller' },
  { id: 'st6', name: 'Eli Rosen' },
  { id: 'st7', name: 'Yael Adler' },
  { id: 'st8', name: 'Oren Ben-David' },
  { id: 'st9', name: 'Liam Esika' },
  { id: 'st10', name: 'Hila Mizrahi' },
  { id: 'st11', name: 'Jonathan Vardi' },
  { id: 'st12', name: 'Tamar Zilber' },
];

function deterministicSubmissions(
  assignmentId: string,
  status: 'OPEN' | 'SUBMITTED' | 'CLOSED' | 'WAITING_FOR_REVIEW' | 'PROCESSING' | 'READY_FOR_REVIEW' | 'PUBLISHED',
  deadline: string,
): Submission[] {
  const submitRate =
    status === 'OPEN'
      ? 0.3
      : status === 'SUBMITTED'
        ? 0.6
        : status === 'CLOSED'
          ? 0.65
          : status === 'WAITING_FOR_REVIEW' || status === 'PROCESSING'
            ? 0.85
            : 0.92;

  const cutoff = Math.round(ROSTER.length * submitRate);
  const baseDeadline = new Date(deadline).getTime();

  return ROSTER.slice(0, cutoff).map((s, i) => {
    // Deterministic pseudo-random based on assignment id + roster index.
    const hash = (assignmentId.charCodeAt(0) + i * 17) % 100;
    const offsetMs = (hash - 50) * 60_000 * 30; // ±25h around the deadline
    const submittedAt = new Date(baseDeadline + offsetMs).toISOString();

    let aiScore: number | null;
    let cellStatus: SubmissionStatus;
    if (status === 'OPEN' || status === 'SUBMITTED') {
      aiScore = null;
      cellStatus = 'pending';
    } else if (status === 'PROCESSING' || status === 'WAITING_FOR_REVIEW') {
      aiScore = i < cutoff / 2 ? 60 + (hash % 40) : null;
      cellStatus = 'pending';
    } else if (status === 'READY_FOR_REVIEW') {
      aiScore = 60 + (hash % 40);
      cellStatus = 'review';
    } else {
      // PUBLISHED
      aiScore = 60 + (hash % 40);
      cellStatus = i < cutoff * 0.7 ? 'published' : 'review';
    }

    return {
      id: `${assignmentId}-${s.id}`,
      studentName: s.name,
      submittedAt,
      aiScore,
      status: cellStatus,
    };
  });
}

/* ── Component ── */

export default function AssignmentOverviewPage() {
  const params = useParams();
  const locale = (params?.locale as string) ?? 'en';
  const courseId = params.courseId as string;
  const assignmentId = params.assignmentId as string;
  const lecturerPrefix = `/${locale}/l`;

  const assignment = getAssignment(assignmentId);
  const course = getCourseOrFallback(courseId);

  const submissions = useMemo(
    () =>
      assignment ? deterministicSubmissions(assignment.id, assignment.status, assignment.deadline) : [],
    [assignment],
  );

  const enrolled = course.studentCount;
  const totalSubmissions = submissions.length;
  const gradedCount = submissions.filter((s) => s.status === 'review' || s.status === 'published').length;
  const publishedCount = submissions.filter((s) => s.status === 'published').length;
  const formattedDeadline = assignment
    ? new Date(assignment.deadline).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '\u2014';

  const columns: Column<Submission & Record<string, unknown>>[] = [
    {
      key: 'studentName',
      label: 'Student',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-(--surface-secondary) text-[13px] font-semibold text-(--text-secondary)">
            {(row.studentName as string).split(' ').map((n: string) => n[0]).join('')}
          </div>
          <span className="font-medium text-(--text-primary)">{row.studentName as string}</span>
        </div>
      ),
    },
    {
      key: 'submittedAt',
      label: 'Submitted',
      render: (row) => (
        <span className="text-(--text-tertiary) whitespace-nowrap">
          {new Date(row.submittedAt as string).toLocaleString(undefined, {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
          })}
        </span>
      ),
    },
    {
      key: 'aiScore',
      label: 'AI Score',
      render: (row) => {
        const score = row.aiScore as number | null;
        if (score === null) return <span className="text-[13px] text-(--text-quaternary)">--</span>;
        const variant = score >= 80 ? 'success' : score >= 60 ? 'warning' : 'error';
        return <Badge variant={variant} size="sm">{score}</Badge>;
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge status={row.status as string} size="sm" />,
    },
    {
      key: 'action',
      label: 'Action',
      align: 'right',
      render: (row) => {
        const status = row.status as SubmissionStatus;
        const id = row.id as string;
        const reviewHref = `/reviews/${id}`;
        return (
          <div className="flex items-center justify-end gap-2">
            {status === 'pending' ? (
              <Link href={reviewHref}>
                <Button size="sm" icon={<Eye className="h-3.5 w-3.5" />}>Review</Button>
              </Link>
            ) : status === 'review' ? (
              <>
                <Link href={reviewHref}>
                  <Button size="sm" variant="secondary" icon={<Edit3 className="h-3.5 w-3.5" />}>Edit</Button>
                </Link>
                <Button size="sm" icon={<Send className="h-3.5 w-3.5" />}>Publish</Button>
              </>
            ) : (
              <Link href={reviewHref}>
                <Button size="sm" variant="ghost" icon={<CheckCircle2 className="h-3.5 w-3.5 text-(--success)" />}>
                  View
                </Button>
              </Link>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-12">
      <PageHeader
        backHref={`${lecturerPrefix}/courses/${courseId}`}
        title={assignment?.title ?? 'Assignment'}
        subtitle={
          assignment
            ? `${course.title} \u00b7 Week ${assignment.weekNumber} \u00b7 Due ${formattedDeadline}`
            : course.title
        }
        eyebrow={course.code}
        icon={<FileText />}
        gradient
      />

      {/* Stats */}
      <div className="grid gap-5 sm:grid-cols-4">
        <StatCard label="Enrolled" value={enrolled} accent="#0d9488" />
        <StatCard label="Submitted" value={`${totalSubmissions}/${enrolled}`} accent="#0891b2" />
        <StatCard label="Graded by AI" value={gradedCount} accent="#16a34a" />
        <StatCard label="Published" value={publishedCount} accent="#9333ea" />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <Button size="md" icon={<Zap />}>Re-run AI grading</Button>
        <Button variant="secondary" size="md" icon={<Send />}>Publish reviewed</Button>
      </div>

      {/* Submissions Table */}
      <DataTable
        columns={columns}
        data={submissions.map((s) => ({ ...s } as Submission & Record<string, unknown>))}
        emptyMessage="No submissions yet"
        emptyIcon={<FileText />}
      />
    </div>
  );
}
