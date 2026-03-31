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

const formatDate = (value: string) => {
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
      setSubmitResult(`Submission queued. Job ID: ${result.jobId}`);
      setAssignment((current) =>
        current
          ? {
              ...current,
              visibleStatus: 'SUBMITTED',
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

  return (
    <ImmersiveShell showTopNav={false} contentClassName="px-4 pb-10 pt-10 md:px-6">
      <div className="mx-auto w-full max-w-4xl space-y-8">
        <header className="flex items-center justify-between gap-4 rounded-3xl border border-slate-200/80 bg-white/90 px-6 py-4 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
          <div className="space-y-1">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Student Workspace</p>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">Assignment</h1>
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
            <a href={`/api/me/assignments/${assignment.assignmentId}/prompt-raw`} target="_blank" rel="noreferrer">
              <Button size="sm">Open assignment PDF</Button>
            </a>
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
            <AlertTitle>Submission queued</AlertTitle>
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
                <Badge variant={assignment.visibleStatus === 'PUBLISHED' ? 'default' : 'outline'}>
                  {assignment.visibleStatus}
                </Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {assignment ? (
              <>
                <div className="space-y-1 text-sm text-slate-600">
                  <div>Opens: {formatDate(assignment.openAt)}</div>
                  <div>Deadline: {formatDate(assignment.deadlineAt)}</div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4">
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
                    {submitting ? 'Submitting...' : 'Submit homework'}
                  </Button>
                </form>

                <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-sm text-slate-600">
                  After staff publish your result, it will appear in the student Results workspace. This page handles submission through the existing exam-style grading flow.
                </div>
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
