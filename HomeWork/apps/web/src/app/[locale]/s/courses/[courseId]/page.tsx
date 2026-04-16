'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronDown, ChevronRight, Clock,
  CheckCircle2, Lock, Send, FileText, Calendar,
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
  const courseId = params.courseId as string;
  const course = getCourse(courseId);

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
    if (a.status === 'graded') return `/s/courses/${courseId}/assignments/${a.id}/result`;
    return `/s/courses/${courseId}/assignments/${a.id}/workspace`;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        backHref="/s/courses"
        title={course.name}
        subtitle={`${course.lecturer} \u00B7 ${course.semester}`}
      />

      {/* Progress overview */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard
          label="Completed"
          value={`${course.completedAssignments}/${course.totalAssignments}`}
          icon={<CheckCircle2 />}
        />
        <StatCard
          label="Average Grade"
          value={course.averageGrade}
          icon={<FileText />}
        />
        <StatCard
          label="Progress"
          value={`${Math.round((course.completedAssignments / course.totalAssignments) * 100)}%`}
          className="col-span-2 sm:col-span-1"
        />
      </div>

      {/* Weekly sections */}
      <div className="space-y-3">
        {course.weeks.map((week) => {
          const isExpanded = expandedWeeks.has(week.number);
          const allLocked = week.assignments.every((a) => a.status === 'locked');

          return (
            <Card
              key={week.number}
              padding="none"
              className={cn('overflow-hidden', allLocked && 'opacity-50')}
            >
              {/* Week header */}
              <button
                onClick={() => toggleWeek(week.number)}
                className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-(--surface-hover)"
              >
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold',
                    allLocked
                      ? 'bg-(--surface-secondary) text-(--text-quaternary)'
                      : 'bg-(--brand-subtle) text-(--brand)',
                  )}
                >
                  {week.number}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-(--text-primary)">Week {week.number}</p>
                  <p className="text-xs text-(--text-tertiary)">{week.title}</p>
                </div>
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-(--text-quaternary)" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-(--text-quaternary)" />
                )}
              </button>

              {/* Assignments */}
              {isExpanded && (
                <div className="border-t border-(--border-light) divide-y divide-(--border-light)">
                  {week.assignments.map((assignment) => {
                    const href = getHref(assignment);
                    const deadlineFormatted = new Date(assignment.deadline).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    });

                    const row = (
                      <div
                        className={cn(
                          'flex items-center gap-3 px-5 py-3 transition-colors',
                          href && 'hover:bg-(--surface-hover) cursor-pointer',
                          !href && 'cursor-default',
                        )}
                      >
                        <FileText className={cn('h-4 w-4 shrink-0', assignment.status === 'locked' ? 'text-(--text-quaternary)' : 'text-(--text-tertiary)')} />

                        <div className="min-w-0 flex-1">
                          <p className={cn('text-sm font-medium', assignment.status === 'locked' ? 'text-(--text-quaternary)' : 'text-(--text-primary)')}>
                            {assignment.title}
                          </p>
                        </div>

                        {/* Deadline */}
                        <span className="hidden items-center gap-1 text-xs text-(--text-quaternary) sm:flex">
                          <Calendar className="h-3 w-3" />
                          {deadlineFormatted}
                        </span>

                        {/* Grade */}
                        {assignment.status === 'graded' && assignment.grade != null && (
                          <span className={cn('text-sm font-semibold tabular-nums', gradeColor(assignment.grade))}>
                            {assignment.grade}/{assignment.maxGrade}
                          </span>
                        )}

                        {/* Status */}
                        <StatusBadge status={statusToBadge[assignment.status]} size="sm" />

                        {/* Chevron for clickable rows */}
                        {href && <ChevronRight className="h-3.5 w-3.5 text-(--text-quaternary)" />}
                      </div>
                    );

                    if (href) {
                      return <Link key={assignment.id} href={href}>{row}</Link>;
                    }
                    return <div key={assignment.id}>{row}</div>;
                  })}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
