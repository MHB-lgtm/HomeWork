'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Course } from '@hg/shared-schemas';
import { CoursesClientError, listCourses } from '../../lib/coursesClient';
import { CreateCourseCard } from '../../components/courses/CreateCourseCard';
import { CoursesTable } from '../../components/courses/CoursesTable';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';

const getErrorMessage = (error: unknown) => {
  if (error instanceof CoursesClientError) {
    return error.code ? `${error.message} (${error.code})` : error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Failed to load courses.';
};

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCourses = async () => {
    setIsLoading(true);
    try {
      const data = await listCourses();
      setCourses(data);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
  }, []);

  return (
    <main className="min-h-screen review-page-bg text-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-8 md:py-12 space-y-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <Link href="/" className="text-slate-600 hover:text-slate-900">
              Home
            </Link>
            <span>/</span>
            <Link href="/exams" className="text-slate-600 hover:text-slate-900">
              Exams
            </Link>
            <span>/</span>
            <Link href="/rubrics" className="text-slate-600 hover:text-slate-900">
              Rubrics
            </Link>
            <span>/</span>
            <Link href="/reviews" className="text-slate-600 hover:text-slate-900">
              Reviews
            </Link>
            <span>/</span>
            <span className="font-semibold text-slate-900">Courses</span>
          </div>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold tracking-[0.24em] text-slate-500 uppercase">
                Course Assistant
              </p>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Courses</h1>
              <p className="text-slate-600">
                Create a course and start collecting lecture content for study pointers.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{courses.length} courses</Badge>
                <Badge variant="outline">API ready</Badge>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/">
                <Button variant="outline" size="sm">
                  Back to Home
                </Button>
              </Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] gap-6">
          <CreateCourseCard onCreated={loadCourses} />

          <div className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertTitle>Could not load courses</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <CoursesTable courses={courses} isLoading={isLoading} onRefresh={loadCourses} />
          </div>
        </div>
      </div>
    </main>
  );
}
