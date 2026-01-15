'use client';

import { useState } from 'react';
import { createCourse, CoursesClientError } from '../../lib/coursesClient';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Input } from '../ui/input';

type CreateCourseCardProps = {
  onCreated?: (courseId: string) => void;
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof CoursesClientError) {
    return error.code ? `${error.message} (${error.code})` : error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Something went wrong while creating the course.';
};

export function CreateCourseCard({ onCreated }: CreateCourseCardProps) {
  const [title, setTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);

    const trimmed = title.trim();
    if (trimmed.length < 2) {
      setMessage({ type: 'error', text: 'Title must be at least 2 characters.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createCourse(trimmed);
      setMessage({ type: 'success', text: `Course created: ${result.courseId}` });
      setTitle('');
      onCreated?.(result.courseId);
    } catch (error) {
      setMessage({ type: 'error', text: getErrorMessage(error) });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="rounded-3xl border-slate-200/80 bg-white/90 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-slate-900">Create Course</CardTitle>
        <p className="text-sm text-slate-600">Start a new course space for lectures and study pointers.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="course-title" className="text-sm font-medium text-slate-700">
              Course title
            </label>
            <Input
              id="course-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Intro to Signals"
              disabled={isSubmitting}
            />
            <p className="text-xs text-slate-500">Minimum 2 characters.</p>
          </div>

          {message && (
            <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
              <AlertTitle>{message.type === 'error' ? 'Error' : 'Success'}</AlertTitle>
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Creating...' : 'Create Course'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
