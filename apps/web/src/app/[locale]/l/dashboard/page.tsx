'use client';

import Link from 'next/link';
import {
  BookOpen, Users, ClipboardCheck, CheckCircle2,
  ChevronRight, Clock, Eye, BarChart3, TrendingDown,
} from 'lucide-react';
import { cn } from '../../../../lib/utils';
import { PageHeader } from '../../../../components/ui/page-header';
import { StatCard } from '../../../../components/ui/stat-card';
import { Card } from '../../../../components/ui/card';
import { StatusBadge } from '../../../../components/ui/status-badge';
import { Badge } from '../../../../components/ui/badge';

/* ── Mock data ── */

type Submission = {
  id: string;
  studentName: string;
  courseName: string;
  assignmentTitle: string;
  status: 'pending' | 'review' | 'error' | 'published';
  aiScore: number;
};

const recentSubmissions: Submission[] = [
  { id: 's1', studentName: 'Sarah Cohen', courseName: 'Linear Algebra', assignmentTitle: 'Matrix Operations', status: 'pending', aiScore: 85 },
  { id: 's2', studentName: 'David Levy', courseName: 'Linear Algebra', assignmentTitle: 'Matrix Operations', status: 'error', aiScore: 42 },
  { id: 's3', studentName: 'Maya Green', courseName: 'Calculus II', assignmentTitle: 'Integration Techniques', status: 'pending', aiScore: 91 },
  { id: 's4', studentName: 'Tom Shapira', courseName: 'Physics I', assignmentTitle: "Newton's Laws", status: 'review', aiScore: 76 },
  { id: 's5', studentName: 'Noa Miller', courseName: 'Calculus II', assignmentTitle: 'Integration Techniques', status: 'published', aiScore: 88 },
];

type CourseOverview = {
  id: string;
  name: string;
  students: number;
  pending: number;
  currentWeek: number;
  deadlineSoon: boolean;
};

const courses: CourseOverview[] = [
  { id: 'c1', name: 'Linear Algebra', students: 45, pending: 12, currentWeek: 5, deadlineSoon: true },
  { id: 'c2', name: 'Calculus II', students: 52, pending: 4, currentWeek: 5, deadlineSoon: false },
  { id: 'c3', name: 'Physics I', students: 30, pending: 2, currentWeek: 4, deadlineSoon: false },
];

const gradeDistribution = [
  { range: '90-100', count: 24, pct: 30 },
  { range: '80-89', count: 38, pct: 47 },
  { range: '70-79', count: 32, pct: 40 },
  { range: '60-69', count: 21, pct: 26 },
  { range: '<60', count: 12, pct: 15 },
];

const commonMistakes = [
  { topic: 'Matrix Multiplication Order', count: 18, course: 'Linear Algebra' },
  { topic: 'Integration by Parts Setup', count: 14, course: 'Calculus II' },
  { topic: 'Free Body Diagram Missing Forces', count: 9, course: 'Physics I' },
];

function scoreColor(score: number): string {
  if (score >= 80) return 'text-(--success)';
  if (score >= 60) return 'text-(--warning)';
  return 'text-(--error)';
}

function scoreBg(score: number): string {
  if (score >= 80) return 'bg-(--success-subtle)';
  if (score >= 60) return 'bg-(--warning-subtle)';
  return 'bg-(--error-subtle)';
}

export default function LecturerDashboard() {
  return (
    <div className="space-y-8">
      <PageHeader title="Dashboard" />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active Courses" value={3} icon={<BookOpen />} />
        <StatCard label="Students" value={127} icon={<Users />} />
        <StatCard
          label="Pending Review"
          value={18}
          icon={<ClipboardCheck />}
          trend={{ value: '5 new', positive: false }}
        />
        <StatCard label="Published" value={42} icon={<CheckCircle2 />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        {/* Left column */}
        <div className="space-y-6">
          {/* Recent Submissions */}
          <Card padding="none" className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-(--border) px-5 py-4">
              <h2 className="text-sm font-semibold text-(--text-primary)">Recent Submissions</h2>
              <Link
                href="/l/submissions"
                className="text-xs font-medium text-(--brand) transition-colors hover:text-(--brand-hover)"
              >
                View all
              </Link>
            </div>
            <div className="divide-y divide-(--border-light)">
              {recentSubmissions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-(--surface-hover)"
                >
                  {/* Avatar initials */}
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-(--surface-secondary) text-xs font-semibold text-(--text-secondary)">
                    {s.studentName.split(' ').map((n) => n[0]).join('')}
                  </div>

                  {/* Name + course */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-(--text-primary)">{s.studentName}</p>
                    <p className="truncate text-xs text-(--text-tertiary)">
                      {s.courseName} &middot; {s.assignmentTitle}
                    </p>
                  </div>

                  {/* AI score */}
                  <span
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold',
                      scoreBg(s.aiScore),
                      scoreColor(s.aiScore),
                    )}
                  >
                    {s.aiScore}
                  </span>

                  {/* Status */}
                  <StatusBadge status={s.status} size="sm" />

                  {/* View link */}
                  <Link
                    href="/l/courses/c1/assignments/a1/review"
                    className="rounded-lg p-1.5 text-(--text-quaternary) transition-colors hover:bg-(--surface-secondary) hover:text-(--text-primary)"
                  >
                    <Eye className="h-4 w-4" />
                  </Link>
                </div>
              ))}
            </div>
          </Card>

          {/* Courses Overview */}
          <Card padding="none" className="overflow-hidden">
            <div className="border-b border-(--border) px-5 py-4">
              <h2 className="text-sm font-semibold text-(--text-primary)">Courses Overview</h2>
            </div>
            <div className="divide-y divide-(--border-light)">
              {courses.map((c) => (
                <Link
                  key={c.id}
                  href={`/l/courses/${c.id}`}
                  className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-(--surface-hover)"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-(--brand-subtle) text-sm font-semibold text-(--brand)">
                    {c.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-(--text-primary)">{c.name}</p>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-(--text-tertiary)">
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{c.students}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Week {c.currentWeek}</span>
                    </div>
                  </div>

                  {c.pending > 0 && (
                    <Badge variant="warning">{c.pending} pending</Badge>
                  )}
                  {c.deadlineSoon && (
                    <Badge variant="error">Deadline soon</Badge>
                  )}

                  <ChevronRight className="h-4 w-4 shrink-0 text-(--text-quaternary)" />
                </Link>
              ))}
            </div>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Grade Distribution */}
          <Card padding="md">
            <div className="mb-5 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-(--brand)" />
              <h3 className="text-sm font-semibold text-(--text-primary)">Grade Distribution</h3>
            </div>
            <div className="space-y-3">
              {gradeDistribution.map((g) => (
                <div key={g.range}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-(--text-secondary)">{g.range}</span>
                    <span className="tabular-nums text-(--text-tertiary)">{g.count}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-(--surface-secondary)">
                    <div
                      className="h-full rounded-full bg-(--brand) transition-all"
                      style={{ width: `${g.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Common Mistakes */}
          <Card padding="md">
            <div className="mb-5 flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-(--error)" />
              <h3 className="text-sm font-semibold text-(--text-primary)">Common Mistakes</h3>
            </div>
            <div className="space-y-2.5">
              {commonMistakes.map((m, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-lg bg-(--surface-secondary) p-3"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-(--error-subtle) text-[11px] font-semibold text-(--error)">
                    {m.count}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-(--text-primary)">{m.topic}</p>
                    <p className="text-xs text-(--text-tertiary)">{m.course}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
