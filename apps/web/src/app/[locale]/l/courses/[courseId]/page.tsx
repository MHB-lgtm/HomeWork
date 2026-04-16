'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Plus, Users, Calendar, BookOpen, FileText,
  ChevronRight, BarChart3, Send, Mail,
  GraduationCap, Clock3, Eye, CheckCircle2,
} from 'lucide-react';
import { cn } from '../../../../../lib/utils';
import { PageHeader } from '../../../../../components/ui/page-header';
import { StatCard } from '../../../../../components/ui/stat-card';
import { StatusBadge } from '../../../../../components/ui/status-badge';
import { Button } from '../../../../../components/ui/button';
import { Card } from '../../../../../components/ui/card';
import { DataTable, Column } from '../../../../../components/ui/data-table';
import { Badge } from '../../../../../components/ui/badge';

/* ── Types ── */

type Assignment = {
  id: string;
  title: string;
  week: number;
  openDate: string;
  deadline: string;
  submissions: number;
  totalStudents: number;
  graded: number;
  published: number;
};

type Student = {
  id: string;
  name: string;
  email: string;
  avgGrade: number | null;
  submissionCount: number;
  status: 'active' | 'at-risk' | 'inactive';
};

/* ── Mock Data ── */

const courseMeta = {
  id: 'c1',
  name: 'Linear Algebra',
  code: 'CS201',
  semester: 'Spring 2026',
  students: 45,
  currentWeek: 5,
};

const mockAssignments: Assignment[] = [
  { id: 'a1', title: 'Vector Spaces & Subspaces', week: 1, openDate: '2026-02-22', deadline: '2026-03-01T23:59', submissions: 45, totalStudents: 45, graded: 45, published: 45 },
  { id: 'a2', title: 'Linear Transformations', week: 2, openDate: '2026-03-01', deadline: '2026-03-08T23:59', submissions: 44, totalStudents: 45, graded: 44, published: 44 },
  { id: 'a3', title: 'Matrix Operations', week: 3, openDate: '2026-03-08', deadline: '2026-03-15T23:59', submissions: 43, totalStudents: 45, graded: 40, published: 38 },
  { id: 'a4', title: 'Determinants', week: 4, openDate: '2026-03-15', deadline: '2026-03-22T23:59', submissions: 38, totalStudents: 45, graded: 12, published: 0 },
  { id: 'a5', title: 'Eigenvalues & Eigenvectors', week: 5, openDate: '2026-03-22', deadline: '2026-03-29T23:59', submissions: 8, totalStudents: 45, graded: 0, published: 0 },
];

type Exam = {
  id: string;
  title: string;
  type: 'midterm' | 'final' | 'quiz';
  date: string;
  durationMin: number;
  submissions: number;
  totalStudents: number;
  graded: number;
  published: number;
  avgGrade: number | null;
  status: 'draft' | 'scheduled' | 'in-review' | 'published';
};

const mockExams: Exam[] = [
  { id: 'e1', title: 'Midterm Exam', type: 'midterm', date: '2026-03-20', durationMin: 120, submissions: 45, totalStudents: 45, graded: 45, published: 45, avgGrade: 81, status: 'published' },
  { id: 'e2', title: 'Quiz 1 — Vectors', type: 'quiz', date: '2026-03-05', durationMin: 45, submissions: 44, totalStudents: 45, graded: 44, published: 44, avgGrade: 86, status: 'published' },
  { id: 'e3', title: 'Quiz 2 — Matrices', type: 'quiz', date: '2026-04-02', durationMin: 45, submissions: 38, totalStudents: 45, graded: 12, published: 0, avgGrade: 74, status: 'in-review' },
  { id: 'e4', title: 'Final Exam', type: 'final', date: '2026-06-18', durationMin: 180, submissions: 0, totalStudents: 45, graded: 0, published: 0, avgGrade: null, status: 'scheduled' },
];

function examStatusKey(s: Exam['status']): string {
  return s === 'published' ? 'published'
    : s === 'in-review' ? 'review'
    : s === 'scheduled' ? 'pending'
    : 'draft';
}

