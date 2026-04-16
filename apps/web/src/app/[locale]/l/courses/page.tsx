'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
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
  const params = useParams();
  const locale = params.locale as string;
  const lecturerPrefix = `/${locale}/l`;

  return (
    <div className="system-page-stack space-y-12">
      <PageHeader
        title="Courses"
        subtitle="Manage your courses, assignments, and exams."
        actions={
          <Link href={`${lecturerPrefix}/courses/create`}>
            <Button variant="primary" size="md" icon={<Plus />}>
              New Course
            </Button>
          </Link>
        }
      />

      {/* Course grid */}
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {mockCourses.map((course) => {
          const progress = Math.round((course.currentWeek / course.totalWeeks) * 100);

          return (
            <Link key={course.id} href={`${lecturerPrefix}/courses/${course.id}`} className="block h-full">
              <Card hover className="flex h-full flex-col p-8">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-lg font-semibold text-(--text-primary) truncate leading-snug">
                      {course.name}
                    </p>
                    <p className="mt-1.5 text-sm text-(--text-tertiary)">{course.code}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-(--text-quaternary) mt-1 rtl:rotate-180" />
                </div>

                {/* Stats row */}
                <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-(--text-tertiary)">
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    {course.students} students
                  </span>
                  <span className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Week {course.currentWeek}
                  </span>
                </div>

                {/* Progress */}
                <div className="mt-auto pt-8">
                  <div className="mb-2.5 flex items-center justify-between text-sm">
                    <span className="text-(--text-tertiary)">{course.assignments} assignments</span>
                    <span className="font-semibold tabular-nums text-(--text-secondary)">{progress}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-(--surface-secondary)">
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
