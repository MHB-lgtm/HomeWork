'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronDown, ChevronRight, Lock, FileText, Calendar,
  BookOpen, Target, CheckCircle2, Clock, Cpu, Eye, PlayCircle,
} from 'lucide-react';
import { cn } from '../../../../../lib/utils';
import { PageHeader } from '../../../../../components/ui/page-header';
import { Card } from '../../../../../components/ui/card';
import { StatCard } from '../../../../../components/ui/stat-card';
import { StatusBadge } from '../../../../../components/ui/status-badge';
import {
  getAssignmentsForCourse,
  getAssignmentsForWeek,
  getCourseOrFallback,
  getCourseProgress,
  getWeeksForCourse,
  STATUS_LABEL,
  statusBadgeTone,
  studentAssignmentHref,
  type AssignmentStatus,
  type DemoAssignment,
} from '../../../../../lib/demoSeed';

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

function gradeColor(grade: number): string {
  if (grade >= 90) return 'text-(--success)';
  if (grade >= 80) return 'text-(--brand)';
  if (grade >= 70) return 'text-(--warning)';
  return 'text-(--error)';
}

export default function StudentCourseDetailPage() {
  const params = useParams();
  const locale = params.locale as string;
  const courseId = params.courseId as string;
  const studentPrefix = `/${locale}/s`;
  const localePrefix = `/${locale}`;

  const course = getCourseOrFallback(courseId);
  const weeks = getWeeksForCourse(course.id);
  const allAssignments = getAssignmentsForCourse(course.id);
  const progress = getCourseProgress(course.id);
  const completion = progress.total ? Math.round((progress.published / progress.total) * 100) : 0;

  const currentWeek = weeks.find((w) =>
    getAssignmentsForWeek(w.id).some((a) => a.status === 'OPEN' || a.status === 'SUBMITTED'),
  );

  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(() => {
    const open = new Set<string>();
    weeks.forEach((w) => {
      const wa = getAssignmentsForWeek(w.id);
      if (wa.some((a) => ['OPEN', 'SUBMITTED', 'WAITING_FOR_REVIEW', 'PROCESSING', 'READY_FOR_REVIEW'].includes(a.status))) {
        open.add(w.id);
      }
    });
    return open;
  });

  const toggleWeek = (id: string) => {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-12">
      <PageHeader
        backHref={`${studentPrefix}/courses`}
        title={course.title}
        subtitle={`${course.lecturer} \u00b7 ${course.semester}`}
        eyebrow={course.code}
        icon={<BookOpen />}
        gradient
      />

      {/* Progress overview */}
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        <StatCard
          label="Graded"
          value={`${progress.published}/${progress.total}`}
          icon={<CheckCircle2 />}
          accent="#0d9488"
        />
        <StatCard label="Average grade" value={progress.averageGrade || '\u2014'} icon={<FileText />} accent="#16a34a" />
        <StatCard label="Progress" value={`${completion}%`} accent="#0891b2" />
        <StatCard
          label="Open"
          value={allAssignments.filter((a) => a.status === 'OPEN' || a.status === 'SUBMITTED').length}
          icon={<PlayCircle />}
          accent="#9333ea"
        />
      </div>

      {/* Weekly sections */}
      <section className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="label-micro">Weekly path</p>
            <h2 className="text-2xl font-bold tracking-tight text-(--text-primary)">Course weeks</h2>
            <p className="max-w-2xl text-sm leading-relaxed text-(--text-tertiary)">
              Follow the weekly outline. Click a week to dive into materials and assignments.
            </p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-(--border) bg-(--surface) px-4 py-2 text-sm font-semibold text-(--text-secondary)">
            <Target className="h-4 w-4 text-(--brand)" />
            {completion}% complete
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          {weeks.map((week) => {
            const wa = getAssignmentsForWeek(week.id);
            const isExpanded = expandedWeeks.has(week.id);
            const allClosed = wa.length > 0 && wa.every((a) => a.status === 'CLOSED');
            const gradedCount = wa.filter((a) => a.status === 'PUBLISHED').length;
            const activeCount = wa.filter((a) =>
              ['OPEN', 'SUBMITTED', 'WAITING_FOR_REVIEW', 'PROCESSING', 'READY_FOR_REVIEW'].includes(a.status),
            ).length;
            const isCurrent = currentWeek?.id === week.id;

            return (
              <Card
                key={week.id}
                padding="none"
                className={cn(
                  'overflow-hidden rounded-3xl transition-all',
                  allClosed && 'opacity-70',
                  isCurrent && 'ring-2 ring-(--brand)/30',
                )}
              >
                <button
                  onClick={() => toggleWeek(week.id)}
                  className="flex w-full items-start gap-5 px-7 py-7 text-start transition-colors hover:bg-(--surface-hover)"
                >
                  <span
                    className={cn(
                      'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-base font-bold',
                      allClosed
                        ? 'bg-(--surface-secondary) text-(--text-quaternary)'
                        : isCurrent
                          ? 'bg-(--brand) text-white shadow-md'
                          : 'bg-(--brand-subtle) text-(--brand)',
                    )}
                  >
                    {week.number}
                  </span>
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--text-quaternary)">
                        Week {week.number}
                        {isCurrent && <span className="ms-2 text-(--brand)">\u00b7 current</span>}
                      </p>
                      <p className="text-lg font-bold leading-snug text-(--text-primary)">{week.title}</p>
                      <p className="text-sm text-(--text-tertiary) line-clamp-2">{week.summary}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-(--surface-secondary) px-3 py-1 text-xs font-semibold text-(--text-secondary)">
                        {wa.length} {wa.length === 1 ? 'assignment' : 'assignments'}
                      </span>
                      {gradedCount > 0 && (
                        <span className="rounded-full bg-(--success-subtle) px-3 py-1 text-xs font-semibold text-(--success)">
                          {gradedCount} graded
                        </span>
                      )}
                      {activeCount > 0 && (
                        <span className="rounded-full bg-(--brand-subtle) px-3 py-1 text-xs font-semibold text-(--brand)">
                          {activeCount} active
                        </span>
                      )}
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="h-5 w-5 text-(--text-quaternary) shrink-0" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-(--text-quaternary) rtl:rotate-180 shrink-0" />
                  )}
                </button>

                {isExpanded && (
                  <div className="border-t border-(--border-light) bg-(--surface-secondary)/35 px-5 py-5">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <p className="label-micro">Assignments</p>
                      <Link
                        href={`${studentPrefix}/courses/${course.id}/weeks/${week.id}`}
                        className="text-xs font-semibold text-(--brand) hover:underline"
                      >
                        Open week
                      </Link>
                    </div>
                    {wa.length === 0 ? (
                      <p className="px-2 py-4 text-sm text-(--text-tertiary)">No assignments scheduled this week.</p>
                    ) : (
                      <div className="grid gap-4">
                        {wa.map((a) => (
                          <AssignmentRow key={a.id} a={a} localePrefix={localePrefix} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function AssignmentRow({ a, localePrefix }: { a: DemoAssignment; localePrefix: string }) {
  const href = studentAssignmentHref(localePrefix, a) ?? '#';
  const deadlineFormatted = new Date(a.deadline).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  const row = (
    <div
      className={cn(
        'flex items-center gap-4 rounded-2xl border border-(--border-light) bg-(--surface) px-5 py-5 shadow-sm transition-all',
        href !== '#' && 'hover:border-(--border-hover) hover:shadow-md cursor-pointer',
        a.status === 'CLOSED' && 'opacity-70',
      )}
    >
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
          a.status === 'CLOSED'
            ? 'bg-(--surface-secondary) text-(--text-quaternary)'
            : a.status === 'PUBLISHED'
              ? 'bg-(--success-subtle) text-(--success)'
              : 'bg-(--brand-50) text-(--brand)',
        )}
      >
        {statusIcon(a.status)}
      </span>

      <div className="min-w-0 flex-1 space-y-1">
        <p
          className={cn(
            'text-sm font-medium',
            a.status === 'CLOSED' ? 'text-(--text-quaternary)' : 'text-(--text-primary)',
          )}
        >
          {a.title}
        </p>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-(--text-tertiary)">
          <Calendar className="h-3.5 w-3.5" />
          Due {deadlineFormatted}
        </span>
      </div>

      {a.status === 'PUBLISHED' && a.finalScore != null && (
        <span
          className={cn(
            'hidden text-sm font-semibold tabular-nums sm:inline',
            gradeColor(Math.round((a.finalScore / a.maxScore) * 100)),
          )}
        >
          {a.finalScore}/{a.maxScore}
        </span>
      )}

      <StatusBadge status={statusBadgeTone(a.status)} label={STATUS_LABEL[a.status]} size="sm" />
      {href !== '#' && <ChevronRight className="h-4 w-4 text-(--text-quaternary) rtl:rotate-180" />}
    </div>
  );

  if (href === '#') return <div>{row}</div>;
  return <Link href={href}>{row}</Link>;
}
