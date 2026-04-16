'use client';

import { useState } from 'react';
import {
  BarChart3, TrendingDown, AlertTriangle, Target,
} from 'lucide-react';
import { cn } from '../../../../lib/utils';
import { PageHeader } from '../../../../components/ui/page-header';
import { StatCard } from '../../../../components/ui/stat-card';
import { Card } from '../../../../components/ui/card';
import { Badge } from '../../../../components/ui/badge';

/* ── Mock Data ── */

const courseOptions = [
  { id: 'all', name: 'All Courses' },
  { id: 'c1', name: 'Linear Algebra' },
  { id: 'c2', name: 'Calculus II' },
  { id: 'c3', name: 'Physics I' },
];

const gradeDistribution = [
  { range: '90-100', count: 24, pct: 19 },
  { range: '80-89', count: 38, pct: 30 },
  { range: '70-79', count: 32, pct: 25 },
  { range: '60-69', count: 21, pct: 17 },
  { range: '<60', count: 12, pct: 9 },
];

const weeklyAverages = [
  { week: 1, avg: 74 },
  { week: 2, avg: 78 },
  { week: 3, avg: 80 },
  { week: 4, avg: 85 },
  { week: 5, avg: 82 },
];

const weakTopics = [
  { topic: 'Matrix Multiplication Order', score: 58, course: 'Linear Algebra', submissions: 45 },
  { topic: 'Integration by Parts Setup', score: 62, course: 'Calculus II', submissions: 52 },
  { topic: 'Free Body Diagram Forces', score: 65, course: 'Physics I', submissions: 30 },
  { topic: 'Eigenvalue Computation', score: 67, course: 'Linear Algebra', submissions: 38 },
  { topic: 'Polar Coordinates Conversion', score: 69, course: 'Calculus II', submissions: 41 },
];

const studentsAtRisk = [
  { name: 'Tom Shapira', course: 'Linear Algebra', avgScore: 52, trend: 'declining' },
  { name: 'Eli Rosen', course: 'Linear Algebra', avgScore: 55, trend: 'stable' },
  { name: 'Lior Katz', course: 'Calculus II', avgScore: 58, trend: 'declining' },
  { name: 'Amit Ben-Ari', course: 'Physics I', avgScore: 60, trend: 'improving' },
];

/* ── Component ── */

export default function AnalyticsPage() {
  const [selectedCourse, setSelectedCourse] = useState('all');

  const selectClass = cn(
    'h-9 rounded-lg border border-(--border) bg-(--surface) px-3 text-sm text-(--text-primary)',
    'transition-colors focus-visible:outline-none focus-visible:border-(--border-focus) focus-visible:ring-1 focus-visible:ring-(--border-focus)',
  );

  return (
    <div className="space-y-12">
      <PageHeader title="Analytics" subtitle="Insights into student performance and grading trends.">
        <select
          value={selectedCourse}
          onChange={(e) => setSelectedCourse(e.target.value)}
          className={selectClass}
        >
          {courseOptions.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </PageHeader>

      {/* Stat Cards */}
      <div className="grid gap-5 sm:grid-cols-3">
        <StatCard label="Class Average" value={78} trend={{ value: '+3.2', positive: true }} accent="#0d9488" />
        <StatCard label="Submissions Rate" value="89%" accent="#0891b2" />
        <StatCard label="Improvement" value="+3.2" trend={{ value: '+3.2', positive: true }} accent="#16a34a" />
      </div>

      {/* Charts Row */}
      <div className="grid gap-7 lg:grid-cols-2">
        {/* Grade Distribution */}
        <Card padding="lg">
          <div className="mb-7 flex items-center gap-2.5">
            <BarChart3 className="h-5 w-5 text-(--brand)" />
            <h3 className="text-lg font-semibold text-(--text-primary)">Grade Distribution</h3>
          </div>
          <div className="space-y-5">
            {gradeDistribution.map((g, i) => (
              <div key={g.range}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-(--text-secondary)">{g.range}</span>
                  <span className="text-(--text-quaternary) tabular-nums">{g.count} ({g.pct}%)</span>
                </div>
                <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-(--surface-secondary)">
                  <div
                    className="h-full rounded-full bg-(--brand) transition-all duration-500"
                    style={{ width: `${Math.max(g.pct, 3)}%`, opacity: 1 - (i * 0.15) }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Weekly Trend */}
        <Card padding="lg">
          <div className="mb-7 flex items-center gap-2.5">
            <Target className="h-5 w-5 text-(--brand)" />
            <h3 className="text-lg font-semibold text-(--text-primary)">Weekly Average Trend</h3>
          </div>
          <div className="flex items-end gap-4" style={{ height: 200 }}>
            {weeklyAverages.map((w) => (
              <div key={w.week} className="flex flex-1 flex-col items-center gap-2.5">
                <span className="text-sm font-semibold tabular-nums text-(--text-primary)">{w.avg}</span>
                <div
                  className="w-full rounded-t-lg bg-(--brand) transition-all duration-500"
                  style={{ height: `${(w.avg / 100) * 100}%` }}
                />
                <span className="text-xs font-medium text-(--text-quaternary)">W{w.week}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid gap-7 lg:grid-cols-2">
        {/* Weakest Topics */}
        <Card padding="lg">
          <div className="mb-7 flex items-center gap-2.5">
            <TrendingDown className="h-5 w-5 text-(--error)" />
            <h3 className="text-lg font-semibold text-(--text-primary)">Weakest Topics</h3>
          </div>
          <div className="space-y-5">
            {weakTopics.map((t) => (
              <div key={t.topic} className="flex items-center gap-4">
                <Badge
                  variant={t.score < 60 ? 'error' : t.score < 70 ? 'warning' : 'default'}
                  size="sm"
                  className="w-11 justify-center tabular-nums"
                >
                  {t.score}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-(--text-primary)">{t.topic}</p>
                  <p className="mt-0.5 text-xs text-(--text-tertiary)">{t.course}</p>
                </div>
                <div className="hidden sm:block shrink-0">
                  <div className="h-2 w-24 overflow-hidden rounded-full bg-(--surface-secondary)">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        t.score < 60 ? 'bg-(--error)' : t.score < 70 ? 'bg-(--warning)' : 'bg-(--text-tertiary)',
                      )}
                      style={{ width: `${t.score}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Students at Risk */}
        <Card padding="lg">
          <div className="mb-7 flex items-center gap-2.5">
            <AlertTriangle className="h-5 w-5 text-(--warning)" />
            <h3 className="text-lg font-semibold text-(--text-primary)">Students at Risk</h3>
          </div>
          <div className="space-y-4">
            {studentsAtRisk.map((s) => (
              <div
                key={s.name}
                className="flex items-center gap-4 rounded-xl border border-(--border-light) bg-(--surface-secondary)/30 px-5 py-4"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-(--surface-secondary) text-sm font-semibold text-(--text-secondary)">
                  {s.name.split(' ').map((n) => n[0]).join('')}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-(--text-primary)">{s.name}</p>
                  <p className="mt-0.5 text-xs text-(--text-tertiary)">{s.course}</p>
                </div>
                <div className="text-end shrink-0">
                  <Badge variant={s.avgScore < 60 ? 'error' : 'warning'} size="sm" className="tabular-nums">
                    {s.avgScore}
                  </Badge>
                  <p className={cn(
                    'mt-1 text-[11px] font-medium',
                    s.trend === 'declining' ? 'text-(--error)' :
                    s.trend === 'improving' ? 'text-(--success)' :
                    'text-(--text-quaternary)',
                  )}>
                    {s.trend.charAt(0).toUpperCase() + s.trend.slice(1)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
