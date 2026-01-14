'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { listReviews, ReviewSummary } from '../../lib/reviewsClient';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const result = await listReviews();
      if (result.ok) {
        setReviews(result.data);
        setError(null);
      } else {
        setError(result.error || 'Failed to load reviews');
      }
      setLoading(false);
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return reviews;
    return reviews.filter((item) => {
      return (
        item.jobId.toLowerCase().includes(q) ||
        (item.examId && item.examId.toLowerCase().includes(q)) ||
        (item.questionId && item.questionId.toLowerCase().includes(q)) ||
        (item.gradingMode && item.gradingMode.toLowerCase().includes(q))
      );
    });
  }, [reviews, query]);

  const totalAnnotations = reviews.reduce((sum, r) => sum + (r.annotationCount || 0), 0);
  const withResults = reviews.filter((r) => r.hasResult).length;

  return (
    <main className="min-h-screen review-page-bg text-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-8 md:py-12 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-[0.24em] text-slate-500 uppercase">
              Reviews
            </p>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">All Reviews</h1>
            <p className="text-slate-600">Browse every job review and jump back into details.</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{reviews.length} jobs</Badge>
              <Badge variant="outline">Total annotations: {totalAnnotations}</Badge>
              <Badge variant="outline">With results: {withResults}</Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/">
              <Button variant="outline" size="sm">Back to Home</Button>
            </Link>
            <Link href="/">
              <Button size="sm">New Grading Job</Button>
            </Link>
          </div>
        </div>

        <Card className="rounded-3xl border-slate-200/80 bg-white/90 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-lg font-semibold text-slate-900">Review Library</CardTitle>
              <div className="flex items-center gap-2">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by job, exam, question, or mode"
                  className="w-64"
                />
              </div>
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
              <div className="text-sm text-slate-600">
                No reviews found. Start a grading job to see it here.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filtered.map((review) => (
                  <Card
                    key={review.jobId}
                    className="border border-slate-200/80 bg-white hover:shadow-lg transition-shadow"
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base font-semibold text-slate-900">
                          {review.jobId}
                        </CardTitle>
                        <Badge variant={getStatusBadgeVariant(review.status)}>
                          {review.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-600">
                        Updated: {formatDate(review.updatedAt)}
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex flex-wrap gap-2 text-sm text-slate-700">
                        <Badge variant="outline" className="text-xs">
                          Exam: {review.examId || 'unknown'}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          Question: {review.questionId || 'n/a'}
                        </Badge>
                        <Badge variant="outline" className="text-xs capitalize">
                          Mode: {review.gradingMode ? review.gradingMode.toLowerCase() : 'unknown'}
                        </Badge>
                        {review.gradingScope && (
                          <Badge variant="outline" className="text-xs capitalize">
                            Scope: {review.gradingScope.toLowerCase()}
                          </Badge>
                        )}
                        <Badge variant="secondary" className="text-xs">
                          {review.annotationCount} annotations
                        </Badge>
                      </div>
                      <Link href={`/reviews/${review.jobId}`} className="block">
                        <Button variant="default" className="w-full">
                          Open Review
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
