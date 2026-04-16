'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ChevronRight, Calendar, BookOpen } from 'lucide-react';
import { cn } from '../../../../lib/utils';
import { PageHeader } from '../../../../components/ui/page-header';
import { Card } from '../../../../components/ui/card';
import { Badge } from '../../../../components/ui/badge';
import {
  DEMO_COURSES,
  DEMO_STUDENT,
  getAssignmentsForCourse,
  getCourseProgress,
} from '../../../../lib/demoSeed';

function formatDeadline(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'Overdue';
  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  if (diffDays <= 7) return `${diffDays} days left`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function deadlineUrgency(dateStr: string): 'error' | 'warning' | 'default' {
  const diffDays = Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'error';
  if (diffDays <= 2) return 'warning';
  return 'default';
}

export default function StudentCoursesPage() {
  const params = useParams();
  const locale = params.locale as string;
  const studentPrefix = `/${locale}/s`;

  const enrolled = DEMO_COURSES.filter((c) => DEMO_STUDENT.enrolledCourseIds.includes(c.id));

  return (
    <div className="space-y-12">
      <PageHeader
        eyebrow="Spring 2026"
        title="My courses"
        subtitle="Your enrolled courses for the current semester."
        icon={<BookOpen />}
      />

      <div className="grid gap-6 sm:grid-cols-2">
        {enrolled.map((course) => {
          const progress = getCourseProgress(course.id);
          const completion = progress.total ? Math.round((progress.published / progress.total) * 100) : 0;
          const assignments = getAssignmentsForCourse(course.id);
          const next = assignments
            .filter((a) => a.status === 'OPEN' || a.status === 'SUBMITTED')
            .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())[0];
          const urgency = next ? deadlineUrgency(next.deadline) : 'default';

          return (
            <Link key={course.id} href={`${studentPrefix}/courses/${course.id}`} className="block h-full">
              <Card hover className="flex h-full flex-col px-8 py-9 cursor-pointer">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-(--text-quaternary)">
                      {course.code}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-(--text-primary) truncate leading-snug">
                      {course.title}
                    </p>
                    <p className="mt-0.5 text-xs text-(--text-tertiary) truncate">{course.lecturer}</p>
                  </div>
                  <Badge variant="brand" size="sm">
                    {course.semester}
                  </Badge>
                </div>

                <div className="mt-8">
                  <div className="mb-2.5 flex items-center justify-between text-sm">
                    <span className="text-(--text-tertiary)">
                      {progress.published}/{progress.total} graded
                    </span>
                    <span className="font-semibold tabular-nums text-(--text-secondary)">{completion}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-(--surface-secondary)">
                    <div
                      className="h-full rounded-full bg-(--brand) transition-all duration-700"
                      style={{ width: `${completion}%` }}
                    />
                  </div>
                  {progress.averageGrade > 0 && (
                    <p className="mt-3 text-xs text-(--text-tertiary)">
                      Average grade so far: <span className="font-semibold text-(--text-primary) tabular-nums">{progress.averageGrade}</span>
                    </p>
                  )}
                </div>

                <div className="mt-auto flex items-center justify-between rounded-2xl bg-(--surface-secondary) px-5 py-5 pt-6">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-(--text-quaternary)">
                      {next ? 'Next due' : 'No open work'}
                    </p>
                    <p className="mt-1.5 truncate text-sm font-medium text-(--text-primary)">
                      {next ? next.title : 'You\u2019re all caught up'}
                    </p>
                  </div>
                  {next && (
                    <div className="ms-4 flex items-center gap-1.5 shrink-0">
                      <Calendar className="h-4 w-4 text-(--text-quaternary)" />
                      <span
                        className={cn(
                          'text-sm font-semibold tabular-nums',
                          urgency === 'error' && 'text-(--error)',
                          urgency === 'warning' && 'text-(--warning)',
                          urgency === 'default' && 'text-(--text-tertiary)',
                        )}
                      >
                        {formatDeadline(next.deadline)}
                      </span>
                    </div>
                  )}
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
