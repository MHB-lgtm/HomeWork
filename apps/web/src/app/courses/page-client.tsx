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
import { PageHeader } from '../../components/ui/page-header';

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
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <PageHeader
        title="Courses"
        description="Create a course, manage lecture content, and keep course-backed operations grounded in real staff memberships."
        badges={
          <>
            <Badge variant="secondary">{courses.length} courses</Badge>
            <Badge variant="outline">API ready</Badge>
          </>
        }
        actions={
          <Link href="/">
            <Button variant="outline" size="sm">
              Back to Dashboard
            </Button>
          </Link>
        }
      />

      <div
        className={
          canCreateCourses
            ? 'grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]'
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
  );
}
