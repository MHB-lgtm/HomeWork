'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { BarChart3, Trophy, GraduationCap, TrendingUp, FileX, ChevronRight } from 'lucide-react';
import { cn } from '../../../../lib/utils';
import { StatCard } from '../../../../components/ui/stat-card';
import { PageHeader } from '../../../../components/ui/page-header';
import { Card } from '../../../../components/ui/card';
import { Badge } from '../../../../components/ui/badge';
import { Button } from '../../../../components/ui/button';
import { EmptyState } from '../../../../components/ui/empty-state';
import {
  DEMO_COURSES,
  DEMO_STUDENT,
  getPublishedAssignments,
} from '../../../../lib/demoSeed';

type SortKey = 'latest' | 'highest' | 'lowest';

function scoreColor(score: number): { border: string; text: string; bg: string } {
  if (score >= 90) return { border: 'border-(--success)', text: 'text-(--success)', bg: 'bg-(--success-subtle)' };
  if (score >= 75) return { border: 'border-(--brand)', text: 'text-(--brand)', bg: 'bg-(--brand-subtle)' };
  if (score >= 60) return { border: 'border-(--warning)', text: 'text-(--warning)', bg: 'bg-(--warning-subtle)' };
  return { border: 'border-(--error)', text: 'text-(--error)', bg: 'bg-(--error-subtle)' };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function Select({
  value,
  onChange,
  children,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'h-9 rounded-lg border border-(--border) bg-(--surface) text-sm text-(--text-primary)',
        'px-3 pr-8 appearance-none bg-no-repeat',
        'transition-colors duration-150 ease-out',
        'hover:border-(--border-hover) focus:outline-none focus:ring-2 focus:ring-(--brand)/20 focus:border-(--brand)',
        className,
      )}
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237C8198' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
        backgroundPosition: 'right 0.5rem center',
      }}
    >
      {children}
    </select>
  );
}

export default function ResultsPage() {
  const params = useParams();
  const locale = (params?.locale as string) ?? 'en';
  const studentPrefix = `/${locale}/s`;

  const [courseFilter, setCourseFilter] = useState('all');
  const [sortBy, setSortBy] = useState<SortKey>('latest');

  const enrolledCourses = DEMO_COURSES.filter((c) => DEMO_STUDENT.enrolledCourseIds.includes(c.id));
  const all = useMemo(() => getPublishedAssignments(), []);

  const filtered = useMemo(() => {
    let list = [...all];
    if (courseFilter !== 'all') {
      list = list.filter((r) => r.courseId === courseFilter);
    }
    switch (sortBy) {
      case 'latest':
        list.sort((a, b) => new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime());
        break;
      case 'highest':
        list.sort((a, b) => (b.finalScore ?? 0) - (a.finalScore ?? 0));
        break;
      case 'lowest':
        list.sort((a, b) => (a.finalScore ?? 0) - (b.finalScore ?? 0));
        break;
    }
    return list;
  }, [all, courseFilter, sortBy]);

  const grades = all.map((a) => Math.round(((a.finalScore ?? 0) / a.maxScore) * 100));
  const avg = grades.length ? Math.round(grades.reduce((s, g) => s + g, 0) / grades.length) : 0;
  const best = grades.length ? Math.max(...grades) : 0;

  return (
    <div className="space-y-12">
      <PageHeader title="Results" subtitle="Your graded assignments across all courses." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard label="Average grade" value={avg} icon={<BarChart3 />} accent="#0d9488" />
        <StatCard label="Best grade" value={best} icon={<Trophy />} accent="#16a34a" />
        <StatCard label="Total graded" value={all.length} icon={<GraduationCap />} accent="#0891b2" />
        <StatCard
          label="Trend"
          value={avg >= 80 ? 'Strong' : avg >= 70 ? 'On track' : 'Needs work'}
          icon={<TrendingUp />}
          accent="#9333ea"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={courseFilter} onChange={setCourseFilter}>
          <option value="all">All courses</option>
          {enrolledCourses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </Select>

        <Select value={sortBy} onChange={(v) => setSortBy(v as SortKey)}>
          <option value="latest">Latest</option>
          <option value="highest">Highest</option>
          <option value="lowest">Lowest</option>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<FileX />}
          title="No results found"
          description="Try changing the course filter to see your graded assignments."
          action={
            <Button variant="secondary" size="sm" onClick={() => setCourseFilter('all')}>
              Clear filter
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4">
          {filtered.map((a) => {
            const pct = Math.round(((a.finalScore ?? 0) / a.maxScore) * 100);
            const colors = scoreColor(pct);
            const courseName = DEMO_COURSES.find((c) => c.id === a.courseId)?.title ?? a.courseId;

            return (
              <Link
                key={a.id}
                href={`${studentPrefix}/courses/${a.courseId}/assignments/${a.id}/result`}
              >
                <Card hover className="flex items-center gap-5 px-6 py-5 cursor-pointer group">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium tracking-[0.12em] uppercase text-(--text-tertiary)">
                      {courseName}
                    </p>
                    <p className="mt-1.5 text-base font-medium text-(--text-primary) truncate">{a.title}</p>
                    <div className="flex items-center gap-2 mt-3">
                      <Badge variant="default" size="sm">
                        Week {a.weekNumber}
                      </Badge>
                      {a.publishedAt && (
                        <span className="text-xs text-(--text-quaternary)">
                          Published {formatDate(a.publishedAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-end hidden sm:block">
                      <p className="text-sm text-(--text-tertiary) whitespace-nowrap">
                        {a.finalScore}/{a.maxScore}
                      </p>
                    </div>

                    <div
                      className={cn(
                        'flex items-center justify-center rounded-full border-2 font-bold text-base tabular-nums',
                        colors.border,
                        colors.text,
                        colors.bg,
                      )}
                      style={{ width: 52, height: 52 }}
                    >
                      {pct}
                    </div>

                    <ChevronRight className="h-5 w-5 text-(--text-quaternary) opacity-0 group-hover:opacity-100 transition-opacity duration-150 hidden sm:block rtl:rotate-180" />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
