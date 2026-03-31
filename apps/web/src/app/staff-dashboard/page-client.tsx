'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { StaffDashboardAssignmentRow } from '@hg/shared-schemas';
import {
  listStaffDashboardAssignments,
  StaffOperationsClientError,
} from '@/lib/staffOperationsClient';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const getErrorMessage = (error: unknown) => {
  if (error instanceof StaffOperationsClientError) {
    return error.code ? `${error.message} (${error.code})` : error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Failed to load dashboard.';
};

const formatDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
};

const toStatusSummary = (row: StaffDashboardAssignmentRow) =>
  [
    row.processingCount > 0 ? `${row.processingCount} processing` : null,
    row.readyForReviewCount > 0 ? `${row.readyForReviewCount} ready` : null,
    row.publishedCount > 0 ? `${row.publishedCount} published` : null,
    row.failedCount > 0 ? `${row.failedCount} failed` : null,
    row.notSubmittedCount > 0 ? `${row.notSubmittedCount} not submitted` : null,
  ]
    .filter(Boolean)
    .join(' • ');

export default function StaffDashboardPageClient() {
  const [rows, setRows] = useState<StaffDashboardAssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const data = await listStaffDashboardAssignments();
      setRows(data);
      setError(null);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  const totals = useMemo(
    () =>
      rows.reduce(
        (summary, row) => ({
          assignments: summary.assignments + 1,
          activeStudents: summary.activeStudents + row.totalActiveStudents,
          processing: summary.processing + row.processingCount,
          ready: summary.ready + row.readyForReviewCount,
          publishable: summary.publishable + row.publishableCount,
        }),
        {
          assignments: 0,
          activeStudents: 0,
          processing: 0,
          ready: 0,
          publishable: 0,
        }
      ),
    [rows]
  );

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <PageHeader
        title="Lecturer Ops Dashboard"
        description="Track assignment submissions live, jump into reviews, and publish when ready."
        badges={
          <>
            <Badge variant="secondary">{totals.assignments} assignments</Badge>
            <Badge variant="outline">{totals.activeStudents} active student seats</Badge>
            <Badge variant="outline">{totals.processing} processing</Badge>
            <Badge variant="outline">{totals.ready} ready</Badge>
            <Badge variant="outline">{totals.publishable} publishable</Badge>
          </>
        }
        actions={
          <>
            <Link href="/jobs/new">
              <Button size="sm">New Legacy Job</Button>
            </Link>
            <Link href="/courses">
              <Button variant="outline" size="sm">
                Courses
              </Button>
            </Link>
            <Link href="/reviews">
              <Button variant="outline" size="sm">
                Reviews
              </Button>
            </Link>
          </>
        }
      />

      <Card className="rounded-[2rem] border border-slate-200 bg-white/90 shadow-xl shadow-slate-200/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-slate-900">
            Assignment Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Dashboard error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {loading ? (
            <div className="text-sm text-slate-600">Loading dashboard...</div>
          ) : rows.length === 0 ? (
            <EmptyState
              title="No accessible assignments yet"
              description="Create or open a course assignment to start tracking submissions."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assignment</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Window</TableHead>
                  <TableHead>Current status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={`${row.courseId}:${row.assignmentId}`}>
                    <TableCell className="align-top">
                      <div className="space-y-1">
                        <div className="font-medium text-slate-900">{row.assignmentTitle}</div>
                        <div className="text-xs font-mono text-slate-500">{row.assignmentId}</div>
                        <div className="text-xs text-slate-600">State: {row.assignmentState}</div>
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="space-y-1">
                        <div className="font-medium text-slate-900">{row.courseTitle}</div>
                        <div className="text-xs font-mono text-slate-500">{row.courseId}</div>
                      </div>
                    </TableCell>
                    <TableCell className="align-top text-sm text-slate-600">
                      <div>Open: {formatDate(row.openAt)}</div>
                      <div>Deadline: {formatDate(row.deadlineAt)}</div>
                      <div>Latest: {formatDate(row.latestActivityAt)}</div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">{row.totalActiveStudents} active</Badge>
                        {row.notSubmittedCount > 0 ? (
                          <Badge variant="outline">{row.notSubmittedCount} not submitted</Badge>
                        ) : null}
                        {row.processingCount > 0 ? (
                          <Badge variant="secondary">{row.processingCount} processing</Badge>
                        ) : null}
                        {row.readyForReviewCount > 0 ? (
                          <Badge>{row.readyForReviewCount} ready</Badge>
                        ) : null}
                        {row.publishedCount > 0 ? (
                          <Badge>{row.publishedCount} published</Badge>
                        ) : null}
                        {row.failedCount > 0 ? (
                          <Badge variant="destructive">{row.failedCount} failed</Badge>
                        ) : null}
                        {row.republishNeededCount > 0 ? (
                          <Badge variant="secondary">
                            {row.republishNeededCount} republish
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-2 text-xs text-slate-500">{toStatusSummary(row)}</p>
                    </TableCell>
                    <TableCell className="align-top text-right">
                      <div className="flex justify-end">
                        <Link href={`/courses/${row.courseId}/assignments/${row.assignmentId}`}>
                          <Button size="sm">Open assignment</Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
