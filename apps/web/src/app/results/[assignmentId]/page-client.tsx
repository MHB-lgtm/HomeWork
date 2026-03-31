'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { StudentAssignmentResult } from '@hg/shared-schemas';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { ResultsClientError, getMyResult } from '@/lib/resultsClient';

type StudentResultDetailsPageClientProps = {
  params: {
    assignmentId: string;
  };
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

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
  if (error instanceof ResultsClientError) {
    return error.code ? `${error.message} (${error.code})` : error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Failed to load result.';
};

const renderBreakdown = (breakdownSnapshot: unknown) => {
  if (!Array.isArray(breakdownSnapshot) || breakdownSnapshot.length === 0) {
    return (
      <div className="text-sm text-slate-600">
        No published question breakdown was attached to this result.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {breakdownSnapshot.map((entry, index) => {
        if (!isObject(entry)) {
          return null;
        }

        const questionId =
          typeof entry.displayLabel === 'string'
            ? entry.displayLabel
            : typeof entry.questionId === 'string'
              ? entry.questionId
              : `Question ${index + 1}`;
        const summary =
          typeof entry.overallSummary === 'string' ? entry.overallSummary : null;
        const findings = Array.isArray(entry.findings)
          ? entry.findings.filter(isObject)
          : [];

        return (
          <Card
            key={`${questionId}-${index}`}
            className="rounded-2xl border-slate-200/80 bg-slate-50/70 shadow-none"
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-slate-900">{questionId}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {summary ? <p className="text-sm text-slate-700">{summary}</p> : null}
              {findings.length > 0 ? (
                <div className="space-y-2">
                  {findings.map((finding, findingIndex) => {
                    const title =
                      typeof finding.title === 'string'
                        ? finding.title
                        : `Finding ${findingIndex + 1}`;
                    const description =
                      typeof finding.description === 'string' ? finding.description : null;
                    const severity =
                      typeof finding.severity === 'string' ? finding.severity : null;
                    const kind = typeof finding.kind === 'string' ? finding.kind : 'issue';
                    const suggestion =
                      typeof finding.suggestion === 'string' ? finding.suggestion : null;

                    return (
                      <div
                        key={`${questionId}-finding-${findingIndex}`}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-3"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm font-medium text-slate-900">{title}</div>
                          <Badge variant={kind === 'strength' ? 'default' : 'outline'}>
                            {kind}
                          </Badge>
                          {severity ? <Badge variant="secondary">{severity}</Badge> : null}
                        </div>
                        {description ? (
                          <p className="mt-2 text-sm text-slate-700">{description}</p>
                        ) : null}
                        {suggestion ? (
                          <p className="mt-2 text-sm text-slate-500">Suggestion: {suggestion}</p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm text-slate-600">
                  No detailed findings were published for this question.
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default function StudentResultDetailsPageClient({
  params,
}: StudentResultDetailsPageClientProps) {
  const [result, setResult] = useState<StudentAssignmentResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await getMyResult(params.assignmentId);
        setResult(data);
        setError(null);
      } catch (loadError) {
        setError(getErrorMessage(loadError));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [params.assignmentId]);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <PageHeader
        eyebrow="Student Workspace"
        title={result?.assignmentTitle ?? 'Result'}
        description="This page stays minimal until staff publish the result. Published details appear here only after the release boundary is crossed."
        badges={result ? <StatusBadge status={result.visibleStatus} /> : null}
      />

      <div className="flex flex-wrap gap-2">
        <Link href="/results">
          <Button variant="outline" size="sm">
            Back to results
          </Button>
        </Link>
        <Link href={`/assignments/${params.assignmentId}`}>
          <Button variant="outline" size="sm">
            Open assignment
          </Button>
        </Link>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Result error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="rounded-3xl border-slate-200/80 bg-white/90 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
        <CardHeader className="pb-3">
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold text-slate-900">
              {loading ? 'Loading...' : result?.assignmentTitle ?? 'Result not found'}
            </CardTitle>
            {result ? (
              <>
                <p className="text-sm text-slate-500">{result.courseTitle}</p>
                <p className="text-xs font-mono text-slate-500">{result.assignmentId}</p>
              </>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {result ? (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Submitted
                    </div>
                    <div className="mt-2 text-sm text-slate-900">{formatDate(result.submittedAt)}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Published
                    </div>
                    <div className="mt-2 text-sm text-slate-900">{formatDate(result.publishedAt)}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Score
                    </div>
                    <div className="mt-2 text-sm text-slate-900">
                      {result.visibleStatus === 'PUBLISHED' &&
                      result.score !== null &&
                      result.score !== undefined
                        ? `${result.score}/${result.maxScore ?? 100}`
                        : 'Awaiting publication'}
                    </div>
                  </div>
                </div>

              {result.visibleStatus === 'OPEN' ? (
                <Alert>
                  <AlertTitle>No submission yet</AlertTitle>
                  <AlertDescription>
                    No submission has been recorded for this assignment yet. Use the assignment page to upload your work.
                  </AlertDescription>
                </Alert>
              ) : null}

              {result.visibleStatus === 'SUBMITTED' ? (
                <Alert>
                  <AlertTitle>Awaiting publication</AlertTitle>
                  <AlertDescription>
                    Your submission is recorded. This page stays intentionally minimal until staff publish the result.
                  </AlertDescription>
                </Alert>
              ) : null}

              {result.visibleStatus === 'PUBLISHED' ? (
                <div className="space-y-6">
                  <Card className="rounded-2xl border-slate-200/80 bg-slate-50/70 shadow-none">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-semibold text-slate-900">
                        Published summary
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-slate-700">
                        {result.summary ?? 'No published summary was attached to this result.'}
                      </p>
                    </CardContent>
                  </Card>

                  <div className="space-y-3">
                    <h2 className="text-lg font-semibold text-slate-900">Published breakdown</h2>
                    {renderBreakdown(result.breakdownSnapshot)}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="text-sm text-slate-600">Result not available.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
