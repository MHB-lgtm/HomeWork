'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  fetchLecturerDashboard,
  type DashboardData,
  type DashboardStats,
  type SubmissionRow,
  type SubmissionStatus,
} from '../../../../lib/lecturerDashboardClient';
import { PageHeader } from '../../../../components/ui/page-header';
import { StatCard } from '../../../../components/ui/stat-card';
import { Badge } from '../../../../components/ui/badge';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '../../../../components/ui/alert';
import { EmptyState } from '../../../../components/ui/empty-state';
import { Skeleton, SkeletonTable } from '../../../../components/ui/skeleton';
import { StatusBadge } from '../../../../components/ui/status-badge';
import { PageTransition, FadeIn, StaggerGroup, StaggerItem } from '../../../../components/ui/motion';
import { cn } from '../../../../lib/utils';
import {
  Inbox,
  Clock,
  Loader2,
  CheckCircle2,
  Send,
  Search,
  ArrowRight,
  Eye,
  RefreshCw,
  Filter,
  ClipboardCheck,
  Sparkles,
} from 'lucide-react';

type StatusFilter = 'ALL' | SubmissionStatus;

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'READY_FOR_REVIEW', label: 'Ready' },
  { value: 'PUBLISHED', label: 'Published' },
];

const statusToKey = (status: SubmissionStatus) => {
  switch (status) {
    case 'SUBMITTED': return 'pending';
    case 'PROCESSING': return 'active';
    case 'READY_FOR_REVIEW': return 'review';
    case 'PUBLISHED': return 'published';
  }
};

const statusLabel = (status: SubmissionStatus) => {
  switch (status) {
    case 'SUBMITTED': return 'Submitted';
    case 'PROCESSING': return 'Processing';
    case 'READY_FOR_REVIEW': return 'Ready for review';
    case 'PUBLISHED': return 'Published';
  }
};

