'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Eye, Zap, Send, FileText } from 'lucide-react';
import { cn } from '../../../../../../../lib/utils';
import { PageHeader } from '../../../../../../../components/ui/page-header';
import { StatCard } from '../../../../../../../components/ui/stat-card';
import { StatusBadge } from '../../../../../../../components/ui/status-badge';
import { Button } from '../../../../../../../components/ui/button';
import { DataTable, Column } from '../../../../../../../components/ui/data-table';
import { EmptyState } from '../../../../../../../components/ui/empty-state';
import { Badge } from '../../../../../../../components/ui/badge';

/* ── Types ── */

type SubmissionStatus = 'pending' | 'review' | 'published';

type Submission = {
  id: string;
  studentName: string;
  submittedAt: string;
  aiScore: number | null;
  status: SubmissionStatus;
};

/* ── Mock Data ── */

const assignmentMeta = {
  title: 'Matrix Operations',
  week: 5,
  deadline: '2026-04-02T23:59:00',
  totalStudents: 45,
};

const mockSubmissions: Submission[] = [
  { id: 'sub1', studentName: 'Sarah Cohen', submittedAt: '2026-03-30T14:22:00', aiScore: 92, status: 'published' },
  { id: 'sub2', studentName: 'David Levy', submittedAt: '2026-03-30T16:05:00', aiScore: 78, status: 'review' },
  { id: 'sub3', studentName: 'Maya Green', submittedAt: '2026-03-30T20:45:00', aiScore: 85, status: 'review' },
  { id: 'sub4', studentName: 'Tom Shapira', submittedAt: '2026-03-31T08:12:00', aiScore: 64, status: 'pending' },
  { id: 'sub5', studentName: 'Noa Miller', submittedAt: '2026-03-31T10:30:00', aiScore: 91, status: 'published' },
  { id: 'sub6', studentName: 'Eli Rosen', submittedAt: '2026-03-31T15:58:00', aiScore: 55, status: 'pending' },
  { id: 'sub7', studentName: 'Yael Adler', submittedAt: '2026-04-01T18:20:00', aiScore: null, status: 'pending' },
  { id: 'sub8', studentName: 'Oren Ben-David', submittedAt: '2026-04-01T21:00:00', aiScore: 88, status: 'review' },
];

/* ── Component ── */

export default function AssignmentOverviewPage() {
  const params = useParams();
  const courseId = params.courseId as string;
  const assignmentId = params.assignmentId as string;

  const totalSubmissions = mockSubmissions.length;
  const gradedCount = mockSubmissions.filter((s) => s.status === 'review' || s.status === 'published').length;
  const publishedCount = mockSubmissions.filter((s) => s.status === 'published').length;

  const columns: Column<Submission & Record<string, unknown>>[] = [
    {
      key: 'studentName',
      label: 'Student',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-(--surface-secondary) text-xs font-semibold text-(--text-secondary)">
            {(row.studentName as string).split(' ').map((n: string) => n[0]).join('')}
          </div>
          <span className="font-medium text-(--text-primary)">{row.studentName as string}</span>
        </div>
      ),
    },
    {
      key: 'submittedAt',
      label: 'Submitted At',
      render: (row) => (
        <span className="text-(--text-tertiary)">
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
        if (score === null) return <span className="text-xs text-(--text-quaternary)">--</span>;
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
      render: (row) => (
        <Link
          href={`/l/courses/${courseId}/assignments/${assignmentId}/review`}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium',
            'text-(--text-secondary) transition-colors hover:bg-(--surface-hover)',
          )}
        >
          <Eye className="h-3.5 w-3.5" />
          Review
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        backHref={`/l/courses/${courseId}`}
        title={assignmentMeta.title}
        subtitle={`Week ${assignmentMeta.week} · Due Apr 2`}
      />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Submitted" value={`${totalSubmissions}/${assignmentMeta.totalStudents}`} />
        <StatCard label="Graded" value={gradedCount} />
        <StatCard label="Published" value={publishedCount} />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" icon={<Zap />}>Grade All</Button>
        <Button variant="secondary" size="sm" icon={<Send />}>Publish All</Button>
      </div>

      {/* Submissions Table */}
      <DataTable
        columns={columns}
        data={mockSubmissions.map((s) => ({ ...s } as Submission & Record<string, unknown>))}
        emptyMessage="No submissions yet"
        emptyIcon={<FileText />}
      />
    </div>
  );
}
