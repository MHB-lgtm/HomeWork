'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Plus, Users, Calendar, BookOpen, FileText,
  ChevronRight, BarChart3, Send, Mail,
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

type Tab = 'assignments' | 'students' | 'analytics';

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
    <div className="space-y-6">
      <PageHeader
        backHref="/l/courses"
        title={courseMeta.name}
        subtitle={`${courseMeta.code} · ${courseMeta.semester}`}
      />

      {/* Tabs */}
      <div className="flex gap-0 border-b border-(--border)">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors',
              'border-b-2 -mb-px',
              activeTab === t.key
                ? 'border-(--text-primary) text-(--text-primary)'
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
        <div className="space-y-4">
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
                      'flex items-center gap-4 px-5 py-4',
                      'transition-colors hover:bg-(--surface-hover)',
                    )}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-(--brand-subtle) text-sm font-semibold text-(--brand)">
                      W{a.week}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-(--text-primary)">
                        {a.title}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-(--text-tertiary)">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Due {new Date(a.deadline).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Send className="h-3 w-3" />
                          {a.submissions}/{a.totalStudents} submitted
                        </span>
                      </div>
                    </div>
                    <div className="hidden items-center gap-3 sm:flex">
                      <div className="text-right text-xs">
                        <p className="font-medium text-(--text-secondary)">{a.graded} graded</p>
                        <p className="text-(--text-quaternary)">{a.published} published</p>
                      </div>
                      <StatusBadge status={status} size="sm" />
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-(--text-quaternary)" />
                  </Link>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* ── Students Tab ── */}
      {activeTab === 'students' && (
        <div className="space-y-4">
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
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
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
