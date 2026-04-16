'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { listExams } from '../../../lib/examsClient';
import { listReviews, ReviewSummary, updateReviewDisplayName } from '../../../lib/reviewsClient';
import { PageHeader } from '../../../components/ui/page-header';
import { StatCard } from '../../../components/ui/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert';
import { Input } from '../../../components/ui/input';
import { StatusBadge } from '../../../components/ui/status-badge';
import { EmptyState } from '../../../components/ui/empty-state';
import { Skeleton } from '../../../components/ui/skeleton';
import { PageTransition, FadeIn, StaggerGroup, StaggerItem, HoverCard } from '../../../components/ui/motion';
import { ClipboardCheck, Search, ArrowRight, MessageSquare, CheckCircle2 } from 'lucide-react';

type ReviewFilter = 'ALL' | 'PUBLISHED' | 'UNPUBLISHED';

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
  const [filter, setFilter] = useState<ReviewFilter>('ALL');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [reviewsResult, examsResult] = await Promise.all([listReviews(), listExams()]);
      if (reviewsResult.ok) { setReviews(reviewsResult.data); setError(null); }
      else setError(reviewsResult.error || 'Failed to load reviews');
      if (examsResult.ok) {
        const next: Record<string, string> = {};
        examsResult.data.forEach((exam) => { next[exam.examId] = exam.title; });
        setExamNamesById(next);
      }
      setLoading(false);
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reviews.filter((item) => {
      if (filter === 'PUBLISHED' && item.publication?.isPublished !== true) return false;
      if (filter === 'UNPUBLISHED' && item.publication?.isPublished === true) return false;
      if (!q) return true;
      const examName = item.examId ? examNamesById[item.examId] : '';
      return Boolean(
        (item.displayName && item.displayName.toLowerCase().includes(q)) ||
        examName.toLowerCase().includes(q) ||
        (item.status && item.status.toLowerCase().includes(q)) ||
        item.jobId.toLowerCase().includes(q)
      );
    });
  }, [reviews, query, examNamesById, filter]);

  const totalAnnotations = reviews.reduce((sum, r) => sum + (r.annotationCount || 0), 0);
  const publishedCount = reviews.filter((r) => r.publication?.isPublished === true).length;

  const startEditingName = (review: ReviewSummary) => {
    setEditingJobId(review.jobId);
    setNameDraft(review.displayName || '');
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
          ? { ...review, displayName: result.review.displayName || null, updatedAt: result.review.updatedAt || review.updatedAt }
          : review
      )
    );
    setEditingJobId(null);
    setNameDraft('');
    setSavingNameJobId(null);
  };

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          title="Reviews"
          description="Monitor review progress, rename jobs, and view detailed feedback."
        />

        {/* Stats */}
        <StaggerGroup className="grid gap-4 sm:grid-cols-3">
          <StaggerItem>
            <StatCard label="Total Reviews" value={loading ? '...' : reviews.length} icon={<ClipboardCheck />} />
          </StaggerItem>
          <StaggerItem>
            <StatCard label="Annotations" value={loading ? '...' : totalAnnotations} icon={<MessageSquare />} />
          </StaggerItem>
          <StaggerItem>
            <StatCard label="Published" value={loading ? '...' : publishedCount} icon={<CheckCircle2 />} />
          </StaggerItem>
        </StaggerGroup>

        {error && (
          <Alert variant="error">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Filters + Search */}
        <FadeIn delay={0.1}>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 rounded-lg border border-(--border) bg-(--surface) p-1">
              {(['ALL', 'PUBLISHED', 'UNPUBLISHED'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                    filter === f
                      ? 'bg-(--brand) text-white shadow-sm'
                      : 'text-(--text-secondary) hover:text-(--text-primary)'
                  }`}
                >
                  {f === 'ALL' ? 'All' : f === 'PUBLISHED' ? 'Published' : 'Unpublished'}
                </button>
              ))}
            </div>
            <div className="flex-1 min-w-[200px] max-w-xs">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search reviews..."
                icon={<Search size={14} />}
              />
            </div>
          </div>
        </FadeIn>

        {/* Review Cards */}
        <FadeIn delay={0.15}>
          {loading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="p-5">
                  <div className="space-y-3">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                </Card>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<ClipboardCheck />}
              title="No reviews found"
              description={filter === 'ALL' ? 'Start a grading job to see it here.' : `No ${filter.toLowerCase()} reviews match.`}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {filtered.map((review) => {
                const examName = review.examId ? examNamesById[review.examId] || 'Exam' : 'Exam not linked';
                const reviewTitle = review.displayName?.trim() || `${examName} review`;

                return (
                  <HoverCard key={review.jobId} className="rounded-xl border border-(--border) bg-(--surface) shadow-(--shadow-xs)">
                    <div className="p-5 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-semibold text-(--text-primary)">{reviewTitle}</h3>
                          <p className="truncate text-xs text-(--text-tertiary)">{examName}</p>
                        </div>
                        <StatusBadge status={review.status} size="sm" />
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="default" size="sm">{review.annotationCount} annotations</Badge>
                        {review.gradingMode && (
                          <Badge variant="outline" size="sm" className="capitalize">
                            {review.gradingMode.toLowerCase()}
                          </Badge>
                        )}
                        {review.publication?.isPublished && (
                          <Badge variant="success" size="sm">Published</Badge>
                        )}
                      </div>

                      {review.publication?.isPublished && (
                        <div className="rounded-lg bg-(--success-subtle) px-3 py-2 text-xs text-(--success)">
                          Published {formatDate(review.publication.publishedAt)}
                          {review.publication.score != null && review.publication.maxScore != null && (
                            <span className="ml-1 font-semibold">{review.publication.score}/{review.publication.maxScore}</span>
                          )}
                        </div>
                      )}

                      {editingJobId === review.jobId ? (
                        <div className="space-y-2">
                          <Input
                            value={nameDraft}
                            onChange={(e) => setNameDraft(e.target.value)}
                            placeholder="Review name"
                            maxLength={120}
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => saveName(review.jobId)} loading={savingNameJobId === review.jobId}>Save</Button>
                            <Button size="sm" variant="secondary" onClick={() => { setEditingJobId(null); setNameDraft(''); }}>Cancel</Button>
                          </div>
                          {renameError?.jobId === review.jobId && (
                            <p className="text-xs text-(--error)">{renameError.message}</p>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Link href={`/reviews/${review.jobId}`} className="flex-1">
                            <Button variant="primary" size="sm" className="w-full">
                              Open <ArrowRight size={14} className="ml-1" />
                            </Button>
                          </Link>
                          <Button variant="ghost" size="sm" onClick={() => startEditingName(review)}>
                            Rename
                          </Button>
                        </div>
                      )}
                    </div>
                  </HoverCard>
                );
              })}
            </div>
          )}
        </FadeIn>
      </div>
    </PageTransition>
  );
}
