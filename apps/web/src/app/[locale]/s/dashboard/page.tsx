'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  BookOpen, Clock, CheckCircle2, TrendingUp,
  ChevronRight, FileText, Calendar, Target, Cpu, Eye, Lock, PlayCircle,
} from 'lucide-react';
import { cn } from '../../../../lib/utils';
import { PageHeader } from '../../../../components/ui/page-header';
import { StatCard } from '../../../../components/ui/stat-card';
import { StatusBadge } from '../../../../components/ui/status-badge';
import { Card } from '../../../../components/ui/card';
import { EmptyState } from '../../../../components/ui/empty-state';
import {
  DEMO_COURSES,
  DEMO_STUDENT,
  getAllAssignments,
  getOverallProgress,
  STATUS_LABEL,
  statusBadgeTone,
  studentAssignmentHref,
  type AssignmentStatus,
  type DemoAssignment,
} from '../../../../lib/demoSeed';

type TabKey = 'all' | 'open' | 'in-grading' | 'published';

function statusIcon(status: AssignmentStatus) {
  switch (status) {
    case 'OPEN': return <PlayCircle className="h-4 w-4" />;
    case 'SUBMITTED': return <CheckCircle2 className="h-4 w-4" />;
    case 'WAITING_FOR_REVIEW': return <Clock className="h-4 w-4" />;
    case 'PROCESSING': return <Cpu className="h-4 w-4" />;
    case 'READY_FOR_REVIEW': return <Eye className="h-4 w-4" />;
    case 'PUBLISHED': return <CheckCircle2 className="h-4 w-4" />;
    case 'CLOSED': return <Lock className="h-4 w-4" />;
  }
}

function inTab(a: DemoAssignment, tab: TabKey): boolean {
  switch (tab) {
    case 'all': return true;
    case 'open': return a.status === 'OPEN' || a.status === 'SUBMITTED';
    case 'in-grading':
      return a.status === 'WAITING_FOR_REVIEW' || a.status === 'PROCESSING' || a.status === 'READY_FOR_REVIEW';
    case 'published': return a.status === 'PUBLISHED';
  }
}

