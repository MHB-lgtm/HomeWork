'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { Course } from '@hg/shared-schemas';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

type CoursesTableProps = {
  courses: Course[];
  isLoading?: boolean;
  onRefresh?: () => void;
};

const formatDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

export function CoursesTable({ courses, isLoading = false, onRefresh }: CoursesTableProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyTimeoutRef = useRef<number | null>(null);

  const sortedCourses = useMemo(() => {
    return [...courses].sort((a, b) => {
      const aTime = Date.parse(a.createdAt);
      const bTime = Date.parse(b.createdAt);
      if (!Number.isNaN(aTime) && !Number.isNaN(bTime) && aTime !== bTime) {
        return bTime - aTime;
      }
      return a.courseId.localeCompare(b.courseId);
    });
  }, [courses]);

  const handleCopy = async (courseId: string) => {
    try {
      await navigator.clipboard.writeText(courseId);
      setCopiedId(courseId);
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      setCopiedId(null);
    }
  };

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  return (
    <Card className="rounded-3xl border-slate-200/80 bg-white/90 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold text-slate-900">Courses</CardTitle>
            <p className="text-sm text-slate-600">Manage your course catalog and open details.</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{courses.length} total</Badge>
            {onRefresh && (
              <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
                {isLoading ? 'Refreshing...' : 'Refresh'}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="text-sm text-slate-600">Loading courses...</div>
        ) : sortedCourses.length === 0 ? (
          <div className="text-sm text-slate-600">
            No courses yet. Create your first course to start uploading lectures.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Course ID</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedCourses.map((course) => (
                <TableRow key={course.courseId}>
                  <TableCell className="font-medium text-slate-900">{course.title}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-slate-700">{course.courseId}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        onClick={() => handleCopy(course.courseId)}
                        className="h-7 px-2 text-xs"
                      >
                        {copiedId === course.courseId ? 'Copied' : 'Copy'}
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-600">{formatDate(course.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <Link href={`/courses/${course.courseId}`}>
                      <Button variant="outline" size="sm">
                        Manage
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
