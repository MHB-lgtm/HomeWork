'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { listExams, ExamSummary } from '@/lib/examsClient';
import { listReviews, ReviewSummary } from '@/lib/reviewsClient';
import { listCourses } from '@/lib/coursesClient';
import type { Course } from '@hg/shared-schemas';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PageTransition, FadeIn, StaggerGroup, StaggerItem, HoverCard } from '@/components/ui/motion';
import {
  BookOpen,
  FileText,
  ClipboardCheck,
  ArrowRight,
  Activity,
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

  return (
    <PageTransition>
      <div className="space-y-8">
        <PageHeader
          title="Dashboard"
          description="Overview of your academic grading workspace."
        />

        {/* KPI Stats */}
        <StaggerGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StaggerItem>
            <StatCard
              label="Courses"
              value={loading ? '...' : courses.length}
              icon={<BookOpen />}
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              label="Exams"
              value={loading ? '...' : exams.length}
              icon={<FileText />}
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              label="Reviews"
              value={loading ? '...' : reviews.length}
              icon={<ClipboardCheck />}
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              label="Published"
              value={loading ? '...' : publishedCount}
              icon={<Activity />}
              trend={reviews.length > 0 ? {
                value: `${Math.round((publishedCount / Math.max(reviews.length, 1)) * 100)}%`,
                positive: publishedCount > 0,
              } : undefined}
            />
          </StaggerItem>
        </StaggerGroup>

        {/* Recent Reviews */}
        <FadeIn delay={0.15}>
          <Card>
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
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-lg" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                      <Skeleton className="h-6 w-16 rounded-full" />
                    </div>
                  ))}
                </div>
              ) : reviews.length === 0 ? (
                <p className="py-6 text-center text-sm text-(--text-tertiary)">
                  No reviews yet. Start grading to see them here.
                </p>
              ) : (
                <div className="space-y-2">
                  {reviews.slice(0, 5).map((review) => (
                    <Link
                      key={review.jobId}
                      href={`/reviews/${review.jobId}`}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-(--surface-hover)"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-(--surface-secondary)">
                        <ClipboardCheck size={16} className="text-(--text-tertiary)" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-(--text-primary)">
                          {review.displayName || 'Untitled review'}
                        </p>
                        <p className="text-xs text-(--text-tertiary)">
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

        {/* Quick Actions */}
        <FadeIn delay={0.25}>
          <div className="grid gap-4 sm:grid-cols-3">
            <QuickActionCard
              href="/courses"
              title="Manage Courses"
              description="Create and organize course content"
              icon={<BookOpen size={20} />}
            />
            <QuickActionCard
              href="/exams"
              title="Upload Exams"
              description="Add exam templates for grading"
              icon={<FileText size={20} />}
            />
            <QuickActionCard
              href="/rubrics"
              title="Edit Rubrics"
              description="Define grading criteria per question"
              icon={<ClipboardCheck size={20} />}
            />
          </div>
        </FadeIn>

        {/* Alerts */}
        {!loading && pendingCount > 0 && (
          <FadeIn delay={0.3}>
            <Card className="border-(--warning)/30 bg-(--warning-subtle)">
              <CardContent className="flex items-center gap-3 py-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-(--warning)/10">
                  <Activity size={16} className="text-(--warning)" />
                </div>
                <div>
                  <p className="text-sm font-medium text-(--text-primary)">
                    {pendingCount} review{pendingCount > 1 ? 's' : ''} in progress
                  </p>
                  <p className="text-xs text-(--text-secondary)">
                    Active grading jobs are being processed.
                  </p>
                </div>
                <div className="ml-auto">
                  <Link href="/reviews">
                    <Button size="sm" variant="secondary">View</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </FadeIn>
        )}
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
      <HoverCard className="group rounded-xl border border-(--border) bg-(--surface) p-5 shadow-(--shadow-xs) transition-all">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-(--brand-subtle) text-(--brand) transition-colors group-hover:bg-(--brand) group-hover:text-white">
            {icon}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-(--text-primary)">{title}</h3>
            <p className="mt-0.5 text-xs text-(--text-tertiary)">{description}</p>
          </div>
        </div>
      </HoverCard>
    </Link>
  );
}