export default function StudentDashboard() {
  const params = useParams();
  const locale = (params?.locale as string) ?? 'en';
  const studentPrefix = `/${locale}/s`;
  const localePrefix = `/${locale}`;

  const [tab, setTab] = useState<TabKey>('all');

  const overall = getOverallProgress();
  const all = useMemo(() => getAllAssignments(), []);

  const sortedFeed = useMemo(() => {
    const score = (a: DemoAssignment) => {
      if (a.status === 'OPEN') return new Date(a.deadline).getTime();
      if (a.status === 'SUBMITTED') return new Date(a.deadline).getTime();
      if (a.status === 'PROCESSING') return Date.now() - 1000 * 60;
      if (a.status === 'WAITING_FOR_REVIEW') return Date.now() - 1000 * 60 * 30;
      if (a.status === 'READY_FOR_REVIEW') return Date.now() - 1000 * 60 * 60;
      if (a.status === 'PUBLISHED') return new Date(a.publishedAt ?? a.deadline).getTime();
      return 0;
    };
    return [...all].sort((a, b) => score(a) - score(b));
  }, [all]);

  const filtered = sortedFeed.filter((a) => inTab(a, tab));

  const trend = useMemo(() => {
    return all
      .filter((a) => a.status === 'PUBLISHED' && a.finalScore != null)
      .sort((a, b) => new Date(a.publishedAt ?? 0).getTime() - new Date(b.publishedAt ?? 0).getTime())
      .slice(-6)
      .map((a) => ({
        label: `W${a.weekNumber}`,
        grade: Math.round((a.finalScore! / a.maxScore) * 100),
      }));
  }, [all]);

  const focusAreas = useMemo(() => {
    const byTopic = new Map<string, { total: number; lost: number }>();
    all
      .filter((a) => a.status === 'PUBLISHED' && a.results)
      .forEach((a) => {
        a.results!.forEach((r) => {
          const cur = byTopic.get(r.title) ?? { total: 0, lost: 0 };
          cur.total += r.maxPoints;
          cur.lost += r.maxPoints - r.earnedPoints;
          byTopic.set(r.title, cur);
        });
      });
    return Array.from(byTopic.entries())
      .map(([topic, v]) => ({ topic, score: Math.round(((v.total - v.lost) / v.total) * 100) }))
      .filter((x) => x.score < 90)
      .sort((a, b) => a.score - b.score)
      .slice(0, 4);
  }, [all]);

  return (
    <div className="space-y-12">
      <PageHeader
        gradient
        icon={<BookOpen />}
        eyebrow="Student dashboard"
        title={`Welcome back, ${DEMO_STUDENT.name.split(' ')[0]} 👋`}
        subtitle="Track assignments, deadlines, and your progress across all courses."
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        <StatCard label="Active courses" value={DEMO_STUDENT.enrolledCourseIds.length} icon={<BookOpen />} accent="#0d9488" />
        <StatCard label="Open" value={overall.open} icon={<Clock />} accent="#f59e0b" />
        <StatCard label="In grading" value={overall.inGrading} icon={<Cpu />} accent="#9333ea" />
        <StatCard
          label="Avg grade"
          value={overall.averageGrade}
          icon={<TrendingUp />}
          accent="#0891b2"
          trend={overall.averageGrade >= 80 ? { value: 'on track', positive: true } : undefined}
        />
      </div>

      <div className="grid gap-7 xl:grid-cols-[1fr_360px]">
        {/* Assignments */}
        <Card padding="none" className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--border-light) px-7 py-6">
            <h2 className="text-lg font-semibold text-(--text-primary)">My work</h2>
            <div className="flex gap-1 rounded-lg bg-(--surface-secondary) p-1">
              {([
                { key: 'all', label: 'All' },
                { key: 'open', label: 'Open' },
                { key: 'in-grading', label: 'In grading' },
                { key: 'published', label: 'Published' },
              ] as { key: TabKey; label: string }[]).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    'rounded-md px-3.5 py-1.5 text-[13px] font-medium transition-all',
                    tab === t.key
                      ? 'bg-(--surface) text-(--text-primary) shadow-sm'
                      : 'text-(--text-tertiary) hover:text-(--text-secondary)',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-(--border-light)">
            {filtered.length === 0 ? (
              <EmptyState icon={<FileText />} title="Nothing in this tab yet" className="py-12" />
            ) : (
              filtered.map((a) => {
                const courseName = DEMO_COURSES.find((c) => c.id === a.courseId)?.title ?? a.courseId;
                const href = studentAssignmentHref(localePrefix, a) ?? '#';
                return (
                  <Link
                    key={a.id}
                    href={href}
                    className="flex items-center gap-4 px-7 py-6 transition-colors hover:bg-(--surface-hover)"
                  >
                    <span
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-[13px] font-semibold',
                        a.status === 'PUBLISHED' && 'bg-(--success-subtle) text-(--success)',
                        a.status === 'SUBMITTED' && 'bg-(--warning-subtle) text-(--warning)',
                        (a.status === 'WAITING_FOR_REVIEW' || a.status === 'PROCESSING' || a.status === 'READY_FOR_REVIEW') &&
                          'bg-(--info-subtle) text-(--info)',
                        a.status === 'OPEN' && 'bg-(--brand-subtle) text-(--brand)',
                        a.status === 'CLOSED' && 'bg-(--surface-secondary) text-(--text-quaternary)',
                      )}
                    >
                      W{a.weekNumber}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-medium text-(--text-primary)">{a.title}</p>
                      <p className="truncate text-[13px] text-(--text-tertiary) mt-0.5">{courseName}</p>
                    </div>

                    <div className="hidden items-center gap-1.5 text-[13px] text-(--text-quaternary) sm:flex whitespace-nowrap">
                      <Calendar size={14} />
                      {new Date(a.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>

                    <StatusBadge
                      status={statusBadgeTone(a.status)}
                      label={
                        a.status === 'PUBLISHED' && a.finalScore != null
                          ? `${a.finalScore}/${a.maxScore}`
                          : STATUS_LABEL[a.status]
                      }
                      size="sm"
                    />

                    <ChevronRight size={16} className="text-(--text-quaternary) shrink-0 rtl:rotate-180" />
                  </Link>
                );
              })
            )}
          </div>
        </Card>

        {/* Right column */}
        <div className="space-y-6">
          <Card padding="md">
            <h3 className="mb-5 text-[16px] font-semibold text-(--text-primary)">Grade trend</h3>
            {trend.length === 0 ? (
              <p className="text-sm text-(--text-tertiary)">No grades published yet.</p>
            ) : (
              <div className="flex items-end gap-2" style={{ height: 128 }}>
                {trend.map((g, i) => {
                  const barHeight = (g.grade / 100) * 96;
                  return (
                    <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                      <span className="text-[12px] font-semibold text-(--text-primary) tabular-nums">{g.grade}</span>
                      <div className="w-full rounded-t-sm bg-(--brand)" style={{ height: `${barHeight}px` }} />
                      <span className="text-[11px] text-(--text-quaternary)">{g.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card padding="md">
            <div className="mb-5 flex items-center gap-2">
              <Target size={16} className="text-(--text-tertiary)" />
              <h3 className="text-[16px] font-semibold text-(--text-primary)">Focus areas</h3>
            </div>
            {focusAreas.length === 0 ? (
              <p className="text-sm text-(--text-tertiary)">Great work \u2014 no weak topics yet.</p>
            ) : (
              <div className="space-y-4">
                {focusAreas.map((t, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[13px] font-medium text-(--text-secondary) truncate">{t.topic}</span>
                      <span className="text-[13px] font-semibold text-(--text-primary) tabular-nums shrink-0">
                        {t.score}%
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-(--surface-tertiary) overflow-hidden">
                      <div className="h-full rounded-full bg-(--brand)" style={{ width: `${t.score}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Link href={`${studentPrefix}/progress`}>
            <Card padding="md" hover className="flex items-center gap-3 cursor-pointer">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-(--brand-subtle) text-(--brand)">
                <TrendingUp className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-(--text-primary)">View full progress</p>
                <p className="text-xs text-(--text-tertiary)">Trend, course-level stats, strengths & focus areas.</p>
              </div>
              <ChevronRight className="h-4 w-4 text-(--text-quaternary) shrink-0 rtl:rotate-180" />
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