const examTypeStyles: Record<Exam['type'], { bg: string; text: string; label: string }> = {
  midterm: { bg: 'bg-(--info-subtle)', text: 'text-(--info)', label: 'Midterm' },
  final: { bg: 'bg-(--brand-subtle)', text: 'text-(--brand)', label: 'Final' },
  quiz: { bg: 'bg-(--success-subtle)', text: 'text-(--success)', label: 'Quiz' },
};

const mockStudents: Student[] = [
  { id: 'st1', name: 'Sarah Cohen', email: 'sarah.c@uni.edu', avgGrade: 92, submissionCount: 5, status: 'active' },
  { id: 'st2', name: 'David Levy', email: 'david.l@uni.edu', avgGrade: 78, submissionCount: 5, status: 'active' },
  { id: 'st3', name: 'Maya Green', email: 'maya.g@uni.edu', avgGrade: 85, submissionCount: 4, status: 'active' },
  { id: 'st4', name: 'Tom Shapira', email: 'tom.s@uni.edu', avgGrade: 64, submissionCount: 5, status: 'at-risk' },
  { id: 'st5', name: 'Noa Miller', email: 'noa.m@uni.edu', avgGrade: 91, submissionCount: 5, status: 'active' },
  { id: 'st6', name: 'Eli Rosen', email: 'eli.r@uni.edu', avgGrade: null, submissionCount: 3, status: 'inactive' },
];

const gradeDistribution = [
  { range: '90-100', count: 12, pct: 27 },
  { range: '80-89', count: 15, pct: 33 },
  { range: '70-79', count: 10, pct: 22 },
  { range: '60-69', count: 5, pct: 11 },
  { range: '<60', count: 3, pct: 7 },
];

type Tab = 'assignments' | 'exams' | 'students' | 'analytics';

/* ── Helpers ── */

function assignmentStatus(a: Assignment): 'published' | 'active' | 'pending' | 'draft' {
  if (a.published === a.totalStudents) return 'published';
  if (a.graded > 0) return 'active';
  if (a.submissions > 0) return 'pending';
  return 'draft';
}

function gradeVariant(grade: number | null): 'success' | 'warning' | 'error' | 'default' {
  if (grade === null) return 'default';
  if (grade >= 80) return 'success';
  if (grade >= 60) return 'warning';
  return 'error';
}

/* ── Component ── */

