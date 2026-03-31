'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type {
  AssignmentSubmissionOpsRow,
  StaffDashboardAssignmentRow,
} from '@hg/shared-schemas';
import {
  getAssignmentSubmissionOps,
  StaffOperationsClientError,
} from '@/lib/staffOperationsClient';
import { ImmersiveShell } from '@/components/layout/ImmersiveShell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type AssignmentOpsPageClientProps = {
  params: {
    courseId: string;
    assignmentId: string;
  };
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof StaffOperationsClientError) {
    return error.code ? `${error.message} (${error.code})` : error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Failed to load assignment operations.';
};

const formatDate = (value: string | null | undefined) => {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
};

const formatScore = (row: { score?: number | null; maxScore?: number | null }) => {
  if (row.score == null || row.maxScore == null) {
    return '-';
  }

  return `${row.score}/${row.maxScore}`;
};

const getOperationalBadgeVariant = (
  status: AssignmentSubmissionOpsRow['operationalStatus']
): 'default' | 'secondary' | 'outline' | 'destructive' => {
  switch (status) {
    case 'PUBLISHED':
      return 'default';
    case 'READY_FOR_REVIEW':
      return 'default';
    case 'PROCESSING':
      return 'secondary';
    case 'FAILED':
      return 'destructive';
    case 'SUBMITTED':
    default:
      return 'outline';
  }
};

const getPublishBadgeVariant = (
  status: AssignmentSubmissionOpsRow['publishEligibility']
): 'default' | 'secondary' | 'outline' | 'destructive' => {
  switch (status) {
    case 'PUBLISHED':
      return 'default';
    case 'READY':
      return 'secondary';
    case 'NOT_READY':
    default:
      return 'outline';
  }
};

const buildAssignmentSummary = (assignment: StaffDashboardAssignmentRow) => [
  { label: 'Active students', value: assignment.totalActiveStudents, variant: 'outline' as const },
  { label: 'Not submitted', value: assignment.notSubmittedCount, variant: 'outline' as const },
  { label: 'Submitted', value: assignment.submittedCount, variant: 'outline' as const },
  { label: 'Processing', value: assignment.processingCount, variant: 'secondary' as const },
  { label: 'Ready', value: assignment.readyForReviewCount, variant: 'default' as const },
  { label: 'Published', value: assignment.publishedCount, variant: 'default' as const },
  { label: 'Failed', value: assignment.failedCount, variant: 'destructive' as const },
  { label: 'Publishable', value: assignment.publishableCount, variant: 'secondary' as const },
  {
    label: 'Republish needed',
    value: assignment.republishNeededCount,
    variant: 'secondary' as const,
  },
];

export default function AssignmentOpsPageClient({
  params,
}: AssignmentOpsPageClientProps) {
  const { courseId, assignmentId } = params;
  const [assignment, setAssignment] = useState<StaffDashboardAssignmentRow | null>(null);
  const [submissions, setSubmissions] = useState<AssignmentSubmissionOpsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAssignment = async () => {
    setLoading(true);
    try {
      const data = await getAssignmentSubmissionOps(courseId, assignmentId);
      setAssignment(data.assignment);
      setSubmissions(data.submissions);
      setError(null);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAssignment();
  }, [assignmentId, courseId]);

  const summaryBadges = useMemo(
    () => (assignment ? buildAssignmentSummary(assignment) : []),
    [assignment]
  );

  return (
    <ImmersiveShell>
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <section className="flex w-full flex-col items-center gap-4 text-center">
          <h1 className="font-heading text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
            Assignment Operations
          </h1>
          <p className="mx-auto max-w-2xl text-base text-slate-700 md:text-xl">
            Track the current submission row per student and jump into the review workspace when
            a submission is ready.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link href={`/courses/${courseId}`}>
              <Button variant="outline" size="sm">
                Back to Course
              </Button>
            </Link>
            <Link href="/">
              <Button variant="outline" size="sm">
                Dashboard
              </Button>
            </Link>
            <Link href="/reviews">
              <Button size="sm">Reviews</Button>
            </Link>
          </div>
        </section>

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Assignment ops error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Card className="rounded-[2rem] border border-slate-200 bg-white/90 shadow-xl shadow-slate-200/40">
          <CardHeader className="space-y-3 pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <CardTitle className="text-lg font-semibold text-slate-900">
                  {assignment?.assignmentTitle ?? 'Loading assignment...'}
                </CardTitle>
                <p className="text-sm text-slate-600">
                  {assignment?.courseTitle ?? 'Course summary'}
                </p>
              </div>
              {assignment ? (
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{assignment.assignmentState}</Badge>
                  <Badge variant="outline">{assignment.assignmentId}</Badge>
                </div>
              ) : null}
            </div>
            {assignment ? (
              <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-3">
                <div>Open: {formatDate(assignment.openAt)}</div>
                <div>Deadline: {formatDate(assignment.deadlineAt)}</div>
                <div>Latest activity: {formatDate(assignment.latestActivityAt)}</div>
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="text-sm text-slate-600">Loading assignment ops...</div>
            ) : assignment ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {summaryBadges.map((item) => (
                    <Badge key={item.label} variant={item.variant}>
                      {item.value} {item.label.toLowerCase()}
                    </Badge>
                  ))}
                </div>

                {submissions.length === 0 ? (
                  <div className="text-sm text-slate-600">
                    No student submissions yet. Active student seats are counted above, but only
                    latest non-superseded submissions appear here.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Publish</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {submissions.map((submission) => (
                        <TableRow key={submission.submissionId}>
                          <TableCell className="align-top">
                            <div className="space-y-1">
                              <div className="font-medium text-slate-900">
                                {submission.studentDisplayName ?? 'Unnamed student'}
                              </div>
                              <div className="text-xs text-slate-600">
                                {submission.studentEmail ?? submission.studentUserId}
                              </div>
                              <div className="text-xs font-mono text-slate-500">
                                {submission.submissionId}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="align-top text-sm text-slate-600">
                            <div>{formatDate(submission.submittedAt)}</div>
                            <div className="text-xs">Review updated: {formatDate(submission.reviewUpdatedAt)}</div>
                          </TableCell>
                          <TableCell className="align-top">
                            <Badge variant={getOperationalBadgeVariant(submission.operationalStatus)}>
                              {submission.operationalStatus}
                            </Badge>
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="space-y-2">
                              <Badge variant={getPublishBadgeVariant(submission.publishEligibility)}>
                                {submission.publishEligibility}
                              </Badge>
                              {submission.republishNeeded ? (
                                <div className="text-xs text-slate-600">Republish needed</div>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="align-top text-sm text-slate-600">
                            <div>{formatScore(submission)}</div>
                            <div className="text-xs">Published: {formatDate(submission.publishedAt)}</div>
                          </TableCell>
                          <TableCell className="align-top text-right">
                            <div className="flex justify-end gap-2">
                              <Link
                                href={`/courses/${courseId}/assignments/${assignmentId}/submissions/${submission.submissionId}`}
                              >
                                <Button size="sm" variant="outline">
                                  Details
                                </Button>
                              </Link>
                              {submission.jobId ? (
                                <Link href={`/reviews/${submission.jobId}`}>
                                  <Button size="sm">Review</Button>
                                </Link>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </>
            ) : (
              <div className="text-sm text-slate-600">Assignment not found.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </ImmersiveShell>
  );
}