const formatDate = (value: string | null) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export default function LecturerDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const result = await fetchLecturerDashboard();

    if (result.ok) {
      setData(result.data);
      setError(null);
    } else {
      setError(result.error);
    }

    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { loadData(); }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.submissions.filter((row) => {
      if (statusFilter !== 'ALL' && row.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (row.studentName && row.studentName.toLowerCase().includes(q)) ||
        (row.displayName && row.displayName.toLowerCase().includes(q)) ||
        (row.courseName && row.courseName.toLowerCase().includes(q)) ||
        (row.assignmentTitle && row.assignmentTitle.toLowerCase().includes(q)) ||
        row.jobId.toLowerCase().includes(q)
      );
    });
  }, [data, query, statusFilter]);

  const stats = data?.stats ?? { total: 0, submitted: 0, processing: 0, readyForReview: 0, published: 0 };

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-[var(--radius-xl)] border border-(--brand)/10 bg-linear-to-br from-(--brand-subtle) via-white to-(--info-subtle)/30 p-6 shadow-(--shadow-sm)">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-(--brand)/5 blur-2xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={14} className="text-(--brand)" />
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-(--brand)">Lecturer Dashboard</p>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-(--text-primary)">Submission Queue</h1>
              <p className="mt-1 text-sm text-(--text-secondary) max-w-md">
                Monitor all student submissions, track grading progress, and manage reviews from one place.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />}
              onClick={() => loadData(true)}
              disabled={refreshing}
            >
              Refresh
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="error">
            <AlertTitle>Failed to load dashboard</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Stats Row */}
        <StaggerGroup className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StaggerItem>
            <StatCard label="Total" value={loading ? '...' : stats.total} icon={<Inbox />} />
          </StaggerItem>
          <StaggerItem>
            <StatCard label="Submitted" value={loading ? '...' : stats.submitted} icon={<Send />} />
          </StaggerItem>
          <StaggerItem>
            <StatCard label="Processing" value={loading ? '...' : stats.processing} icon={<Loader2 />} />
          </StaggerItem>
          <StaggerItem>
            <StatCard label="Ready" value={loading ? '...' : stats.readyForReview} icon={<ClipboardCheck />} />
          </StaggerItem>
          <StaggerItem>
            <StatCard label="Published" value={loading ? '...' : stats.published} icon={<CheckCircle2 />} />
          </StaggerItem>
        </StaggerGroup>

        {/* Filters */}
        <FadeIn delay={0.1}>
          <div className="flex flex-wrap items-center gap-3">
            {/* Status filter pills */}
            <div className="flex items-center gap-1 rounded-[var(--radius-md)] border border-(--border) bg-(--surface) p-1 shadow-(--shadow-xs)">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setStatusFilter(opt.value)}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-[11px] font-semibold transition-all duration-200',
                    statusFilter === opt.value
                      ? 'bg-(--brand) text-white shadow-(--shadow-brand)'
                      : 'text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--surface-hover)'
                  )}
                >
                  {opt.label}
                  {opt.value !== 'ALL' && data && (
                    <span className="ml-1 opacity-70">
                      {opt.value === 'SUBMITTED' ? stats.submitted
                        : opt.value === 'PROCESSING' ? stats.processing
                        : opt.value === 'READY_FOR_REVIEW' ? stats.readyForReview
                        : stats.published}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="flex-1 min-w-50 max-w-xs">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search submissions..."
                icon={<Search size={14} />}
              />
            </div>
          </div>
        </FadeIn>

        {/* Submission Table */}
        <FadeIn delay={0.15}>
          {loading ? (
            <SkeletonTable columns={6} rows={8} />
          ) : filtered.length === 0 ? (
            <div className="rounded-[var(--radius-lg)] border border-(--border) bg-(--surface) shadow-(--shadow-xs)">
              <EmptyState
                icon={<ClipboardCheck />}
                title={statusFilter === 'ALL' && !query ? 'No submissions yet' : 'No matching submissions'}
                description={
                  statusFilter === 'ALL' && !query
                    ? 'Student submissions will appear here once they start submitting work.'
                    : 'Try adjusting your filters or search query.'
                }
              />
            </div>
          ) : (
            <div className="overflow-hidden rounded-[var(--radius-lg)] border border-(--border) bg-(--surface) shadow-(--shadow-xs)">
              <div className="overflow-x-auto">
                <table className="w-full min-w-200 text-sm">
                  <thead>
                    <tr className="border-b border-(--border) bg-linear-to-b from-(--surface-secondary)/70 to-(--surface-secondary) sticky top-0 z-10">
                      <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-(--text-tertiary)">Submission</th>
                      <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-(--text-tertiary)">Course</th>
                      <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-(--text-tertiary)">Submitted</th>
                      <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-(--text-tertiary)">Status</th>
                      <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-(--text-tertiary)">Score</th>
                      <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-[0.08em] text-(--text-tertiary)">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row) => (
                      <SubmissionTableRow key={row.jobId} row={row} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </FadeIn>

        {/* Summary footer */}
        {!loading && filtered.length > 0 && (
          <FadeIn delay={0.2}>
            <div className="flex items-center justify-between px-1 text-xs text-(--text-tertiary)">
              <span>Showing {filtered.length} of {data?.submissions.length ?? 0} submissions</span>
              <span>{stats.readyForReview} ready for review</span>
            </div>
          </FadeIn>
        )}
      </div>
    </PageTransition>
  );
}

function SubmissionTableRow({ row }: { row: SubmissionRow }) {
  const canReview = row.status === 'READY_FOR_REVIEW' || row.status === 'PUBLISHED';
  const isProcessing = row.status === 'PROCESSING';

  return (
    <tr className="border-b border-(--border-light) last:border-0 transition-colors duration-200 hover:bg-(--surface-hover) group">
      {/* Submission name */}
      <td className="px-4 py-3.5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-(--text-primary) truncate max-w-60">
            {row.displayName || row.assignmentTitle || 'Untitled'}
          </p>
          {row.annotationCount > 0 && (
            <p className="text-[11px] text-(--text-tertiary) mt-0.5">{row.annotationCount} annotations</p>
          )}
        </div>
      </td>

      {/* Course */}
      <td className="px-4 py-3.5">
        <span className="text-sm text-(--text-secondary) truncate max-w-40 block">
          {row.courseName || '-'}
        </span>
      </td>

      {/* Submitted date */}
      <td className="px-4 py-3.5">
        <span className="text-sm text-(--text-secondary) whitespace-nowrap">
          {formatDate(row.submittedAt)}
        </span>
      </td>

      {/* Status */}
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-1.5">
          <StatusBadge status={statusToKey(row.status)} label={statusLabel(row.status)} size="sm" />
          {isProcessing && <Loader2 size={12} className="animate-spin text-(--info)" />}
        </div>
      </td>

      {/* Score */}
      <td className="px-4 py-3.5">
        {row.score !== null && row.maxScore !== null ? (
          <Badge variant="brand" size="sm">{row.score}/{row.maxScore}</Badge>
        ) : (
          <span className="text-sm text-(--text-quaternary)">-</span>
        )}
      </td>

      {/* Actions */}
      <td className="px-4 py-3.5 text-right">
        <div className="flex items-center justify-end gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
          {canReview ? (
            <Link href={`/reviews/${row.jobId}`}>
              <Button size="sm" icon={<ArrowRight size={12} />}>
                Review
              </Button>
            </Link>
          ) : (
            <Link href={`/reviews/${row.jobId}`}>
              <Button size="sm" variant="secondary" icon={<Eye size={12} />} disabled={row.status === 'SUBMITTED'}>
                View
              </Button>
            </Link>
          )}
        </div>
      </td>
    </tr>
  );
}
