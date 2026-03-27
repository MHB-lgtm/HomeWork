'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Eye, Search, FileText } from 'lucide-react';
import { cn } from '../../../../lib/utils';
import { PageHeader } from '../../../../components/ui/page-header';
import { StatusBadge } from '../../../../components/ui/status-badge';
import { DataTable, Column } from '../../../../components/ui/data-table';
import { Badge } from '../../../../components/ui/badge';
import { Input } from '../../../../components/ui/input';

/* ── Types ── */

type SubmissionStatus = 'pending' | 'review' | 'published';

type Submission = {
  id: string;
  studentName: string;
  courseName: string;
  courseId: string;
  assignmentTitle: string;
  assignmentId: string;
  submittedAt: string;
  aiScore: number | null;
  status: SubmissionStatus;
};

/* ── Mock Data ── */

const mockSubmissions: Submission[] = [
  { id: 'sub1', studentName: 'Sarah Cohen', courseName: 'Linear Algebra', courseId: 'c1', assignmentTitle: 'Matrix Operations', assignmentId: 'a3', submittedAt: '2026-03-27T08:30:00', aiScore: 92, status: 'pending' },
  { id: 'sub2', studentName: 'David Levy', courseName: 'Linear Algebra', courseId: 'c1', assignmentTitle: 'Matrix Operations', assignmentId: 'a3', submittedAt: '2026-03-27T07:45:00', aiScore: 42, status: 'pending' },
  { id: 'sub3', studentName: 'Maya Green', courseName: 'Calculus II', courseId: 'c2', assignmentTitle: 'Integration Techniques', assignmentId: 'a2', submittedAt: '2026-03-26T22:10:00', aiScore: 91, status: 'review' },
  { id: 'sub4', studentName: 'Tom Shapira', courseName: 'Physics I', courseId: 'c3', assignmentTitle: "Newton's Laws", assignmentId: 'a1', submittedAt: '2026-03-26T20:30:00', aiScore: 76, status: 'review' },
  { id: 'sub5', studentName: 'Noa Miller', courseName: 'Calculus II', courseId: 'c2', assignmentTitle: 'Integration Techniques', assignmentId: 'a2', submittedAt: '2026-03-26T19:00:00', aiScore: 88, status: 'published' },
  { id: 'sub6', studentName: 'Eli Rosen', courseName: 'Linear Algebra', courseId: 'c1', assignmentTitle: 'Determinants', assignmentId: 'a4', submittedAt: '2026-03-26T15:20:00', aiScore: 55, status: 'pending' },
  { id: 'sub7', studentName: 'Yael Adler', courseName: 'Physics I', courseId: 'c3', assignmentTitle: "Newton's Laws", assignmentId: 'a1', submittedAt: '2026-03-25T21:00:00', aiScore: 83, status: 'published' },
  { id: 'sub8', studentName: 'Oren Ben-David', courseName: 'Linear Algebra', courseId: 'c1', assignmentTitle: 'Matrix Operations', assignmentId: 'a3', submittedAt: '2026-03-25T18:45:00', aiScore: 71, status: 'review' },
  { id: 'sub9', studentName: 'Lior Katz', courseName: 'Calculus II', courseId: 'c2', assignmentTitle: 'Sequences & Series', assignmentId: 'a3', submittedAt: '2026-03-25T14:10:00', aiScore: null, status: 'pending' },
  { id: 'sub10', studentName: 'Dana Peretz', courseName: 'Physics I', courseId: 'c3', assignmentTitle: 'Energy Conservation', assignmentId: 'a2', submittedAt: '2026-03-24T11:30:00', aiScore: 95, status: 'published' },
];

const courseOptions = ['All Courses', 'Linear Algebra', 'Calculus II', 'Physics I'];

/* ── Component ── */

export default function SubmissionsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<SubmissionStatus | 'all'>('all');
  const [courseFilter, setCourseFilter] = useState('All Courses');

  const filtered = mockSubmissions.filter((s) => {
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    if (courseFilter !== 'All Courses' && s.courseName !== courseFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        s.studentName.toLowerCase().includes(q) ||
        s.assignmentTitle.toLowerCase().includes(q) ||
        s.courseName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const columns: Column<Submission & Record<string, unknown>>[] = [
    {
      key: 'studentName',
      label: 'Student',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-(--surface-secondary) text-[11px] font-semibold text-(--text-secondary)">
            {(row.studentName as string).split(' ').map((n: string) => n[0]).join('')}
          </div>
          <span className="font-medium text-(--text-primary)">{row.studentName as string}</span>
        </div>
      ),
    },
    { key: 'courseName', label: 'Course' },
    { key: 'assignmentTitle', label: 'Assignment' },
    {
      key: 'submittedAt',
      label: 'Submitted',
      render: (row) => (
        <span className="text-(--text-tertiary)">
          {new Date(row.submittedAt as string).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
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
          href={`/l/courses/${row.courseId}/assignments/${row.assignmentId}/review`}
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

  const selectClass = cn(
    'h-9 rounded-lg border border-(--border) bg-(--surface) px-3 text-sm text-(--text-primary)',
    'transition-colors focus-visible:outline-none focus-visible:border-(--border-focus) focus-visible:ring-1 focus-visible:ring-(--border-focus)',
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Submissions" />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 sm:max-w-xs">
          <Input
            placeholder="Search student, course, or assignment..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search />}
          />
        </div>
        <select
          value={courseFilter}
          onChange={(e) => setCourseFilter(e.target.value)}
          className={selectClass}
        >
          {courseOptions.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as SubmissionStatus | 'all')}
          className={selectClass}
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="review">In Review</option>
          <option value="published">Published</option>
        </select>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filtered.map((s) => ({ ...s } as Submission & Record<string, unknown>))}
        emptyMessage="No submissions found"
        emptyIcon={<FileText />}
      />
    </div>
  );
}
