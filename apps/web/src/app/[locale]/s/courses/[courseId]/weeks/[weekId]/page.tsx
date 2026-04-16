'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  BookOpen,
  Calendar,
  ChevronRight,
  FileText,
  Lock,
  Sparkles,
  Video,
  CheckCircle2,
  Clock,
  Cpu,
  Eye,
  PlayCircle,
} from 'lucide-react';
import { cn } from '../../../../../../../lib/utils';
import { PageHeader } from '../../../../../../../components/ui/page-header';
import { Card } from '../../../../../../../components/ui/card';
import { StatCard } from '../../../../../../../components/ui/stat-card';
import { StatusBadge } from '../../../../../../../components/ui/status-badge';
import {
  getAssignmentsForWeek,
  getCourseOrFallback,
  getWeek,
  getWeeksForCourse,
  STATUS_LABEL,
  statusBadgeTone,
  type AssignmentStatus,
  type DemoAssignment,
} from '../../../../../../../lib/demoSeed';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatGrade(score?: number, max?: number): string {
  if (score == null || max == null) return '\u2014';
  return `${score}/${max}`;
}

function statusIcon(status: AssignmentStatus) {
  switch (status) {
    case 'OPEN':
      return <PlayCircle className="h-4 w-4" />;
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

function resourceIcon(type: 'lecture' | 'reading' | 'video') {
  switch (type) {
    case 'lecture':
      return <BookOpen className="h-4 w-4" />;
    case 'video':
      return <Video className="h-4 w-4" />;
    case 'reading':
      return <FileText className="h-4 w-4" />;
  }
}

export default function StudentWeekPage() {
  const params = useParams();
  const locale = params.locale as string;
  const courseId = params.courseId as string;
  const weekId = params.weekId as string;
  const studentPrefix = `/${locale}/s`;

  const course = getCourseOrFallback(courseId);
  const week = getWeek(weekId);
  const allWeeks = getWeeksForCourse(courseId);
  const assignments = week ? getAssignmentsForWeek(weekId) : [];

  if (!week) {
    return (
      <div className="space-y-6">
        <PageHeader
          backHref={`${studentPrefix}/courses/${courseId}`}
          title="Week not found"
          subtitle="This week doesn\u2019t exist on the course outline."
        />
      </div>
    );
  }

  const prevWeek = allWeeks.find((w) => w.number === week.number - 1) ?? null;
  const nextWeek = allWeeks.find((w) => w.number === week.number + 1) ?? null;

  const submittedCount = assignments.filter((a) =>
    ['SUBMITTED', 'WAITING_FOR_REVIEW', 'PROCESSING', 'READY_FOR_REVIEW', 'PUBLISHED'].includes(a.status),
  ).length;
  const publishedCount = assignments.filter((a) => a.status === 'PUBLISHED').length;
  const openCount = assignments.filter((a) => a.status === 'OPEN').length;
  const grades = assignments
    .filter((a) => a.status === 'PUBLISHED' && a.finalScore != null)
    .map((a) => (a.finalScore! / a.maxScore) * 100);
  const avg = grades.length ? Math.round(grades.reduce((s, g) => s + g, 0) / grades.length) : null;

  return (
    <div className="space-y-12">
      <PageHeader
        backHref={`${studentPrefix}/courses/${courseId}`}
        eyebrow={`${course.code} \u00b7 Week ${week.number}`}
        title={week.title}
        subtitle={course.title}
        gradient
        icon={<BookOpen />}
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 backdrop-blur-sm px-3 py-1.5 text-xs font-semibold text-white">
            <Sparkles className="h-3.5 w-3.5" /> {week.topic}
          </span>
        }
      />

      {/* Week summary */}
      <Card padding="lg">
        <p className="label-micro mb-2">Week overview</p>
        <p className="text-base leading-relaxed text-(--text-secondary)">{week.summary}</p>

        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Assignments" value={assignments.length.toString()} icon={<FileText />} />
          <StatCard label="Submitted" value={`${submittedCount}/${assignments.length}`} icon={<CheckCircle2 />} accent="#0d9488" />
          <StatCard label="Published" value={publishedCount.toString()} icon={<Eye />} accent="#16a34a" />
          <StatCard label="Avg grade" value={avg != null ? `${avg}` : '\u2014'} accent="#0891b2" />
        </div>
      </Card>

      {/* Resources */}
      {week.resources.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div className="space-y-1">
              <p className="label-micro">Materials for this week</p>
              <h2 className="text-xl font-bold tracking-tight text-(--text-primary)">Lectures &amp; readings</h2>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {week.resources.map((r, i) => (
              <Card key={i} padding="md" hover className="cursor-pointer">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-(--brand-subtle) text-(--brand)">
                    {resourceIcon(r.type)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium uppercase tracking-wider text-(--text-quaternary)">
                      {r.type}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-(--text-primary) truncate">{r.label}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Assignments */}
      <section className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <p className="label-micro">This week</p>
            <h2 className="text-xl font-bold tracking-tight text-(--text-primary)">
              {assignments.length === 1 ? 'Assignment' : 'Assignments'}
            </h2>
            <p className="text-sm text-(--text-tertiary)">
              {openCount > 0
                ? `${openCount} open for submission \u00b7 ${publishedCount} graded`
                : publishedCount > 0
                  ? `${publishedCount} graded`
                  : 'No active work this week.'}
            </p>
          </div>
        </div>

        {assignments.length === 0 ? (
          <Card padding="lg" className="text-center">
            <p className="text-sm text-(--text-tertiary)">No assignments are scheduled for this week.</p>
          </Card>
        ) : (
          <div className="grid gap-4">
            {assignments.map((a) => (
              <AssignmentRow key={a.id} a={a} studentPrefix={studentPrefix} />
            ))}
          </div>
        )}
      </section>

      {/* Footer nav */}
      {(prevWeek || nextWeek) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {prevWeek ? (
            <Link href={`${studentPrefix}/courses/${courseId}/weeks/${prevWeek.id}`}>
              <Card padding="md" hover className="flex items-center gap-4 cursor-pointer">
                <ChevronRight className="h-5 w-5 text-(--text-quaternary) rotate-180 rtl:rotate-0 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="label-micro">Previous</p>
                  <p className="mt-1 text-sm font-semibold text-(--text-primary) truncate">
                    Week {prevWeek.number} \u00b7 {prevWeek.title}
                  </p>
                </div>
              </Card>
            </Link>
          ) : (
            <span />
          )}
          {nextWeek ? (
            <Link href={`${studentPrefix}/courses/${courseId}/weeks/${nextWeek.id}`}>
              <Card padding="md" hover className="flex items-center gap-4 cursor-pointer">
                <div className="min-w-0 flex-1 text-right">
                  <p className="label-micro">Next</p>
                  <p className="mt-1 text-sm font-semibold text-(--text-primary) truncate">
                    Week {nextWeek.number} \u00b7 {nextWeek.title}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-(--text-quaternary) shrink-0 rtl:rotate-180" />
              </Card>
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}

function AssignmentRow({ a, studentPrefix }: { a: DemoAssignment; studentPrefix: string }) {
  const href =
    a.status === 'PUBLISHED'
      ? `${studentPrefix}/courses/${a.courseId}/assignments/${a.id}/result`
      : `${studentPrefix}/courses/${a.courseId}/assignments/${a.id}`;

  const isClosed = a.status === 'CLOSED';

  return (
    <Link href={href}>
      <Card
        padding="lg"
        hover
        className={cn('flex flex-col gap-4 cursor-pointer sm:flex-row sm:items-center', isClosed && 'opacity-70')}
      >
        <span
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl',
            a.status === 'PUBLISHED' && 'bg-(--success-subtle) text-(--success)',
            a.status === 'OPEN' && 'bg-(--brand-subtle) text-(--brand)',
            a.status === 'SUBMITTED' && 'bg-(--warning-subtle) text-(--warning)',
            (a.status === 'WAITING_FOR_REVIEW' || a.status === 'PROCESSING' || a.status === 'READY_FOR_REVIEW') &&
              'bg-(--info-subtle) text-(--info)',
            isClosed && 'bg-(--surface-secondary) text-(--text-quaternary)',
          )}
        >
          {statusIcon(a.status)}
        </span>

        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-base font-semibold text-(--text-primary) truncate">{a.title}</p>
          <p className="text-sm text-(--text-tertiary) line-clamp-2">{a.description}</p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <StatusBadge status={statusBadgeTone(a.status)} label={STATUS_LABEL[a.status]} size="sm" />
            <span className="inline-flex items-center gap-1.5 text-xs text-(--text-tertiary)">
              <Calendar className="h-3.5 w-3.5" /> Due {formatDate(a.deadline)}
            </span>
            {a.questions.length > 0 && (
              <span className="text-xs text-(--text-quaternary)">{a.questions.length} questions</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          {a.status === 'PUBLISHED' && a.finalScore != null && (
            <div className="text-right">
              <p className="text-2xl font-bold tabular-nums text-(--text-primary)">{formatGrade(a.finalScore, a.maxScore)}</p>
              <p className="text-xs text-(--text-tertiary)">Final grade</p>
            </div>
          )}
          <ChevronRight className="h-5 w-5 text-(--text-quaternary) rtl:rotate-180" />
        </div>
      </Card>
    </Link>
  );
}
