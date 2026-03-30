'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { listExams, ExamSummary } from '@/lib/examsClient';
import { listReviews, ReviewSummary } from '@/lib/reviewsClient';
import { listCourses } from '@/lib/coursesClient';
import type { Course } from '@hg/shared-schemas';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Skeleton, CardSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { PageTransition, FadeIn, StaggerGroup, StaggerItem, HoverCard } from '@/components/ui/motion';
import {
  BookOpen,
  FileText,
  ClipboardCheck,
  ArrowRight,
  Activity,
  TrendingUp,
  Sparkles,
} from 'lucide-react';

export default function StaffDashboardClient() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [reviews, setReviews] = useState<ReviewSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [coursesData, examsResult, reviewsResult] = await Promise.all([
        listCourses().catch(() => []),
        listExams(),
        listReviews(),
      ]);
      setCourses(coursesData);
      if (examsResult.ok) setExams(examsResult.data);
      if (reviewsResult.ok) setReviews(reviewsResult.data);
      setLoading(false);
    };
    load();
  }, []);

  const publishedCount = reviews.filter((r) => r.publication?.isPublished).length;
  const pendingCount = reviews.filter((r) => r.status === 'PENDING' || r.status === 'RUNNING').length;
  const totalAnnotations = reviews.reduce((sum, r) => sum + (r.annotationCount || 0), 0);

  return (
    <PageTransition>
      <div className="space-y-8">
        {/* Welcome header with brand accent */}
        <div className="relative overflow-hidden rounded-[var(--radius-xl)] border border-(--brand)/10 bg-linear-to-br from-(--brand-subtle) via-white to-(--info-subtle)/30 p-6 shadow-(--shadow-sm)">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-(--brand)/5 blur-2xl" />
          <div className="absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-(--info)/5 blur-xl" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={14} className="text-(--brand)" />
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-(--brand)">AI-Powered Grading</p>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-(--text-primary)">Dashboard</h1>
            <p className="mt-1 text-sm text-(--text-secondary) max-w-md">
              Overview of your academic grading workspace. Monitor progress and manage content.
            </p>
          </div>
        </div>

        {/* KPI Stats */}
        <StaggerGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StaggerItem>
            <StatCard label="Courses" value={loading ? '...' : courses.length} icon={<BookOpen />} />
          </StaggerItem>
          <StaggerItem>
            <StatCard label="Exams" value={loading ? '...' : exams.length} icon={<FileText />} />
          </StaggerItem>
          <StaggerItem>
            <StatCard label="Reviews" value={loading ? '...' : reviews.length} icon={<ClipboardCheck />} />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              label="Published"
              value={loading ? '...' : publishedCount}
              icon={<TrendingUp />}
              trend={reviews.length > 0 ? {
                value: `${Math.round((publishedCount / Math.max(reviews.length, 1)) * 100)}%`,
                positive: publishedCount > 0,
              } : undefined}
            />
          </StaggerItem>
        </StaggerGroup>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
          {/* Recent Reviews */}
          <FadeIn delay={0.15}>
            <Card elevated>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Recent Reviews</CardTitle>
                  <Link href="/reviews">
                    <Button variant="ghost" size="sm">
                      View all <ArrowRight size={14} className="ml-1" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-[var(--radius-md)] p-2">
                        <Skeleton className="h-10 w-10 rounded-[var(--radius-md)]" />
                        <div className="flex-1 space-y-1.5">
                          <Skeleton className="h-4 w-48" />
                          <Skeleton className="h-3 w-28" />
                        </div>
                        <Skeleton className="h-6 w-16 rounded-full" />
                      </div>
                    ))}
                  </div>
                ) : reviews.length === 0 ? (
                  <EmptyState
                    icon={<ClipboardCheck />}
                    title="No reviews yet"
                    description="Start grading submissions to see them here."
                    action={
                      <Link href="/exams">
                        <Button size="sm">Upload an exam</Button>
                      </Link>
                    }
                  />
                ) : (
                  <div className="space-y-1">
                    {reviews.slice(0, 5).map((review, i) => (
                      <Link
                        key={review.jobId}
                        href={`/reviews/${review.jobId}`}
                        className="flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 transition-all duration-200 hover:bg-(--surface-hover) group"
                        style={{ animationDelay: `${i * 50}ms` }}
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-(--surface-secondary) transition-colors group-hover:bg-(--brand-subtle)">
                          <ClipboardCheck size={15} className="text-(--text-tertiary) transition-colors group-hover:text-(--brand)" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-(--text-primary)">
                            {review.displayName || 'Untitled review'}
                          </p>
                          <p className="text-[11px] text-(--text-tertiary)">
                            {review.annotationCount} annotations
                          </p>
                        </div>
                        <StatusBadge status={review.status} size="sm" />
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </FadeIn>

          {/* Right column: Quick Actions + Active alert */}
          <div className="space-y-4">
            <FadeIn delay={0.25}>
              <div className="space-y-3">
                <p className="px-1 text-[11px] font-bold uppercase tracking-[0.12em] text-(--text-tertiary)">Quick Actions</p>
                <QuickActionCard
                  href="/courses"
                  title="Manage Courses"
                  description="Create and organize course content"
                  icon={<BookOpen size={18} />}
                />
                <QuickActionCard
                  href="/exams"
                  title="Upload Exams"
                  description="Add exam templates for grading"
                  icon={<FileText size={18} />}
                />
                <QuickActionCard
                  href="/rubrics"
                  title="Edit Rubrics"
                  description="Define grading criteria per question"
                  icon={<ClipboardCheck size={18} />}
                />
              </div>
            </FadeIn>

            {/* Active jobs alert */}
            {!loading && pendingCount > 0 && (
              <FadeIn delay={0.35}>
                <div className="rounded-[var(--radius-lg)] border border-(--warning)/20 bg-linear-to-br from-(--warning-subtle) to-white p-4 shadow-(--shadow-xs)">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-(--warning)/10 animate-pulse-brand">
                      <Activity size={14} className="text-(--warning)" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-(--text-primary)">
                        {pendingCount} active job{pendingCount > 1 ? 's' : ''}
                      </p>
                      <p className="mt-0.5 text-xs text-(--text-secondary)">
                        Grading in progress
                      </p>
                    </div>
                    <Link href="/reviews">
                      <Button size="sm" variant="secondary">View</Button>
                    </Link>
                  </div>
                </div>
              </FadeIn>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

function QuickActionCard({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <Link href={href}>
      <HoverCard className="group rounded-[var(--radius-lg)] border border-(--border) bg-(--surface) p-4 shadow-(--shadow-xs)">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-(--brand-subtle) text-(--brand) transition-all duration-250 group-hover:bg-(--brand) group-hover:text-white group-hover:shadow-(--shadow-brand)">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-(--text-primary)">{title}</h3>
            <p className="text-[11px] text-(--text-tertiary)">{description}</p>
          </div>
          <ArrowRight size={14} className="shrink-0 text-(--text-quaternary) transition-all duration-200 group-hover:text-(--brand) group-hover:translate-x-0.5" />
        </div>
      </HoverCard>
    </Link>
  );
}
