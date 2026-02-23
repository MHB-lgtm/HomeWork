'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { listExams } from '../../lib/examsClient';
import { listReviews, ReviewSummary, updateReviewDisplayName } from '../../lib/reviewsClient';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { Input } from '../../components/ui/input';

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'destructive';

const getStatusBadgeVariant = (status: string | null): BadgeVariant => {
  switch (status) {
    case 'DONE':
      return 'default';
    case 'FAILED':
      return 'destructive';
    case 'PENDING':
    case 'RUNNING':
      return 'secondary';
    default:
      return 'outline';
  }
};

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
};

export default function ReviewsListPage() {
  const [reviews, setReviews] = useState<ReviewSummary[]>([]);
  const [examNamesById, setExamNamesById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [savingNameJobId, setSavingNameJobId] = useState<string | null>(null);
  const [renameError, setRenameError] = useState<{ jobId: string; message: string } | null>(null);
  const [copiedValue, setCopiedValue] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [reviewsResult, examsResult] = await Promise.all([listReviews(), listExams()]);

      if (reviewsResult.ok) {
        setReviews(reviewsResult.data);
        setError(null);
      } else {
        setError(reviewsResult.error || 'Failed to load reviews');
      }

      if (examsResult.ok) {
        const next: Record<string, string> = {};
        examsResult.data.forEach((exam) => {
          next[exam.examId] = exam.title;
        });
        setExamNamesById(next);
      }

      setLoading(false);
    };

    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return reviews;

    return reviews.filter((item) => {
      const examName = item.examId ? examNamesById[item.examId] : '';
      return (
        (item.displayName && item.displayName.toLowerCase().includes(q)) ||
        examName.toLowerCase().includes(q) ||
        (item.status && item.status.toLowerCase().includes(q)) ||
        (item.gradingMode && item.gradingMode.toLowerCase().includes(q)) ||
        item.jobId.toLowerCase().includes(q)
      );
    });
  }, [reviews, query, examNamesById]);

  const totalAnnotations = reviews.reduce((sum, r) => sum + (r.annotationCount || 0), 0);
  const withResults = reviews.filter((r) => r.hasResult).length;

  const startEditingName = (review: ReviewSummary) => {
    setEditingJobId(review.jobId);
    setNameDraft(review.displayName || '');
    setRenameError(null);
  };

  const cancelEditingName = () => {
    setEditingJobId(null);
    setNameDraft('');
    setRenameError(null);
  };

  const saveName = async (jobId: string) => {
    const trimmed = nameDraft.trim();
    setSavingNameJobId(jobId);
    setRenameError(null);

    const result = await updateReviewDisplayName(jobId, trimmed.length > 0 ? trimmed : null);
    if (!result.ok) {
      setRenameError({ jobId, message: result.error || 'Failed to update name' });
      setSavingNameJobId(null);
      return;
    }

    setReviews((prev) =>
      prev.map((review) =>
        review.jobId === jobId
          ? {
              ...review,
              displayName: result.review.displayName || null,
              updatedAt: result.review.updatedAt || review.updatedAt,
            }
          : review
      )
    );
    setEditingJobId(null);
    setNameDraft('');
    setSavingNameJobId(null);
  };

  const copyText = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedValue(value);
      window.setTimeout(() => setCopiedValue((prev) => (prev === value ? null : prev)), 1200);
    } catch {
      setCopiedValue(null);
    }
  };

  return (
    <main className="min-h-screen review-page-bg text-slate-900">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 md:py-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-[0.24em] text-slate-500 uppercase">Reviews</p>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">All Reviews</h1>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{reviews.length} reviews</Badge>
              <Badge variant="outline">{totalAnnotations} annotations</Badge>
              <Badge variant="outline">{withResults} with results</Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/">
              <Button variant="outline" size="sm">
                Back to Dashboard
              </Button>
            </Link>
            <Link href="/">
              <Button size="sm">Create Review</Button>
            </Link>
          </div>
        </div>

        <Card className="rounded-3xl border-slate-200/80 bg-white/90 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-lg font-semibold text-slate-900">Review Library</CardTitle>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, exam, status"
                className="w-64"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {loading ? (
              <div className="text-sm text-slate-600">Loading reviews...</div>
            ) : filtered.length === 0 ? (
              <div className="text-sm text-slate-600">No reviews found. Start a grading job to see it here.</div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {filtered.map((review) => {
                  const examName = review.examId ? examNamesById[review.examId] || 'Exam' : 'Exam not linked';
                  const reviewTitle = review.displayName?.trim() || `${examName} review`;

                  return (
                    <Card key={review.jobId} className="border border-slate-200/80 bg-white transition-shadow hover:shadow-lg">
                      <CardHeader className="space-y-2 pb-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 space-y-1">
                            <CardTitle className="truncate text-base font-semibold text-slate-900">{reviewTitle}</CardTitle>
                            <p className="truncate text-sm text-slate-600">{examName}</p>
                          </div>
                          <Badge variant={getStatusBadgeVariant(review.status)}>{review.status}</Badge>
                        </div>
                        <p className="text-xs text-slate-600">Updated: {formatDate(review.updatedAt)}</p>

                        {editingJobId === review.jobId ? (
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Input
                                value={nameDraft}
                                onChange={(e) => setNameDraft(e.target.value)}
                                placeholder="Add review name"
                                maxLength={120}
                                className="h-8 text-sm"
                              />
                              <Button
                                size="sm"
                                onClick={() => saveName(review.jobId)}
                                disabled={savingNameJobId === review.jobId}
                              >
                                {savingNameJobId === review.jobId ? 'Saving...' : 'Save'}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={cancelEditingName}
                                disabled={savingNameJobId === review.jobId}
                              >
                                Cancel
                              </Button>
                            </div>
                            {renameError?.jobId === review.jobId && (
                              <p className="text-xs text-red-600">{renameError.message}</p>
                            )}
                          </div>
                        ) : (
                          <div className="flex justify-end">
                            <Button variant="ghost" size="sm" onClick={() => startEditingName(review)}>
                              {review.displayName ? 'Edit name' : 'Add name'}
                            </Button>
                          </div>
                        )}
                      </CardHeader>

                      <CardContent className="space-y-3">
                        <div className="flex flex-wrap gap-2 text-sm text-slate-700">
                          <Badge variant="outline" className="text-xs capitalize">
                            {review.gradingMode ? review.gradingMode.toLowerCase() : 'mode unknown'}
                          </Badge>
                          {review.gradingScope ? (
                            <Badge variant="outline" className="text-xs capitalize">
                              {review.gradingScope.toLowerCase()}
                            </Badge>
                          ) : null}
                          <Badge variant="secondary" className="text-xs">
                            {review.annotationCount} annotations
                          </Badge>
                        </div>

                        <details className="rounded-lg border border-slate-200/90 bg-slate-50/70 p-2 text-xs text-slate-600">
                          <summary className="cursor-pointer font-medium text-slate-700">Technical details</summary>
                          <div className="mt-2 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono">Job ID: {review.jobId}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={() => copyText(review.jobId)}
                              >
                                {copiedValue === review.jobId ? 'Copied' : 'Copy'}
                              </Button>
                            </div>
                            {review.examId ? <p className="font-mono">Exam ID: {review.examId}</p> : null}
                            {review.questionId ? <p className="font-mono">Question ID: {review.questionId}</p> : null}
                          </div>
                        </details>

                        <Link href={`/reviews/${review.jobId}`} className="block">
                          <Button variant="default" className="w-full">
                            Open Review
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
