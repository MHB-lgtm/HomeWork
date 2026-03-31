'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { AssignmentSubmissionOpsDetail } from '@hg/shared-schemas';
import {
  getAssignmentSubmissionDetail,
  StaffOperationsClientError,
} from '@/lib/staffOperationsClient';
import { ImmersiveShell } from '@/components/layout/ImmersiveShell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type SubmissionOpsDetailPageClientProps = {
  params: {
    courseId: string;
    assignmentId: string;
    submissionId: string;
  };
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof StaffOperationsClientError) {
    return error.code ? `${error.message} (${error.code})` : error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Failed to load submission detail.';
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

const getOperationalBadgeVariant = (
  status: AssignmentSubmissionOpsDetail['operationalStatus']
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
  status: AssignmentSubmissionOpsDetail['publishEligibility']
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

const formatScore = (detail: { score?: number | null; maxScore?: number | null }) => {
  if (detail.score == null || detail.maxScore == null) {
    return '-';
  }

  return `${detail.score}/${detail.maxScore}`;
};

export default function SubmissionOpsDetailPageClient({
  params,
}: SubmissionOpsDetailPageClientProps) {
  const { courseId, assignmentId, submissionId } = params;
  const [detail, setDetail] = useState<AssignmentSubmissionOpsDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDetail = async () => {
    setLoading(true);
    try {
      const data = await getAssignmentSubmissionDetail(courseId, assignmentId, submissionId);
      setDetail(data);
      setError(null);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDetail();
  }, [assignmentId, courseId, submissionId]);

  return (
    <ImmersiveShell>
      <div className="mx-auto w-full max-w-5xl space-y-8">
        <section className="flex w-full flex-col items-center gap-4 text-center">
          <h1 className="font-heading text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
            Submission Detail
          </h1>
          <p className="mx-auto max-w-2xl text-base text-slate-700 md:text-xl">
            Review the current submission state, publication boundary, and jump directly into the
            existing review workspace.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link href={`/courses/${courseId}/assignments/${assignmentId}`}>
              <Button variant="outline" size="sm">
                Back to Assignment
              </Button>
            </Link>
            <Link href="/">
              <Button variant="outline" size="sm">
                Dashboard
              </Button>
            </Link>
          </div>
        </section>

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Submission detail error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Card className="rounded-[2rem] border border-slate-200 bg-white/90 shadow-xl shadow-slate-200/40">
          <CardHeader className="space-y-3 pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <CardTitle className="text-lg font-semibold text-slate-900">
                  {detail?.studentDisplayName ?? 'Loading submission...'}
                </CardTitle>
                <p className="text-sm text-slate-600">
                  {detail?.assignmentTitle ?? 'Assignment detail'}
                </p>
              </div>
              {detail ? (
                <div className="flex flex-wrap gap-2">
                  <Badge variant={getOperationalBadgeVariant(detail.operationalStatus)}>
                    {detail.operationalStatus}
                  </Badge>
                  <Badge variant={getPublishBadgeVariant(detail.publishEligibility)}>
                    {detail.publishEligibility}
                  </Badge>
                </div>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              <div className="text-sm text-slate-600">Loading submission detail...</div>
            ) : detail ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="border border-slate-200/80 bg-slate-50/70 shadow-none">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-semibold text-slate-900">
                        Submission
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-slate-700">
                      <div>Course: {detail.courseTitle}</div>
                      <div>Assignment: {detail.assignmentTitle}</div>
                      <div>Student: {detail.studentDisplayName ?? 'Unnamed student'}</div>
                      <div>Email: {detail.studentEmail ?? detail.studentUserId}</div>
                      <div>Submitted: {formatDate(detail.submittedAt)}</div>
                      <div>Submission ID: {detail.submissionId}</div>
                      <div>Job ID: {detail.jobId ?? '-'}</div>
                    </CardContent>
                  </Card>

                  <Card className="border border-slate-200/80 bg-slate-50/70 shadow-none">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-semibold text-slate-900">
                        Publication
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-slate-700">
                      <div>Eligibility: {detail.publishEligibility}</div>
                      <div>Republish needed: {detail.republishNeeded ? 'Yes' : 'No'}</div>
                      <div>Published at: {formatDate(detail.publishedAt)}</div>
                      <div>Score: {formatScore(detail)}</div>
                      <div>Review updated: {formatDate(detail.reviewUpdatedAt)}</div>
                    </CardContent>
                  </Card>
                </div>

                {detail.publication?.isPublished ? (
                  <Alert>
                    <AlertTitle>Published result</AlertTitle>
                    <AlertDescription>
                      <div className="space-y-1">
                        <div>
                          Published at {formatDate(detail.publication.publishedAt)} with score{' '}
                          {detail.publication.score ?? '-'} / {detail.publication.maxScore ?? '-'}.
                        </div>
                        {detail.publication.summary ? (
                          <div>{detail.publication.summary}</div>
                        ) : null}
                      </div>
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert>
                    <AlertTitle>Not published yet</AlertTitle>
                    <AlertDescription>
                      This submission stays on the staff side until publish. Students still only
                      see status before the publish boundary.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex flex-wrap gap-2">
                  {detail.reviewLink ? (
                    <Link href={detail.reviewLink}>
                      <Button size="sm">Open Review Workspace</Button>
                    </Link>
                  ) : null}
                  <a href={detail.submissionDownloadLink} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline">
                      Download Submission
                    </Button>
                  </a>
                </div>

                <Card className="border border-slate-200/80 bg-slate-50/70 shadow-none">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold text-slate-900">
                      Technical detail
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-slate-700">
                    <div>Assignment state: {detail.rawStatuses.assignmentState}</div>
                    <div>Submission state: {detail.rawStatuses.submissionState ?? '-'}</div>
                    <div>Job status: {detail.rawStatuses.jobStatus ?? '-'}</div>
                    <div>Review state: {detail.rawStatuses.reviewState ?? '-'}</div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="text-sm text-slate-600">Submission not found.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </ImmersiveShell>
  );
}
