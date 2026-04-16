'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { StudentAssignmentStatus } from '@hg/shared-schemas';
import { AccountMenu } from '@/components/auth/AccountMenu';
import { ImmersiveShell } from '@/components/layout/ImmersiveShell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResultsClientError, listMyResults } from '@/lib/resultsClient';

const formatDate = (value: string | null | undefined) => {
  if (!value) {
    return 'Not published';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof ResultsClientError) {
    return error.code ? `${error.message} (${error.code})` : error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Failed to load results.';
};

const getStatusVariant = (status: StudentAssignmentStatus['submissionState']) => {
  switch (status) {
    case 'PUBLISHED':
      return 'default';
    case 'SUBMITTED':
      return 'secondary';
    case 'NOT_SUBMITTED':
      return 'outline';
  }
};

export default function StudentResultsPageClient() {
  const [results, setResults] = useState<StudentAssignmentStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await listMyResults();
        setResults(data);
        setError(null);
      } catch (loadError) {
        setError(getErrorMessage(loadError));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  return (
    <ImmersiveShell showTopNav={false} contentClassName="px-4 pb-10 pt-10 md:px-6">
      <div className="mx-auto w-full max-w-5xl space-y-8">
        <header className="flex items-center justify-between gap-4 rounded-3xl border border-slate-200/80 bg-white/90 px-6 py-4 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
          <div className="space-y-1">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
              Student Workspace
            </p>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">Results</h1>
          </div>
          <AccountMenu />
        </header>

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load results</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {loading ? (
          <div className="text-sm text-slate-600">Loading results...</div>
        ) : results.length === 0 ? (
          <Card className="rounded-3xl border-slate-200/80 bg-white/90 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
            <CardContent className="py-10 text-center text-sm text-slate-600">
              No assignment results are visible yet.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {results.map((result) => (
              <Card
                key={result.assignmentId}
                className="rounded-3xl border-slate-200/80 bg-white/90 shadow-[0_18px_50px_rgba(15,23,42,0.06)]"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="text-lg font-semibold text-slate-900">
                        {result.assignmentTitle}
                      </CardTitle>
                      <p className="text-sm text-slate-500">{result.courseTitle}</p>
                      <p className="text-xs font-mono text-slate-500">{result.assignmentId}</p>
                    </div>
                    <Badge variant={getStatusVariant(result.submissionState)}>
                      {result.submissionState}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1 text-sm text-slate-600">
                    <div>Submitted: {formatDate(result.submittedAt)}</div>
                    <div>Published: {formatDate(result.publishedAt)}</div>
                    <div>
                      Score:{' '}
                      {result.hasPublishedResult && result.score !== null && result.score !== undefined
                        ? `${result.score}/${result.maxScore ?? 100}`
                        : 'Awaiting publication'}
                    </div>
                  </div>
                  <Link href={`/results/${result.assignmentId}`} className="block">
                    <Button className="w-full">Open result</Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ImmersiveShell>
  );
}
