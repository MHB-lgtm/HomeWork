'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  BookOpen, Clock, CheckCircle2, TrendingUp,
  ChevronRight, FileText, Calendar, Target,
} from 'lucide-react';
import { cn } from '../../../../lib/utils';
import { PageHeader } from '../../../../components/ui/page-header';
import { StatCard } from '../../../../components/ui/stat-card';
import { StatusBadge } from '../../../../components/ui/status-badge';
import { Card } from '../../../../components/ui/card';
import { EmptyState } from '../../../../components/ui/empty-state';

// ── Mock data ──

type Assignment = {
  id: string;
  courseId: string;
  courseName: string;
  title: string;
  week: number;
  status: 'open' | 'submitted' | 'graded' | 'overdue';
  deadline: string;
  grade?: number;
  maxGrade?: number;
};

const assignments: Assignment[] = [
  { id: 'a1', courseId: 'c1', courseName: 'Linear Algebra', title: 'Matrix Operations', week: 5, status: 'open', deadline: '2026-04-02' },
  { id: 'a2', courseId: 'c1', courseName: 'Linear Algebra', title: 'Eigenvalues', week: 4, status: 'submitted', deadline: '2026-03-26' },
  { id: 'a3', courseId: 'c2', courseName: 'Calculus II', title: 'Integration Techniques', week: 5, status: 'open', deadline: '2026-04-03' },
  { id: 'a4', courseId: 'c2', courseName: 'Calculus II', title: 'Series Convergence', week: 4, status: 'graded', deadline: '2026-03-25', grade: 92, maxGrade: 100 },
  { id: 'a5', courseId: 'c3', courseName: 'Physics I', title: "Newton's Laws", week: 4, status: 'graded', deadline: '2026-03-24', grade: 78, maxGrade: 100 },
  { id: 'a6', courseId: 'c3', courseName: 'Physics I', title: 'Work and Energy', week: 5, status: 'open', deadline: '2026-04-01' },
];

const gradeHistory = [
  { week: 'W1', grade: 75 },
  { week: 'W2', grade: 82 },
  { week: 'W3', grade: 79 },
  { week: 'W4', grade: 88 },
  { week: 'W5', grade: 92 },
];

const focusAreas = [
  { topic: 'Eigenvalue Decomposition', score: 62 },
  { topic: 'Integration by Parts', score: 70 },
  { topic: 'Rotational Motion', score: 74 },
];

type TabKey = 'all' | 'open' | 'submitted' | 'graded';

const statusToStatusBadge: Record<Assignment['status'], string> = {
  open: 'active',
  submitted: 'pending',
  graded: 'done',
  overdue: 'error',
};

export default function StudentDashboard() {
  const [tab, setTab] = useState<TabKey>('all');
  const filtered = tab === 'all' ? assignments : assignments.filter((a) => a.status === tab);

  return (
    <div className="space-y-12">
      <PageHeader
        gradient
        icon={<BookOpen />}
        eyebrow="Student Dashboard"
        title="Welcome back 👋"
        subtitle="Track assignments, deadlines, and your progress across all courses."
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        <StatCard label="Active Courses" value="4" icon={<BookOpen />} accent="#0d9488" />
        <StatCard label="Due This Week" value="3" icon={<Clock />} accent="#f59e0b" />
        <StatCard label="Submitted" value="12" icon={<CheckCircle2 />} accent="#16a34a" />
        <StatCard
          label="Avg Grade"
          value="87"
          icon={<TrendingUp />}
          accent="#0891b2"
          trend={{ value: '+4pts', positive: true }}
        />
      </div>

      <div className="grid gap-7 xl:grid-cols-[1fr_360px]">
        {/* Assignments */}
        <Card padding="none" className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--border-light) px-7 py-6">
            <h2 className="text-lg font-semibold text-(--text-primary)">Upcoming</h2>
            <div className="flex gap-1 rounded-lg bg-(--surface-secondary) p-1">
              {(['all', 'open', 'submitted', 'graded'] as TabKey[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    'rounded-md px-3.5 py-1.5 text-[13px] font-medium capitalize transition-all',
                    tab === t
                      ? 'bg-(--surface) text-(--text-primary) shadow-sm'
                      : 'text-(--text-tertiary) hover:text-(--text-secondary)'
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-(--border-light)">
            {filtered.length === 0 ? (
              <EmptyState
                icon={<FileText />}
                title="No assignments in this category"
                className="py-12"
              />
            ) : (
              filtered.map((a) => (
                <Link
                  key={a.id}
                  href={
                    a.status === 'graded'
                      ? `/s/courses/${a.courseId}/assignments/${a.id}/result`
                      : `/s/courses/${a.courseId}/assignments/${a.id}/workspace`
                  }
                  className="flex items-center gap-4 px-7 py-6 transition-colors hover:bg-(--surface-hover)"
                >
                  <div
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[13px] font-semibold',
                      a.status === 'graded'
                        ? 'bg-(--success-subtle) text-(--success)'
                        : a.status === 'submitted'
                          ? 'bg-(--warning-subtle) text-(--warning)'
                          : 'bg-(--surface-secondary) text-(--text-secondary)'
                    )}
                  >
                    W{a.week}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-(--text-primary)">
                      {a.title}
                    </p>
                    <p className="truncate text-[13px] text-(--text-tertiary) mt-0.5">
                      {a.courseName}
                    </p>
                  </div>

                  <div className="hidden items-center gap-1.5 text-[13px] text-(--text-quaternary) sm:flex whitespace-nowrap">
                    <Calendar size={14} />
                    {new Date(a.deadline).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>

                  <StatusBadge
                    status={statusToStatusBadge[a.status]}
                    label={
                      a.status === 'graded' && a.grade != null
                        ? `${a.grade}/${a.maxGrade}`
                        : undefined
                    }
                    size="sm"
                  />

                  <ChevronRight size={16} className="text-(--text-quaternary) shrink-0 rtl:rotate-180" />
                </Link>
              ))
            )}
          </div>
        </Card>

        {/* Right column */}
        <div className="space-y-6">
          {/* Grade Trend */}
          <Card padding="md">
            <h3 className="mb-5 text-[16px] font-semibold text-(--text-primary)">Grade Trend</h3>
            <div className="flex items-end gap-2" style={{ height: 128 }}>
              {gradeHistory.map((g, i) => {
                const barHeight = (g.grade / 100) * 96;
                return (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                    <span className="text-[12px] font-semibold text-(--text-primary) tabular-nums">
                      {g.grade}
                    </span>
                    <div
                      className="w-full rounded-t-sm bg-(--brand)"
                      style={{ height: `${barHeight}px` }}
                    />
                    <span className="text-[11px] text-(--text-quaternary)">{g.week}</span>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Focus Areas */}
          <Card padding="md">
            <div className="mb-5 flex items-center gap-2">
              <Target size={16} className="text-(--text-tertiary)" />
              <h3 className="text-[16px] font-semibold text-(--text-primary)">Focus Areas</h3>
            </div>
            <div className="space-y-4">
              {focusAreas.map((t, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[13px] font-medium text-(--text-secondary) truncate">
                      {t.topic}
                    </span>
                    <span className="text-[13px] font-semibold text-(--text-primary) tabular-nums shrink-0">
                      {t.score}%
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-(--surface-tertiary) overflow-hidden">
                    <div
                      className="h-full rounded-full bg-(--brand)"
                      style={{ width: `${t.score}%` }}
                    />
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
