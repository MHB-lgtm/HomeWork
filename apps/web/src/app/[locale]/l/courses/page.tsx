'use client';

import Link from 'next/link';
import { Users, Clock, Plus, ChevronRight } from 'lucide-react';
import { cn } from '../../../../lib/utils';
import { PageHeader } from '../../../../components/ui/page-header';
import { Card } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';

/* ── Mock data ── */

type Course = {
  id: string;
  name: string;
  code: string;
  students: number;
  assignments: number;
  currentWeek: number;
  totalWeeks: number;
};

const mockCourses: Course[] = [
  { id: 'c1', name: 'Linear Algebra', code: 'MATH 2210', students: 45, assignments: 10, currentWeek: 5, totalWeeks: 14 },
  { id: 'c2', name: 'Calculus II', code: 'MATH 1220', students: 52, assignments: 12, currentWeek: 5, totalWeeks: 14 },
  { id: 'c3', name: 'Introduction to Physics', code: 'PHYS 1010', students: 30, assignments: 8, currentWeek: 4, totalWeeks: 13 },
];

export default function LecturerCoursesPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Courses">
        <Link href="/l/courses/create">
          <Button variant="primary" size="sm" icon={<Plus />}>
            New Course
          </Button>
        </Link>
      </PageHeader>

      {/* Course grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {mockCourses.map((course) => {
          const progress = Math.round((course.currentWeek / course.totalWeeks) * 100);

          return (
            <Link key={course.id} href={`/l/courses/${course.id}`} className="block">
              <Card hover className="p-5 h-full">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-(--text-primary) truncate">
                      {course.name}
                    </p>
                    <p className="mt-0.5 text-xs text-(--text-tertiary)">{course.code}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-(--text-quaternary) mt-0.5" />
                </div>

                {/* Stats row */}
                <div className="mt-4 flex items-center gap-4 text-xs text-(--text-tertiary)">
                  <span className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    {course.students} students
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Week {course.currentWeek}
                  </span>
                </div>

                {/* Progress */}
                <div className="mt-4">
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="text-(--text-tertiary)">{course.assignments} assignments</span>
                    <span className="font-medium tabular-nums text-(--text-secondary)">{progress}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-(--surface-secondary)">
                    <div
                      className="h-full rounded-full bg-(--brand) transition-all"
                      style={{ width: `${progress}%` }}
                    />
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
