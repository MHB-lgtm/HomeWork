'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { BarChart3, Trophy, GraduationCap, TrendingUp, FileX, ChevronRight } from 'lucide-react';
import { cn } from '../../../../lib/utils';
import { StatCard } from '../../../../components/ui/stat-card';
import { PageHeader } from '../../../../components/ui/page-header';
import { Card } from '../../../../components/ui/card';
import { Badge } from '../../../../components/ui/badge';
import { Button } from '../../../../components/ui/button';
import { EmptyState } from '../../../../components/ui/empty-state';

/* ── Types ── */

interface ResultEntry {
  id: string;
  courseId: string;
  courseName: string;
  assignmentId: string;
  assignmentTitle: string;
  weekNumber: number;
  score: number;
  gradedAt: string;
}

type SortKey = 'latest' | 'highest' | 'lowest';

/* ── Mock Data ── */

const MOCK_RESULTS: ResultEntry[] = [
  {
    id: '1',
    courseId: 'la-101',
    courseName: 'Linear Algebra',
    assignmentId: 'hw-5',
    assignmentTitle: 'Matrix Operations & Determinants',
    weekNumber: 5,
    score: 85,
    gradedAt: '2026-03-25T14:30:00Z',
  },
  {
    id: '2',
    courseId: 'la-101',
    courseName: 'Linear Algebra',
    assignmentId: 'hw-4',
    assignmentTitle: 'Vector Spaces & Subspaces',
    weekNumber: 4,
    score: 92,
    gradedAt: '2026-03-18T10:15:00Z',
  },
  {
    id: '3',
    courseId: 'la-101',
    courseName: 'Linear Algebra',
    assignmentId: 'hw-3',
    assignmentTitle: 'Systems of Linear Equations',
    weekNumber: 3,
    score: 78,
    gradedAt: '2026-03-11T09:45:00Z',
  },
  {
    id: '4',
    courseId: 'calc-102',
    courseName: 'Calculus II',
    assignmentId: 'hw-7',
    assignmentTitle: 'Integration Techniques',
    weekNumber: 7,
    score: 95,
    gradedAt: '2026-03-23T16:00:00Z',
  },
  {
    id: '5',
    courseId: 'calc-102',
    courseName: 'Calculus II',
    assignmentId: 'hw-6',
    assignmentTitle: 'Taylor Series Expansions',
    weekNumber: 6,
    score: 72,
    gradedAt: '2026-03-16T11:30:00Z',
  },
  {
    id: '6',
    courseId: 'phys-101',
    courseName: 'Physics I',
    assignmentId: 'hw-4',
    assignmentTitle: 'Newtonian Mechanics',
    weekNumber: 4,
    score: 88,
    gradedAt: '2026-03-22T13:20:00Z',
  },
  {
    id: '7',
    courseId: 'phys-101',
    courseName: 'Physics I',
    assignmentId: 'hw-3',
    assignmentTitle: 'Energy & Momentum Conservation',
    weekNumber: 3,
    score: 64,
    gradedAt: '2026-03-15T14:00:00Z',
  },
  {
    id: '8',
    courseId: 'la-101',
    courseName: 'Linear Algebra',
    assignmentId: 'hw-2',
    assignmentTitle: 'Eigenvalues & Eigenvectors',
    weekNumber: 2,
    score: 82,
    gradedAt: '2026-03-04T08:30:00Z',
  },
];

/* ── Helpers ── */

function scoreColor(score: number): {
  border: string;
  text: string;
  bg: string;
} {
  if (score >= 90) return { border: 'border-(--success)', text: 'text-(--success)', bg: 'bg-(--success-subtle)' };
  if (score >= 75) return { border: 'border-(--brand)', text: 'text-(--brand)', bg: 'bg-(--brand-subtle)' };
  if (score >= 60) return { border: 'border-(--warning)', text: 'text-(--warning)', bg: 'bg-(--warning-subtle)' };
  return { border: 'border-(--error)', text: 'text-(--error)', bg: 'bg-(--error-subtle)' };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/* ── Select component (shared styling) ── */

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

/* ── Page ── */

export default function ResultsPage() {
  const [courseFilter, setCourseFilter] = useState('all');
  const [sortBy, setSortBy] = useState<SortKey>('latest');

  const filtered = useMemo(() => {
    let list = [...MOCK_RESULTS];

    if (courseFilter !== 'all') {
      list = list.filter((r) => r.courseName === courseFilter);
    }

    switch (sortBy) {
      case 'latest':
        list.sort((a, b) => new Date(b.gradedAt).getTime() - new Date(a.gradedAt).getTime());
        break;
      case 'highest':
        list.sort((a, b) => b.score - a.score);
        break;
      case 'lowest':
        list.sort((a, b) => a.score - b.score);
        break;
    }

    return list;
  }, [courseFilter, sortBy]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <PageHeader title="Results" subtitle="Your graded assignments" />

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Average Grade"
          value={82}
          icon={<BarChart3 />}
        />
        <StatCard
          label="Best Grade"
          value={95}
          icon={<Trophy />}
        />
        <StatCard
          label="Total Graded"
          value={8}
          icon={<GraduationCap />}
        />
        <StatCard
          label="Trend"
          value="+4.2"
          trend={{ value: '+4.2', positive: true }}
          icon={<TrendingUp />}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={courseFilter} onChange={setCourseFilter}>
          <option value="all">All Courses</option>
          <option value="Linear Algebra">Linear Algebra</option>
          <option value="Calculus II">Calculus II</option>
          <option value="Physics I">Physics I</option>
        </Select>

        <Select value={sortBy} onChange={(v) => setSortBy(v as SortKey)}>
          <option value="latest">Latest</option>
          <option value="highest">Highest</option>
          <option value="lowest">Lowest</option>
        </Select>
      </div>

      {/* Results list */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<FileX />}
          title="No results found"
          description="Try changing the course filter to see your graded assignments."
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCourseFilter('all')}
            >
              Clear filter
            </Button>
          }
        />
      ) : (
        <div className="grid gap-2">
          {filtered.map((r) => {
            const colors = scoreColor(r.score);

            return (
              <Link
                key={r.id}
                href={`/s/courses/${r.courseId}/assignments/${r.assignmentId}/result`}
              >
                <Card
                  hover
                  className="flex items-center gap-4 p-4 cursor-pointer group"
                >
                  {/* Left: info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-(--text-tertiary)">
                      {r.courseName}
                    </p>
                    <p className="text-sm font-medium text-(--text-primary) truncate mt-0.5">
                      {r.assignmentTitle}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge variant="default" size="sm">
                        Week {r.weekNumber}
                      </Badge>
                    </div>
                  </div>

                  {/* Right: score + date */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-(--text-tertiary)">
                        {formatDate(r.gradedAt)}
                      </p>
                    </div>

                    <div
                      className={cn(
                        'flex items-center justify-center rounded-full border-2 font-semibold text-sm',
                        colors.border,
                        colors.text,
                        colors.bg,
                      )}
                      style={{ width: 44, height: 44 }}
                    >
                      {r.score}
                    </div>

                    <ChevronRight className="h-4 w-4 text-(--text-quaternary) opacity-0 group-hover:opacity-100 transition-opacity duration-150 hidden sm:block" />
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
