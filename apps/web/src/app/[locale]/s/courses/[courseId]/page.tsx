'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronDown, ChevronRight, Clock,
  CheckCircle2, Lock, Send, FileText, Calendar,
  BookOpen, Target,
} from 'lucide-react';
import { cn } from '../../../../../lib/utils';
import { PageHeader } from '../../../../../components/ui/page-header';
import { Card } from '../../../../../components/ui/card';
import { StatCard } from '../../../../../components/ui/stat-card';
import { StatusBadge } from '../../../../../components/ui/status-badge';

/* ── Types ── */

type AssignmentStatus = 'open' | 'submitted' | 'graded' | 'locked';

type Assignment = {
  id: string;
  title: string;
  status: AssignmentStatus;
  deadline: string;
  grade?: number;
  maxGrade: number;
};

type Week = {
  number: number;
  title: string;
  assignments: Assignment[];
};

type CourseDetail = {
  id: string;
  name: string;
  lecturer: string;
  semester: string;
  totalAssignments: number;
  completedAssignments: number;
  averageGrade: number;
  weeks: Week[];
};

/* ── Mock data ── */

const coursesData: Record<string, CourseDetail> = {
  c1: {
    id: 'c1',
    name: 'Linear Algebra',
    lecturer: 'Prof. Cohen',
    semester: 'Spring 2026',
    totalAssignments: 10,
    completedAssignments: 6,
    averageGrade: 83,
    weeks: [
      {
        number: 1,
        title: 'Vectors and Vector Spaces',
        assignments: [
          { id: 'a1', title: 'Vector Operations and Span', status: 'graded', deadline: '2026-02-20', grade: 88, maxGrade: 100 },
        ],
      },
      {
        number: 2,
        title: 'Matrices and Systems of Equations',
        assignments: [
          { id: 'a2', title: 'Gaussian Elimination', status: 'graded', deadline: '2026-02-27', grade: 92, maxGrade: 100 },
          { id: 'a3', title: 'Matrix Algebra', status: 'graded', deadline: '2026-03-01', grade: 78, maxGrade: 100 },
        ],
      },
      {
        number: 3,
        title: 'Determinants',
        assignments: [
          { id: 'a4', title: 'Properties of Determinants', status: 'graded', deadline: '2026-03-06', grade: 85, maxGrade: 100 },
        ],
      },
      {
        number: 4,
        title: 'Eigenvalues and Eigenvectors',
        assignments: [
          { id: 'a5', title: 'Finding Eigenvalues', status: 'graded', deadline: '2026-03-13', grade: 70, maxGrade: 100 },
          { id: 'a6', title: 'Diagonalization', status: 'open', deadline: '2026-03-20', maxGrade: 100 },
        ],
      },
      {
        number: 5,
        title: 'Inner Product Spaces',
        assignments: [
          { id: 'a7', title: 'Orthogonality and Projections', status: 'open', deadline: '2026-04-02', maxGrade: 100 },
        ],
      },
      {
        number: 6,
        title: 'Singular Value Decomposition',
        assignments: [
          { id: 'a8', title: 'SVD Applications', status: 'locked', deadline: '2026-04-10', maxGrade: 100 },
          { id: 'a9', title: 'Principal Component Analysis', status: 'locked', deadline: '2026-04-14', maxGrade: 100 },
        ],
      },
    ],
  },
};

function getCourse(courseId: string): CourseDetail {
  return coursesData[courseId] ?? { ...coursesData['c1'], id: courseId };
}

/* ── Status mapping for StatusBadge ── */

