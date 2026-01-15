'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Course, Lecture, RagManifest } from '@hg/shared-schemas';
import { CoursesClientError, getCourse, listLectures, getRagManifest, rebuildRagIndex } from '../../../lib/coursesClient';
import { LectureUploadForm } from '../../../components/courses/LectureUploadForm';
import { LecturesTable } from '../../../components/courses/LecturesTable';
import { RagIndexPanel } from '../../../components/courses/RagIndexPanel';
import { RagTestPanel } from '../../../components/courses/RagTestPanel';
import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';

type CourseDetailsPageProps = {
  params: { courseId: string };
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
  if (error instanceof Error) {
    return error.message;
  }
  return 'Failed to load course details.';
};

export default function CourseDetailsPage({ params }: CourseDetailsPageProps) {
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
      try {
        const data = await getCourse(courseId);
        setCourse(data);
        setError(null);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    };

    const loadLectures = async () => {
      setIsLoadingLectures(true);
      try {
        const data = await listLectures(courseId);
        setLectures(data);
        setLecturesError(null);
      } catch (err) {
        setLecturesError(getErrorMessage(err));
      } finally {
        setIsLoadingLectures(false);
      }
    };

    const loadManifest = async () => {
      setLoadingManifest(true);
      try {
        const data = await getRagManifest(courseId);
        setManifest(data);
        setIndexError(null);
      } catch (err) {
        setIndexError(getErrorMessage(err));
      } finally {
        setLoadingManifest(false);
      }
    };

    loadCourse();
    loadLectures();
    loadManifest();
  }, [courseId]);

  const refreshLectures = async () => {
    setIsLoadingLectures(true);
    try {
      const data = await listLectures(courseId);
      setLectures(data);
      setLecturesError(null);
    } catch (err) {
      setLecturesError(getErrorMessage(err));
    } finally {
      setIsLoadingLectures(false);
    }
  };

  const refreshManifest = async () => {
    setLoadingManifest(true);
    try {
      const data = await getRagManifest(courseId);
      setManifest(data);
      setIndexError(null);
    } catch (err) {
      setIndexError(getErrorMessage(err));
    } finally {
      setLoadingManifest(false);
    }
  };

  const handleRebuild = async () => {
    setRebuilding(true);
    try {
      await rebuildRagIndex(courseId);
      await refreshManifest();
    } catch (err) {
      setIndexError(getErrorMessage(err));
    } finally {
      setRebuilding(false);
    }
  };

  return (
    <main className="min-h-screen review-page-bg text-slate-900">
      <div className="max-w-4xl mx-auto px-4 py-8 md:py-12 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-[0.24em] text-slate-500 uppercase">
              Course Details
            </p>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Course Overview</h1>
            <p className="text-slate-600">Manage lectures and prepare the course content for indexing.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/courses">
              <Button variant="outline" size="sm">
                Back to Courses
              </Button>
            </Link>
            <Link href="/">
              <Button size="sm">Home</Button>
            </Link>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Could not load course</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card className="rounded-3xl border-slate-200/80 bg-white/90 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-lg font-semibold text-slate-900">Course Info</CardTitle>
              {course && <Badge variant="secondary">{course.courseId}</Badge>}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="text-sm text-slate-600">Loading course details...</div>
            ) : course ? (
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-slate-500">Title</p>
                  <p className="text-lg font-semibold text-slate-900">{course.title}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-slate-600">
                  <div>
                    <p className="text-slate-500">Created</p>
                    <p>{formatDate(course.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Updated</p>
                    <p>{formatDate(course.updatedAt)}</p>
                  </div>
                </div>
              </div>
            ) : error ? null : (
              <div className="text-sm text-slate-600">Course not found.</div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] gap-6">
          <LectureUploadForm courseId={courseId} onUploaded={refreshLectures} />
          <LecturesTable lectures={lectures} loading={isLoadingLectures} error={lecturesError} />
        </div>

        <div id="rag-index-panel">
          <RagIndexPanel
            courseId={courseId}
            manifest={manifest}
            loadingManifest={loadingManifest}
            rebuilding={rebuilding}
            error={indexError}
            onRebuild={handleRebuild}
            onRefresh={refreshManifest}
          />
        </div>

        <RagTestPanel courseId={courseId} hasIndexHint={!manifest && !loadingManifest && !indexError} />

        <Card className="rounded-3xl border-slate-200/80 bg-white/90 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold text-slate-900">Coming next</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600">
            <p>- Explore query and suggest tools</p>
            <p>- Review study pointer coverage</p>
            <p>- Share links with students</p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
