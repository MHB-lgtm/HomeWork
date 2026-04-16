'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Course } from '@hg/shared-schemas';
import { CoursesClientError, listCourses } from '../../../lib/coursesClient';
import { CreateCourseCard } from '../../../components/courses/CreateCourseCard';
import { CoursesTable } from '../../../components/courses/CoursesTable';
import { PageHeader } from '../../../components/ui/page-header';
import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { StatCard } from '../../../components/ui/stat-card';
import { PageTransition, FadeIn, StaggerGroup, StaggerItem } from '../../../components/ui/motion';
import { BookOpen, Plus } from 'lucide-react';

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
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          title="Courses"
          description="Create and manage course content for lecture-based grading."
          actions={
            <Badge variant="brand">{courses.length} courses</Badge>
          }
        />

        {error && (
          <Alert variant="error">
            <AlertTitle>Could not load courses</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!canCreateCourses && (
          <Alert variant="info">
            <AlertTitle>Course creation is restricted</AlertTitle>
            <AlertDescription>Only super admins can create new courses.</AlertDescription>
          </Alert>
        )}

        <FadeIn delay={0.1}>
          <div
            className={
              canCreateCourses
                ? 'grid grid-cols-1 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] gap-6'
                : 'space-y-4'
            }
          >
            {canCreateCourses && <CreateCourseCard onCreated={loadCourses} />}
            <CoursesTable courses={courses} isLoading={isLoading} onRefresh={loadCourses} />
          </div>
        </FadeIn>
      </div>
    </PageTransition>
  );
}
