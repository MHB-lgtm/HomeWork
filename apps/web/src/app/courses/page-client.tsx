'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Course } from '@hg/shared-schemas';
import { CoursesClientError, listCourses } from '../../lib/coursesClient';
import { CreateCourseCard } from '../../components/courses/CreateCourseCard';
import { CoursesTable } from '../../components/courses/CoursesTable';
import { ImmersiveShell } from '../../components/layout/ImmersiveShell';
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

type CoursesPageProps = {
  canCreateCourses?: boolean;
};

export default function CoursesPage({ canCreateCourses = false }: CoursesPageProps) {
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
    <ImmersiveShell>
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <section className="flex w-full flex-col items-center gap-4 text-center">
          <h1 className="font-heading text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">Courses</h1>
          <p className="mx-auto max-w-2xl text-base text-slate-700 md:text-xl">
            Create a course and collect lecture content for study pointers.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Badge variant="secondary">{courses.length} courses</Badge>
            <Badge variant="outline">API ready</Badge>
          </div>
          <div>
            <Link href="/">
              <Button variant="outline" size="sm">
                Back to Home
              </Button>
            </Link>
          </div>
        </section>

        <div
          className={
            canCreateCourses
              ? 'grid grid-cols-1 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] gap-6'
              : 'space-y-4'
          }
        >
          {canCreateCourses ? <CreateCourseCard onCreated={loadCourses} /> : null}

          <div className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertTitle>Could not load courses</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {!canCreateCourses ? (
              <Alert>
                <AlertTitle>Course creation is restricted</AlertTitle>
                <AlertDescription>Only super admins can create new courses.</AlertDescription>
              </Alert>
            ) : null}
            <CoursesTable courses={courses} isLoading={isLoading} onRefresh={loadCourses} />
          </div>
        </div>
      </div>
    </ImmersiveShell>
  );
}
