'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  TrendingUp,
  Trophy,
  CheckCircle2,
  Target,
  Sparkles,
  AlertTriangle,
  ChevronRight,
  Activity,
  BookOpen,
  Calendar,
  Cpu,
  Eye,
  Clock,
  Lock,
} from 'lucide-react';
import { cn } from '../../../../lib/utils';
import { PageHeader } from '../../../../components/ui/page-header';
import { Card } from '../../../../components/ui/card';
import { StatCard } from '../../../../components/ui/stat-card';
import { StatusBadge } from '../../../../components/ui/status-badge';
import { Badge } from '../../../../components/ui/badge';
import {
  DEMO_COURSES,
  DEMO_STUDENT,
  getAllAssignments,
  getCourseProgress,
  getOverallProgress,
  STATUS_LABEL,
  statusBadgeTone,
  type AssignmentStatus,
  type DemoAssignment,
} from '../../../../lib/demoSeed';

/* ─────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────── */

function formatDate(iso?: string): string {
  if (!iso) return '\u2014';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateLong(iso?: string): string {
  if (!iso) return '\u2014';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function gradeColor(grade: number): string {
  if (grade >= 90) return 'text-(--success)';
  if (grade >= 80) return 'text-(--brand)';
  if (grade >= 70) return 'text-(--warning)';
  return 'text-(--error)';
}

function gradeBg(grade: number): string {
  if (grade >= 90) return 'bg-(--success)';
  if (grade >= 80) return 'bg-(--brand)';
  if (grade >= 70) return 'bg-(--warning)';
  return 'bg-(--error)';
}

function statusIcon(status: AssignmentStatus) {
  switch (status) {
    case 'OPEN':
      return <BookOpen className="h-4 w-4" />;
    case 'SUBMITTED':
      return <CheckCircle2 className="h-4 w-4" />;
    case 'WAITING_FOR_REVIEW':
      return <Clock className="h-4 w-4" />;
    case 'PROCESSING':
      return <Cpu className="h-4 w-4" />;
    case 'READY_FOR_REVIEW':
      return <Eye className="h-4 w-4" />;
    case 'PUBLISHED':
      return <CheckCircle2 className="h-4 w-4" />;
    case 'CLOSED':
      return <Lock className="h-4 w-4" />;
  }
}

/* ─────────────────────────────────────────────
   Page
   ───────────────────────────────────────────── */

export default function StudentProgressPage() {
  const params = useParams();
  const locale = (params?.locale as string) ?? 'en';
  const studentPrefix = `/${locale}/s`;

  const overall = getOverallProgress();
  const all = getAllAssignments();

  const recentPublished = useMemo(
    () =>
      all
        .filter((a) => a.status === 'PUBLISHED' && a.publishedAt)
        .sort((a, b) => new Date(b.publishedAt!).getTime() - new Date(a.publishedAt!).getTime())
        .slice(0, 5),
    [all],
  );

  const inFlight = useMemo(
    () =>
      all
        .filter((a) => ['SUBMITTED', 'WAITING_FOR_REVIEW', 'PROCESSING', 'READY_FOR_REVIEW'].includes(a.status))
        .sort((a, b) => new Date(b.submittedAt ?? 0).getTime() - new Date(a.submittedAt ?? 0).getTime()),
    [all],
  );

  const upcoming = useMemo(
    () =>
      all
        .filter((a) => a.status === 'OPEN')
        .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()),
    [all],
  );

  const trend = useMemo(() => {
    const published = all
      .filter((a) => a.status === 'PUBLISHED' && a.publishedAt && a.finalScore != null)
      .sort((a, b) => new Date(a.publishedAt!).getTime() - new Date(b.publishedAt!).getTime());

    return published.map((a) => ({
      label: `W${a.weekNumber}`,
      grade: Math.round((a.finalScore! / a.maxScore) * 100),
      title: a.shortTitle,
      courseId: a.courseId,
    }));
  }, [all]);

  const topicSignals = useMemo(() => {
    const buckets: { topic: string; total: number; lost: number }[] = [];
    const byTopic = new Map<string, { total: number; lost: number }>();
    all
      .filter((a) => a.status === 'PUBLISHED' && a.results)
      .forEach((a) => {
        a.results!.forEach((r) => {
          const key = r.title;
          const cur = byTopic.get(key) ?? { total: 0, lost: 0 };
          cur.total += r.maxPoints;
          cur.lost += r.maxPoints - r.earnedPoints;
          byTopic.set(key, cur);
        });
      });
    byTopic.forEach((v, topic) => buckets.push({ topic, ...v }));
    return buckets;
  }, [all]);

  const strengths = topicSignals
    .filter((t) => t.total >= 20)
    .map((t) => ({ ...t, mastery: Math.round(((t.total - t.lost) / t.total) * 100) }))
    .sort((a, b) => b.mastery - a.mastery)
    .slice(0, 4);

  const weakSpots = topicSignals
    .filter((t) => t.total >= 20)
    .map((t) => ({ ...t, mastery: Math.round(((t.total - t.lost) / t.total) * 100) }))
    .sort((a, b) => a.mastery - b.mastery)
    .slice(0, 4);

  return (
    <div className="space-y-12">
      <PageHeader
        gradient
        eyebrow="Progress overview"
        icon={<TrendingUp />}
        title={`Hi, ${DEMO_STUDENT.name.split(' ')[0]} \u2014 here\u2019s how you\u2019re doing`}
        subtitle="A snapshot of your performance across every course this semester."
      />

      {/* Overall stats */}
      <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        <StatCard label="Average grade" value={overall.averageGrade} icon={<TrendingUp />} accent="#0d9488" />
        <StatCard label="Best grade" value={overall.bestGrade} icon={<Trophy />} accent="#16a34a" />
        <StatCard label="Submitted" value={overall.published + overall.inGrading + overall.submitted} icon={<CheckCircle2 />} accent="#0891b2" />
        <StatCard label="In grading" value={overall.inGrading} icon={<Cpu />} accent="#9333ea" />
      </div>

      <div className="grid gap-7 xl:grid-cols-[1fr_360px]">
        {/* Left column */}
        <div className="space-y-7 min-w-0">
          {/* Grade trend */}
          <Card padding="lg">
            <div className="flex items-end justify-between gap-3 mb-6">
              <div>
                <p className="label-micro mb-1.5">Performance trend</p>
                <h2 className="text-lg font-semibold text-(--text-primary)">Grades across the semester</h2>
              </div>
              {trend.length > 0 && (
                <span className="text-xs text-(--text-tertiary)">{trend.length} graded</span>
              )}
            </div>

            {trend.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-sm text-(--text-tertiary)">
                No grades published yet.
              </div>
            ) : (
              <div className="flex items-end gap-3 overflow-x-auto pb-2" style={{ height: 180 }}>
                {trend.map((t, i) => {
                  const barHeight = (t.grade / 100) * 144;
                  return (
                    <div key={i} className="flex shrink-0 basis-12 flex-col items-center gap-2">
                      <span className={cn('text-xs font-bold tabular-nums', gradeColor(t.grade))}>
                        {t.grade}
                      </span>
                      <div
                        className={cn('w-full rounded-t-md transition-all duration-700', gradeBg(t.grade))}
                        style={{ height: `${barHeight}px` }}
                        title={`${t.title} (${t.label}): ${t.grade}`}
                      />
                      <span className="text-[11px] font-medium text-(--text-quaternary)">{t.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Per-course breakdown */}
          <section className="space-y-4">
            <div>
              <p className="label-micro mb-1.5">By course</p>
              <h2 className="text-lg font-semibold text-(--text-primary)">Course-level performance</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {DEMO_COURSES.filter((c) => DEMO_STUDENT.enrolledCourseIds.includes(c.id)).map((c) => {
                const p = getCourseProgress(c.id);
                const completion = p.total ? Math.round((p.published / p.total) * 100) : 0;
                return (
                  <Link key={c.id} href={`${studentPrefix}/courses/${c.id}`}>
                    <Card padding="md" hover className="cursor-pointer h-full">
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-wider text-(--text-quaternary)">
                            {c.code}
                          </p>
                          <p className="mt-1 text-base font-bold text-(--text-primary) truncate">{c.title}</p>
                          <p className="mt-0.5 text-xs text-(--text-tertiary) truncate">{c.lecturer}</p>
                        </div>
                        <div className={cn('text-2xl font-bold tabular-nums', gradeColor(p.averageGrade || 0))}>
                          {p.averageGrade || '\u2014'}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-(--text-tertiary)">
                          <span>Progress</span>
                          <span className="font-semibold tabular-nums text-(--text-secondary)">{completion}%</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-(--surface-tertiary)">
                          <div
                            className="h-full rounded-full bg-(--brand) transition-all duration-700"
                            style={{ width: `${completion}%` }}
                          />
                        </div>
                        <div className="flex flex-wrap gap-1.5 pt-2">
                          <Badge variant="default" size="sm">
                            {p.published} graded
                          </Badge>
                          <Badge variant="default" size="sm">
                            {p.submitted - p.published} pending
                          </Badge>
                          <Badge variant="default" size="sm">
                            {p.total - p.submitted} open
                          </Badge>
                        </div>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* Recent grades */}
          <Card padding="lg">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div>
                <p className="label-micro mb-1.5">Recent activity</p>
                <h2 className="text-lg font-semibold text-(--text-primary)">Latest published grades</h2>
              </div>
              <Link
                href={`${studentPrefix}/results`}
                className="text-xs font-semibold text-(--brand) hover:underline"
              >
                View all
              </Link>
            </div>

            {recentPublished.length === 0 ? (
              <p className="text-sm text-(--text-tertiary)">No grades published yet.</p>
            ) : (
              <ul className="divide-y divide-(--border-light) rounded-xl border border-(--border-light) overflow-hidden">
                {recentPublished.map((a) => {
                  const pct = Math.round((a.finalScore! / a.maxScore) * 100);
                  return (
                    <li key={a.id}>
                      <Link
                        href={`${studentPrefix}/courses/${a.courseId}/assignments/${a.id}/result`}
                        className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-(--surface-hover)"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-(--success-subtle) text-(--success)">
                          <CheckCircle2 className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p className="text-sm font-semibold text-(--text-primary) truncate">{a.title}</p>
                          <p className="text-xs text-(--text-tertiary) truncate">
                            {DEMO_COURSES.find((c) => c.id === a.courseId)?.title} \u00b7 W{a.weekNumber} \u00b7 Published {formatDate(a.publishedAt)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={cn('text-sm font-bold tabular-nums', gradeColor(pct))}>
                            {a.finalScore}/{a.maxScore}
                          </p>
                          <p className="text-[11px] text-(--text-quaternary)">{pct}%</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-(--text-quaternary) rtl:rotate-180" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        {/* Right column */}
        <aside className="space-y-6">
          {/* Strengths */}
          <Card padding="md">
            <div className="mb-5 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-(--success)" />
              <h3 className="text-base font-semibold text-(--text-primary)">Strengths</h3>
            </div>
            {strengths.length === 0 ? (
              <p className="text-sm text-(--text-tertiary)">Not enough data yet.</p>
            ) : (
              <ul className="space-y-4">
                {strengths.map((t, i) => (
                  <TopicBar key={i} topic={t.topic} mastery={t.mastery} tone="success" />
                ))}
              </ul>
            )}
          </Card>

          {/* Weak spots */}
          <Card padding="md">
            <div className="mb-5 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-(--warning)" />
              <h3 className="text-base font-semibold text-(--text-primary)">Focus areas</h3>
            </div>
            {weakSpots.length === 0 ? (
              <p className="text-sm text-(--text-tertiary)">Not enough data yet.</p>
            ) : (
              <ul className="space-y-4">
                {weakSpots.map((t, i) => (
                  <TopicBar key={i} topic={t.topic} mastery={t.mastery} tone="warning" />
                ))}
              </ul>
            )}
          </Card>

          {/* In grading */}
          <Card padding="md">
            <div className="mb-4 flex items-center gap-2">
              <Activity className="h-4 w-4 text-(--brand)" />
              <h3 className="text-base font-semibold text-(--text-primary)">In grading</h3>
            </div>
            {inFlight.length === 0 ? (
              <p className="text-sm text-(--text-tertiary)">Nothing pending right now.</p>
            ) : (
              <ul className="space-y-3">
                {inFlight.slice(0, 4).map((a) => (
                  <PendingRow key={a.id} a={a} studentPrefix={studentPrefix} />
                ))}
              </ul>
            )}
          </Card>

          {/* Upcoming */}
          <Card padding="md">
            <div className="mb-4 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-(--brand)" />
              <h3 className="text-base font-semibold text-(--text-primary)">Coming up</h3>
            </div>
            {upcoming.length === 0 ? (
              <p className="text-sm text-(--text-tertiary)">Nothing open right now.</p>
            ) : (
              <ul className="space-y-3">
                {upcoming.slice(0, 4).map((a) => (
                  <UpcomingRow key={a.id} a={a} studentPrefix={studentPrefix} />
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Subcomponents
   ───────────────────────────────────────────── */

function TopicBar({ topic, mastery, tone }: { topic: string; mastery: number; tone: 'success' | 'warning' }) {
  return (
    <li>
      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-sm font-medium text-(--text-secondary)">{topic}</span>
        <span
          className={cn(
            'shrink-0 text-xs font-semibold tabular-nums',
            tone === 'success' ? 'text-(--success)' : 'text-(--warning)',
          )}
        >
          {mastery}%
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-(--surface-tertiary)">
        <div
          className={cn('h-full rounded-full', tone === 'success' ? 'bg-(--success)' : 'bg-(--warning)')}
          style={{ width: `${mastery}%` }}
        />
      </div>
    </li>
  );
}

function PendingRow({ a, studentPrefix }: { a: DemoAssignment; studentPrefix: string }) {
  return (
    <li>
      <Link
        href={`${studentPrefix}/courses/${a.courseId}/assignments/${a.id}`}
        className="flex items-start gap-3 rounded-xl px-3 py-2.5 -mx-2 transition-colors hover:bg-(--surface-hover)"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-(--info-subtle) text-(--info)">
          {statusIcon(a.status)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-(--text-primary) truncate">{a.title}</p>
          <p className="mt-0.5 text-[11px] text-(--text-tertiary) truncate">
            {STATUS_LABEL[a.status]}
            {a.submittedAt ? ` \u00b7 sent ${formatDate(a.submittedAt)}` : ''}
          </p>
        </div>
      </Link>
    </li>
  );
}

function UpcomingRow({ a, studentPrefix }: { a: DemoAssignment; studentPrefix: string }) {
  const ms = new Date(a.deadline).getTime() - Date.now();
  const days = Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
  const tone = days <= 1 ? 'warning' : days <= 3 ? 'warning' : 'safe';
  return (
    <li>
      <Link
        href={`${studentPrefix}/courses/${a.courseId}/assignments/${a.id}`}
        className="flex items-start gap-3 rounded-xl px-3 py-2.5 -mx-2 transition-colors hover:bg-(--surface-hover)"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-(--brand-subtle) text-(--brand)">
          <BookOpen className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-(--text-primary) truncate">{a.title}</p>
          <p className="mt-0.5 text-[11px] text-(--text-tertiary) truncate">
            Due {formatDateLong(a.deadline)} \u00b7 {days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`}
          </p>
        </div>
        <span
          className={cn(
            'shrink-0 text-[11px] font-semibold',
            tone === 'warning' ? 'text-(--warning)' : 'text-(--text-tertiary)',
          )}
        >
          {days}d
        </span>
      </Link>
    </li>
  );
}