export default function CourseDetailPage() {
  const params = useParams();
  const courseId = params.courseId as string;
  const [activeTab, setActiveTab] = useState<Tab>('assignments');

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'assignments', label: 'Assignments', icon: <FileText className="h-4 w-4" /> },
    { key: 'exams', label: 'Exams', icon: <GraduationCap className="h-4 w-4" /> },
    { key: 'students', label: 'Students', icon: <Users className="h-4 w-4" /> },
    { key: 'analytics', label: 'Analytics', icon: <BarChart3 className="h-4 w-4" /> },
  ];

  /* Student table columns */
  const studentColumns: Column<Student & Record<string, unknown>>[] = [
    {
      key: 'name',
      label: 'Name',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-(--surface-secondary) text-xs font-semibold text-(--text-secondary)">
            {(row.name as string).split(' ').map((n: string) => n[0]).join('')}
          </div>
          <span className="font-medium text-(--text-primary)">{row.name as string}</span>
        </div>
      ),
    },
    { key: 'email', label: 'Email' },
    {
      key: 'avgGrade',
      label: 'Avg Grade',
      render: (row) => {
        const grade = row.avgGrade as number | null;
        return grade !== null ? (
          <Badge variant={gradeVariant(grade)} size="sm">{grade}</Badge>
        ) : (
          <span className="text-xs text-(--text-quaternary)">--</span>
        );
      },
    },
    {
      key: 'submissionCount',
      label: 'Submissions',
      render: (row) => (
        <span className="text-(--text-secondary)">{row.submissionCount as number}/{mockAssignments.length}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => {
        const s = row.status as string;
        const map: Record<string, string> = { active: 'active', 'at-risk': 'pending', inactive: 'locked' };
        const labelMap: Record<string, string> = { active: 'Active', 'at-risk': 'At Risk', inactive: 'Inactive' };
        return <StatusBadge status={map[s]} label={labelMap[s]} size="sm" />;
      },
    },
  ];

  return (
    <div className="space-y-12">
      <PageHeader
        backHref="/l/courses"
        title={courseMeta.name}
        subtitle={`${courseMeta.code} · ${courseMeta.semester}`}
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-(--border) overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={cn(
              'inline-flex items-center gap-2 px-6 py-5 text-sm font-medium transition-colors whitespace-nowrap',
              'border-b-2 -mb-px',
              activeTab === t.key
                ? 'border-(--brand) text-(--text-primary)'
                : 'border-transparent text-(--text-tertiary) hover:text-(--text-secondary) hover:border-(--border)',
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Assignments Tab ── */}
      {activeTab === 'assignments' && (
        <div className="space-y-7">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-(--text-primary)">
              {mockAssignments.length} assignments
            </h2>
            <Link href={`/l/courses/${courseId}/assignments/create`}>
              <Button size="sm" icon={<Plus />}>Create Assignment</Button>
            </Link>
          </div>

          <Card padding="none">
            <div className="divide-y divide-(--border-light)">
              {mockAssignments.map((a) => {
                const status = assignmentStatus(a);
                return (
                  <Link
                    key={a.id}
                    href={`/l/courses/${courseId}/assignments/${a.id}`}
                    className={cn(
                      'flex items-center gap-5 px-7 py-6',
                      'transition-colors hover:bg-(--surface-hover)',
                    )}
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-(--brand-subtle) text-sm font-semibold text-(--brand)">
                      W{a.week}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-medium text-(--text-primary)">
                        {a.title}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-(--text-tertiary)">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-4 w-4" />
                          Due {new Date(a.deadline).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Send className="h-4 w-4" />
                          {a.submissions}/{a.totalStudents} submitted
                        </span>
                      </div>
                    </div>
                    <div className="hidden items-center gap-4 sm:flex">
                      <div className="text-end text-[13px]">
                        <p className="font-medium text-(--text-secondary) tabular-nums">{a.graded} graded</p>
                        <p className="text-(--text-quaternary) tabular-nums">{a.published} published</p>
                      </div>
                      <StatusBadge status={status} size="sm" />
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-(--text-quaternary) rtl:rotate-180" />
                  </Link>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* ── Exams Tab ── */}
      {activeTab === 'exams' && (
        <div className="space-y-10">
          {/* KPI strip */}
          <div className="grid gap-5 sm:grid-cols-4">
            <StatCard label="Total Exams" value={mockExams.length} icon={<GraduationCap />} />
            <StatCard
              label="In Review"
              value={mockExams.filter((e) => e.status === 'in-review').length}
              icon={<Eye />}
            />
            <StatCard
              label="Published"
              value={mockExams.filter((e) => e.status === 'published').length}
              icon={<CheckCircle2 />}
            />
            <StatCard
              label="Course Avg"
              value={(() => {
                const graded = mockExams.filter((e) => e.avgGrade != null);
                if (graded.length === 0) return '—';
                return Math.round(graded.reduce((s, e) => s + (e.avgGrade as number), 0) / graded.length);
              })()}
              icon={<BarChart3 />}
            />
          </div>

          {/* Header + action */}
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-(--text-primary)">
              {mockExams.length} exams
            </h2>
            <Link href={`/l/courses/${courseId}/exams/create`}>
              <Button size="sm" icon={<Plus />}>Schedule Exam</Button>
            </Link>
          </div>

          {/* Exams admin grid */}
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {mockExams.map((e) => {
              const typeStyle = examTypeStyles[e.type];
              const submittedPct = e.totalStudents > 0 ? Math.round((e.submissions / e.totalStudents) * 100) : 0;
              const gradedPct = e.submissions > 0 ? Math.round((e.graded / e.submissions) * 100) : 0;
              return (
                <Card key={e.id} hover className="p-7 h-full">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-3">
                        <span className={cn('inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold', typeStyle.bg, typeStyle.text)}>
                          {typeStyle.label}
                        </span>
                        <StatusBadge status={examStatusKey(e.status)} size="sm" />
                      </div>
                      <p className="text-lg font-semibold text-(--text-primary) leading-snug truncate">
                        {e.title}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-(--text-tertiary)">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-4 w-4" />
                          {new Date(e.date).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock3 className="h-4 w-4" />
                          {e.durationMin} min
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Submission progress */}
                  <div className="mt-6 space-y-4">
                    <div>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="text-(--text-tertiary)">Submitted</span>
                        <span className="font-semibold tabular-nums text-(--text-secondary)">
                          {e.submissions}/{e.totalStudents} · {submittedPct}%
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-(--surface-secondary)">
                        <div className="h-full rounded-full bg-(--brand) transition-all" style={{ width: `${submittedPct}%` }} />
                      </div>
                    </div>
                    {e.submissions > 0 && (
                      <div>
                        <div className="mb-2 flex items-center justify-between text-sm">
                          <span className="text-(--text-tertiary)">Graded</span>
                          <span className="font-semibold tabular-nums text-(--text-secondary)">
                            {e.graded}/{e.submissions} · {gradedPct}%
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-(--surface-secondary)">
                          <div className="h-full rounded-full bg-(--success) transition-all" style={{ width: `${gradedPct}%` }} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Stats row */}
                  <div className="mt-6 flex items-center justify-between border-t border-(--border-light) pt-5">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-(--text-quaternary)">Avg Grade</p>
                      <p className="mt-1.5 text-2xl font-bold tabular-nums text-(--text-primary) leading-tight">
                        {e.avgGrade != null ? e.avgGrade : '—'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {e.status === 'published' ? (
                        <Link href={`/l/courses/${courseId}/exams/${e.id}`}>
                          <Button size="sm" variant="secondary" icon={<Eye className="h-3.5 w-3.5" />}>View</Button>
                        </Link>
                      ) : e.status === 'in-review' ? (
                        <>
                          <Link href={`/l/courses/${courseId}/exams/${e.id}`}>
                            <Button size="sm" variant="secondary">Review</Button>
                          </Link>
                          <Button size="sm" icon={<Send className="h-3.5 w-3.5" />}>Publish</Button>
                        </>
                      ) : (
                        <Link href={`/l/courses/${courseId}/exams/${e.id}`}>
                          <Button size="sm" variant="secondary" icon={<Eye className="h-3.5 w-3.5" />}>Manage</Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Students Tab ── */}
      {activeTab === 'students' && (
        <div className="space-y-7">
          <DataTable
            columns={studentColumns}
            data={mockStudents.map((s) => ({ ...s } as Student & Record<string, unknown>))}
            emptyMessage="No students enrolled"
            emptyIcon={<Users />}
          />
        </div>
      )}

      {/* ── Analytics Tab ── */}
      {activeTab === 'analytics' && (
        <div className="space-y-10">
          <div className="grid gap-5 sm:grid-cols-3">
            <StatCard label="Class Average" value={82} trend={{ value: '+3', positive: true }} />
            <StatCard label="Highest Score" value={95} />
            <StatCard label="Lowest Score" value={42} />
          </div>

          <Card padding="lg">
            <h3 className="mb-4 text-sm font-semibold text-(--text-primary)">Grade Distribution</h3>
            <div className="space-y-3">
              {gradeDistribution.map((g) => (
                <div key={g.range}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-(--text-secondary)">{g.range}</span>
                    <span className="text-(--text-quaternary)">{g.count} ({g.pct}%)</span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-(--surface-secondary)">
                    <div
                      className="h-full rounded-full bg-(--text-primary) transition-all duration-500"
                      style={{ width: `${g.pct}%`, opacity: 1 - (gradeDistribution.indexOf(g) * 0.15) }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
