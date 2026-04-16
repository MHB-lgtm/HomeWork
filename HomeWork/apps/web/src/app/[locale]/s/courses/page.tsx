'use client';

import Link from 'next/link';
import { ChevronRight, Calendar } from 'lucide-react';
import { cn } from '../../../../lib/utils';
import { PageHeader } from '../../../../components/ui/page-header';
import { Card } from '../../../../components/ui/card';
import { Badge } from '../../../../components/ui/badge';

/* ── Mock data ── */

type Course = {
  id: string;
  name: string;
  semester: string;
  completedAssignments: number;
  totalAssignments: number;
  nextDeadline: string;
  nextAssignment: string;
};

const courses: Course[] = [
  { id: 'c1', name: 'Linear Algebra', semester: 'Spring 2026', completedAssignments: 6, totalAssignments: 10, nextDeadline: '2026-04-02', nextAssignment: 'Orthogonality and Projections' },
  { id: 'c2', name: 'Calculus II', semester: 'Spring 2026', completedAssignments: 8, totalAssignments: 12, nextDeadline: '2026-04-03', nextAssignment: 'Series Convergence Tests' },
  { id: 'c3', name: 'Introduction to Physics', semester: 'Spring 2026', completedAssignments: 4, totalAssignments: 8, nextDeadline: '2026-04-01', nextAssignment: 'Work and Energy Problems' },
  { id: 'c4', name: 'Discrete Mathematics', semester: 'Spring 2026', completedAssignments: 3, totalAssignments: 9, nextDeadline: '2026-04-04', nextAssignment: 'Graph Theory Proofs' },
];

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
  return (
    <div className="space-y-8">
      <PageHeader title="My Courses" />

      {/* Course grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {courses.map((course) => {
          const progress = Math.round((course.completedAssignments / course.totalAssignments) * 100);
          const urgency = deadlineUrgency(course.nextDeadline);

          return (
            <Link key={course.id} href={`/s/courses/${course.id}`} className="block">
              <Card hover className="p-5 h-full">
                {/* Title + semester */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-(--text-primary) truncate">
                      {course.name}
                    </p>
                  </div>
                  <Badge variant="brand" size="sm">{course.semester}</Badge>
                </div>

                {/* Progress bar */}
                <div className="mt-4">
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="text-(--text-tertiary)">
                      {course.completedAssignments}/{course.totalAssignments} completed
                    </span>
                    <span className="font-medium tabular-nums text-(--text-secondary)">{progress}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-(--surface-secondary)">
                    <div
                      className="h-full rounded-full bg-(--brand) transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* Next deadline */}
                <div className="mt-4 flex items-center justify-between rounded-lg bg-(--surface-secondary) px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-(--text-quaternary)">
                      Next due
                    </p>
                    <p className="mt-0.5 truncate text-sm font-medium text-(--text-primary)">
                      {course.nextAssignment}
                    </p>
                  </div>
                  <div className="ml-3 flex items-center gap-1.5">
                    <Calendar className="h-3 w-3 text-(--text-quaternary)" />
                    <span
                      className={cn(
                        'text-xs font-medium tabular-nums',
                        urgency === 'error' && 'text-(--error)',
                        urgency === 'warning' && 'text-(--warning)',
                        urgency === 'default' && 'text-(--text-tertiary)',
                      )}
                    >
                      {formatDeadline(course.nextDeadline)}
                    </span>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
