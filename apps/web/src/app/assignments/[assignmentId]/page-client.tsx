'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { StudentAssignment } from '@hg/shared-schemas';
import {
  AssignmentsClientError,
  getMyAssignment,
  submitMyAssignment,
} from '@/lib/assignmentsClient';
import { AccountMenu } from '@/components/auth/AccountMenu';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ImmersiveShell } from '@/components/layout/ImmersiveShell';

type AssignmentDetailsPageClientProps = {
  params: {
    assignmentId: string;
  };
};

const formatDate = (value: string | null | undefined) => {
  if (!value) {
    return 'Not available';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof AssignmentsClientError) {
    return error.code ? `${error.message} (${error.code})` : error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Failed to load assignment.';
};

const getBadgeVariant = (assignment: StudentAssignment) =>
  assignment.visibleStatus === 'PUBLISHED' ? 'default' : 'outline';

const getStatusCopy = (assignment: StudentAssignment) => {
  switch (assignment.visibleStatus) {
    case 'OPEN':
      return assignment.canSubmit
        ? 'This assignment is open for submission.'
        : 'This assignment is visible, but the submission window is currently closed.';
    case 'SUBMITTED':
      return 'Your latest submission is recorded. Staff review progress stays hidden until publish.';
    case 'PUBLISHED':
      return assignment.canResubmit
        ? 'A published result is available, and the assignment still accepts updated submissions.'
        : 'A published result is available for this assignment.';
  }
};

const canUpload = (assignment: StudentAssignment | null) =>
  Boolean(assignment && (assignment.canSubmit || assignment.canResubmit));

export default function AssignmentDetailsPageClient({
  params,
}: AssignmentDetailsPageClientProps) {
  const [assignment, setAssignment] = useState<StudentAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submissionFile, setSubmissionFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await getMyAssignment(params.assignmentId);
        setAssignment(data);
        setError(null);
      } catch (loadError) {
        setError(getErrorMessage(loadError));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [params.assignmentId]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!submissionFile) {
      setError('Submission file is required.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSubmitResult(null);
    try {
      const result = await submitMyAssignment(params.assignmentId, submissionFile);
      setSubmitResult(`Submission accepted. Job ID: ${result.jobId}`);
      setAssignment((current) =>
        current
          ? {
              ...current,
              visibleStatus: 'SUBMITTED',
              submittedAt: new Date().toISOString(),
              hasSubmission: true,
              hasPublishedResult: false,
              canSubmit: false,
              canResubmit: current.canSubmit || current.canResubmit,
            }
          : current
      );
      setSubmissionFile(null);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  };

  const showUploadForm = canUpload(assignment);
  const uploadButtonLabel =
    assignment?.visibleStatus === 'OPEN' && assignment?.canSubmit
      ? 'Submit homework'
      : 'Replace submission';

  return (
    <ImmersiveShell showTopNav={false} contentClassName="px-4 pb-10 pt-10 md:px-6">
      <div className="mx-auto w-full max-w-4xl space-y-8">
        <header className="flex items-center justify-between gap-4 rounded-3xl border border-slate-200/80 bg-white/90 px-6 py-4 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
          <div className="space-y-1">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
              Student Workspace
            </p>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">
              Assignment
            </h1>
          </div>
          <AccountMenu />
        </header>

        <div className="flex flex-wrap gap-2">
          <Link href="/assignments">
            <Button variant="outline" size="sm">
              Back to assignments
            </Button>
          </Link>
          {assignment ? (
            <a
              href={`/api/me/assignments/${assignment.assignmentId}/prompt-raw`}
              target="_blank"
              rel="noreferrer"
            >
              <Button size="sm">Open assignment PDF</Button>
            </a>
          ) : null}
          {assignment?.visibleStatus === 'PUBLISHED' ? (
            <Link href={`/results/${assignment.assignmentId}`}>
              <Button variant="outline" size="sm">
                Open published result
              </Button>
            </Link>
          ) : null}
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Assignment error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {submitResult ? (
          <Alert>
            <AlertTitle>Submission accepted</AlertTitle>
            <AlertDescription>{submitResult}</AlertDescription>
          </Alert>
        ) : null}

        <Card className="rounded-3xl border-slate-200/80 bg-white/90 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <CardTitle className="text-lg font-semibold text-slate-900">
                  {loading ? 'Loading...' : assignment?.title ?? 'Assignment not found'}
                </CardTitle>
                {assignment ? (
                  <p className="text-xs font-mono text-slate-500">{assignment.assignmentId}</p>
                ) : null}
              </div>
              {assignment ? (
                <Badge variant={getBadgeVariant(assignment)}>{assignment.visibleStatus}</Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {assignment ? (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Opens
                    </div>
                    <div className="mt-2 text-sm text-slate-900">{formatDate(assignment.openAt)}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Deadline
                    </div>
                    <div className="mt-2 text-sm text-slate-900">{formatDate(assignment.deadlineAt)}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Submitted
                    </div>
                    <div className="mt-2 text-sm text-slate-900">
                      {assignment.hasSubmission ? formatDate(assignment.submittedAt) : 'No submission yet'}
                    </div>
                  </div>
                </div>

                <Alert>
                  <AlertTitle>Current status</AlertTitle>
                  <AlertDescription>{getStatusCopy(assignment)}</AlertDescription>
                </Alert>

                {assignment.visibleStatus === 'SUBMITTED' ? (
                  <Card className="rounded-2xl border-slate-200/80 bg-slate-50/70 shadow-none">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-semibold text-slate-900">
                        Waiting for publication
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-slate-700">
                      Your submission is safely recorded. Staff may already be reviewing it, but no
                      score or feedback will appear here until they publish the result.
                    </CardContent>
                  </Card>
                ) : null}

                {assignment.visibleStatus === 'PUBLISHED' ? (
                  <Card className="rounded-2xl border-slate-200/80 bg-slate-50/70 shadow-none">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-semibold text-slate-900">
                        Published result available
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-slate-700">
                        The published result is now visible in your Results workspace.
                      </p>
                      <Link href={`/results/${assignment.assignmentId}`}>
                        <Button>Open published result</Button>
                      </Link>
                    </CardContent>
                  </Card>
                ) : null}

                {assignment.canResubmit ? (
                  <Alert>
                    <AlertTitle>Resubmission available</AlertTitle>
                    <AlertDescription>
                      Uploading a new file will replace your current active submission for this
                      assignment.
                    </AlertDescription>
                  </Alert>
                ) : null}

                {showUploadForm ? (
                  <form
                    onSubmit={handleSubmit}
                    className="space-y-4 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4"
                  >
                    <div className="space-y-2">
                      <label htmlFor="student-submission" className="text-sm font-medium text-slate-700">
                        Submission file
                      </label>
                      <Input
                        id="student-submission"
                        type="file"
                        accept=".pdf,image/*"
                        disabled={submitting}
                        onChange={(event) => setSubmissionFile(event.target.files?.[0] || null)}
                      />
                    </div>
                    <Button type="submit" disabled={submitting || !submissionFile}>
                      {submitting ? 'Submitting...' : uploadButtonLabel}
                    </Button>
                  </form>
                ) : null}
              </>
            ) : (
              <div className="text-sm text-slate-600">Assignment not available.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </ImmersiveShell>
  );
}