const statusToBadge: Record<AssignmentStatus, string> = {
  open: 'active',
  submitted: 'pending',
  graded: 'done',
  locked: 'locked',
};

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
  const course = getCourse(courseId);
  const studentPrefix = `/${locale}/s`;

  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(() => {
    const open = new Set<number>();
    course.weeks.forEach((w) => {
      if (w.assignments.some((a) => a.status === 'open' || a.status === 'submitted')) {
        open.add(w.number);
      }
    });
    return open;
  });

  const toggleWeek = (weekNum: number) => {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(weekNum)) next.delete(weekNum);
      else next.add(weekNum);
      return next;
    });
  };

  function getHref(a: Assignment): string | null {
    if (a.status === 'locked') return null;
    if (a.status === 'graded') return `${studentPrefix}/courses/${courseId}/assignments/${a.id}/result`;
    return `${studentPrefix}/courses/${courseId}/assignments/${a.id}/workspace`;
  }

  return (
    <div className="system-page-stack space-y-12">
      <PageHeader
        backHref={`${studentPrefix}/courses`}
        title={course.name}
        subtitle={`${course.lecturer} \u00B7 ${course.semester}`}
        eyebrow="Course workspace"
        icon={<BookOpen />}
        gradient
      />

      {/* Progress overview */}
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
        <StatCard
          label="Completed"
          value={`${course.completedAssignments}/${course.totalAssignments}`}
          icon={<CheckCircle2 />}
          accent="#0d9488"
        />
        <StatCard
          label="Average Grade"
          value={course.averageGrade}
          icon={<FileText />}
          accent="#16a34a"
        />
        <StatCard
          label="Progress"
          value={`${Math.round((course.completedAssignments / course.totalAssignments) * 100)}%`}
          accent="#0891b2"
          className="col-span-2 sm:col-span-1"
        />
      </div>

      {/* Weekly sections */}
      <section className="system-section-stack space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="label-micro">Weekly path</p>
            <h2 className="text-2xl font-bold tracking-tight text-(--text-primary)">Course weeks</h2>
            <p className="max-w-2xl text-sm leading-relaxed text-(--text-tertiary)">
              Move through each week, review graded work, and jump back into open assignments without scanning a dense table.
            </p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-(--border) bg-(--surface) px-4 py-2 text-sm font-semibold text-(--text-secondary)">
            <Target className="h-4 w-4 text-(--brand)" />
            {Math.round((course.completedAssignments / course.totalAssignments) * 100)}% complete
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
        {course.weeks.map((week) => {
          const isExpanded = expandedWeeks.has(week.number);
          const allLocked = week.assignments.every((a) => a.status === 'locked');
          const gradedCount = week.assignments.filter((a) => a.status === 'graded').length;
          const openCount = week.assignments.filter((a) => a.status === 'open' || a.status === 'submitted').length;

          return (
            <Card
              key={week.number}
              padding="none"
              className={cn('overflow-hidden rounded-3xl', allLocked && 'opacity-60')}
            >
              {/* Week header */}
              <button
                onClick={() => toggleWeek(week.number)}
                className="flex w-full items-start gap-5 px-7 py-7 text-start transition-colors hover:bg-(--surface-hover)"
              >
                <span
                  className={cn(
                    'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-base font-bold',
                    allLocked
                      ? 'bg-(--surface-secondary) text-(--text-quaternary)'
                      : 'bg-(--brand-subtle) text-(--brand)',
                  )}
                >
                  {week.number}
                </span>
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--text-quaternary)">
                      Week {week.number}
                    </p>
                    <p className="text-lg font-bold leading-snug text-(--text-primary)">{week.title}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-(--surface-secondary) px-3 py-1 text-xs font-semibold text-(--text-secondary)">
                      {week.assignments.length} assignments
                    </span>
                    {gradedCount > 0 && (
                      <span className="rounded-full bg-(--success-subtle) px-3 py-1 text-xs font-semibold text-(--success)">
                        {gradedCount} graded
                      </span>
                    )}
                    {openCount > 0 && (
                      <span className="rounded-full bg-(--brand-subtle) px-3 py-1 text-xs font-semibold text-(--brand)">
                        {openCount} active
                      </span>
                    )}
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronDown className="h-5 w-5 text-(--text-quaternary)" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-(--text-quaternary) rtl:rotate-180" />
                )}
              </button>

              {/* Assignments */}
              {isExpanded && (
                <div className="border-t border-(--border-light) bg-(--surface-secondary)/35 px-5 py-5">
                  <div className="grid gap-4">
                  {week.assignments.map((assignment) => {
                    const href = getHref(assignment);
                    const deadlineFormatted = new Date(assignment.deadline).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    });

                    const row = (
                      <div
                        className={cn(
                          'flex items-center gap-4 rounded-2xl border border-(--border-light) bg-(--surface) px-5 py-5 shadow-sm transition-all',
                          href && 'hover:border-(--border-hover) hover:shadow-md cursor-pointer',
                          !href && 'cursor-default',
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                            assignment.status === 'locked'
                              ? 'bg-(--surface-secondary) text-(--text-quaternary)'
                              : 'bg-(--brand-50) text-(--brand)'
                          )}
                        >
                          {assignment.status === 'locked' ? <Lock className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                        </span>

                        <div className="min-w-0 flex-1 space-y-1">
                          <p className={cn('text-sm font-medium', assignment.status === 'locked' ? 'text-(--text-quaternary)' : 'text-(--text-primary)')}>
                            {assignment.title}
                          </p>
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-(--text-tertiary)">
                            <Calendar className="h-3.5 w-3.5" />
                            Due {deadlineFormatted}
                          </span>
                        </div>

                        {/* Deadline */}
                        {assignment.status === 'graded' && assignment.grade != null && (
                          <span className={cn('hidden text-sm font-semibold tabular-nums sm:inline', gradeColor(assignment.grade))}>
                            {assignment.grade}/{assignment.maxGrade}
                          </span>
                        )}

                        {/* Status */}
                        <StatusBadge status={statusToBadge[assignment.status]} size="sm" />

                        {/* Chevron for clickable rows */}
                        {href && <ChevronRight className="h-4 w-4 text-(--text-quaternary) rtl:rotate-180" />}
                      </div>
                    );

                    if (href) {
                      return <Link key={assignment.id} href={href}>{row}</Link>;
                    }
                    return <div key={assignment.id}>{row}</div>;
                  })}
                  </div>
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
