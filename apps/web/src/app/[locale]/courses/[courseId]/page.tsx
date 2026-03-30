'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Course, Lecture, RagManifest } from '@hg/shared-schemas';
import { CoursesClientError, getCourse, listLectures, getRagManifest, rebuildRagIndex } from '../../../../lib/coursesClient';
import { LectureUploadForm } from '../../../../components/courses/LectureUploadForm';
import { CourseAssignmentsPanel } from '../../../../components/courses/CourseAssignmentsPanel';
import { LecturesTable } from '../../../../components/courses/LecturesTable';
import { CourseMembershipPanel } from '../../../../components/courses/CourseMembershipPanel';
import { RagIndexPanel } from '../../../../components/courses/RagIndexPanel';
import { RagTestPanel } from '../../../../components/courses/RagTestPanel';
import { PageHeader } from '../../../../components/ui/page-header';
import { Alert, AlertDescription, AlertTitle } from '../../../../components/ui/alert';
import { Badge } from '../../../../components/ui/badge';
import { StatCard } from '../../../../components/ui/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Skeleton } from '../../../../components/ui/skeleton';
import { PageTransition, FadeIn, StaggerGroup, StaggerItem } from '../../../../components/ui/motion';
import { BookOpen, FileText, Database, Calendar } from 'lucide-react';

type CourseDetailsPageProps = {
  params: { courseId: string };
  canManageMemberships?: boolean;
};

const formatDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof CoursesClientError) {
    return error.code ? `${error.message} (${error.code})` : error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Failed to load course details.';
};

export default function CourseDetailsPage({ params, canManageMemberships = false }: CourseDetailsPageProps) {
  const [course, setCourse] = useState<Course | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [isLoadingLectures, setIsLoadingLectures] = useState(true);
  const [lecturesError, setLecturesError] = useState<string | null>(null);
  const [manifest, setManifest] = useState<RagManifest | null>(null);
  const [loadingManifest, setLoadingManifest] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [indexError, setIndexError] = useState<string | null>(null);

  const courseId = params.courseId;

  useEffect(() => {
    const loadCourse = async () => {
      setIsLoading(true);
      try { const data = await getCourse(courseId); setCourse(data); setError(null); }
      catch (err) { setError(getErrorMessage(err)); }
      finally { setIsLoading(false); }
    };
    const loadLectures = async () => {
      setIsLoadingLectures(true);
      try { const data = await listLectures(courseId); setLectures(data); setLecturesError(null); }
      catch (err) { setLecturesError(getErrorMessage(err)); }
      finally { setIsLoadingLectures(false); }
    };
    const loadManifest = async () => {
      setLoadingManifest(true);
      try { const data = await getRagManifest(courseId); setManifest(data); setIndexError(null); }
      catch (err) { setIndexError(getErrorMessage(err)); }
      finally { setLoadingManifest(false); }
    };
    loadCourse(); loadLectures(); loadManifest();
  }, [courseId]);

  const refreshLectures = async () => {
    setIsLoadingLectures(true);
    try { const data = await listLectures(courseId); setLectures(data); setLecturesError(null); }
    catch (err) { setLecturesError(getErrorMessage(err)); }
    finally { setIsLoadingLectures(false); }
  };

  const refreshManifest = async () => {
    setLoadingManifest(true);
    try { const data = await getRagManifest(courseId); setManifest(data); setIndexError(null); }
    catch (err) { setIndexError(getErrorMessage(err)); }
    finally { setLoadingManifest(false); }
  };

  const handleRebuild = async () => {
    setRebuilding(true);
    try { await rebuildRagIndex(courseId); await refreshManifest(); }
    catch (err) { setIndexError(getErrorMessage(err)); }
    finally { setRebuilding(false); }
  };

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          title={isLoading ? 'Loading...' : course?.title || 'Course'}
          description="Manage lectures, assignments, and content indexing."
          backHref="/courses"
          actions={course && <Badge variant="brand">{course.courseId}</Badge>}
        />

        {error && (
          <Alert variant="error">
            <AlertTitle>Could not load course</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Course Stats */}
        {course && (
          <StaggerGroup className="grid gap-4 sm:grid-cols-3">
            <StaggerItem>
              <StatCard label="Lectures" value={isLoadingLectures ? '...' : lectures.length} icon={<FileText />} />
            </StaggerItem>
            <StaggerItem>
              <StatCard label="Created" value={formatDate(course.createdAt)} icon={<Calendar />} />
            </StaggerItem>
            <StaggerItem>
              <StatCard label="RAG Index" value={loadingManifest ? '...' : manifest ? 'Ready' : 'Not built'} icon={<Database />} />
            </StaggerItem>
          </StaggerGroup>
        )}

        {/* Lecture Upload + Table */}
        <FadeIn delay={0.1}>
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] gap-6">
            <LectureUploadForm courseId={courseId} onUploaded={refreshLectures} />
            <LecturesTable lectures={lectures} loading={isLoadingLectures} error={lecturesError} />
          </div>
        </FadeIn>

        {/* Assignments */}
        <FadeIn delay={0.15}>
          <CourseAssignmentsPanel courseId={courseId} />
        </FadeIn>

        {/* RAG Index */}
        <FadeIn delay={0.2}>
          <RagIndexPanel
            courseId={courseId}
            manifest={manifest}
            loadingManifest={loadingManifest}
            rebuilding={rebuilding}
            error={indexError}
            onRebuild={handleRebuild}
            onRefresh={refreshManifest}
          />
        </FadeIn>

        {/* Membership */}
        {canManageMemberships && (
          <FadeIn delay={0.25}>
            <CourseMembershipPanel courseId={courseId} />
          </FadeIn>
        )}

        {/* RAG Test */}
        <FadeIn delay={0.3}>
          <RagTestPanel courseId={courseId} hasIndexHint={!manifest && !loadingManifest && !indexError} />
        </FadeIn>
      </div>
    </PageTransition>
  );
}
