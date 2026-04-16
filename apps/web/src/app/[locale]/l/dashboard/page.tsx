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
      <div className="space-y-12">
        {/* Header — gradient hero per spec §8.3 */}
        <PageHeader
          gradient
          icon={<ClipboardCheck />}
          eyebrow={<><Sparkles size={12} /> Lecturer Dashboard</>}
          title="Submission Queue"
          subtitle="Monitor all student submissions, track grading progress, and manage reviews from one place."
          actions={
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-full bg-white/20 backdrop-blur-sm px-5 py-2.5 text-sm font-medium text-white hover:bg-white/30 transition disabled:opacity-60"
            >
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
          }
        />

        {error && (
          <Alert variant="error">
            <AlertTitle>Failed to load dashboard</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Stats Row */}
        <StaggerGroup className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          <StaggerItem>
            <StatCard label="Total" value={loading ? '...' : stats.total} icon={<Inbox />} accent="#0d9488" />
          </StaggerItem>
          <StaggerItem>
            <StatCard label="Submitted" value={loading ? '...' : stats.submitted} icon={<Send />} accent="#0891b2" />
          </StaggerItem>
          <StaggerItem>
            <StatCard label="Processing" value={loading ? '...' : stats.processing} icon={<Loader2 />} accent="#f59e0b" />
          </StaggerItem>
          <StaggerItem>
            <StatCard label="Ready" value={loading ? '...' : stats.readyForReview} icon={<ClipboardCheck />} accent="#16a34a" />
          </StaggerItem>
          <StaggerItem>
            <StatCard label="Published" value={loading ? '...' : stats.published} icon={<CheckCircle2 />} accent="#9333ea" />
          </StaggerItem>
        </StaggerGroup>

        {/* Search + Filters card */}
        <FadeIn delay={0.1}>
          <div className="rounded-2xl border border-(--border) bg-(--surface) px-7 py-8 shadow-sm space-y-6">
            <div className="max-w-lg">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search submissions, students, courses..."
                icon={<Search />}
              />
            </div>
            <div className="flex flex-wrap gap-2.5">
              {STATUS_OPTIONS.map((opt) => {
                const active = statusFilter === opt.value;
                const count = opt.value === 'SUBMITTED' ? stats.submitted
                  : opt.value === 'PROCESSING' ? stats.processing
                  : opt.value === 'READY_FOR_REVIEW' ? stats.readyForReview
                  : opt.value === 'PUBLISHED' ? stats.published
                  : null;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setStatusFilter(opt.value)}
                    className={cn(
                      'px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap',
                      active
                        ? 'bg-(--brand-subtle) text-(--brand-hover)'
                        : 'bg-(--surface-secondary) text-(--text-secondary) hover:bg-(--surface-tertiary)'
                    )}
                  >
                    {opt.label}
                    {count !== null && data && (
                      <span className="ms-2 opacity-70 tabular-nums">{count}</span>
                    )}
                  </button>
                );
              })}
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
                <table className="w-full min-w-220 text-sm">
                  <thead>
                    <tr className="border-b border-(--border) bg-linear-to-b from-(--surface-secondary)/70 to-(--surface-secondary) sticky top-0 z-10">
                      <th className="px-6 py-4 text-start text-[12px] font-bold uppercase tracking-[0.1em] text-(--text-tertiary)">Submission</th>
                      <th className="px-6 py-4 text-start text-[12px] font-bold uppercase tracking-[0.1em] text-(--text-tertiary)">Course</th>
                      <th className="px-6 py-4 text-start text-[12px] font-bold uppercase tracking-[0.1em] text-(--text-tertiary)">Submitted</th>
                      <th className="px-6 py-4 text-start text-[12px] font-bold uppercase tracking-[0.1em] text-(--text-tertiary)">Status</th>
                      <th className="px-6 py-4 text-start text-[12px] font-bold uppercase tracking-[0.1em] text-(--text-tertiary)">Score</th>
                      <th className="px-5 py-3.5 text-end text-[12px] font-bold uppercase tracking-[0.08em] text-(--text-tertiary)">Actions</th>
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
      <td className="px-6 py-6">
        <div className="min-w-0 max-w-80">
          <p className="text-[14px] font-medium text-(--text-primary) truncate">
            {row.displayName || row.assignmentTitle || 'Untitled'}
          </p>
          {row.annotationCount > 0 && (
            <p className="text-[12px] text-(--text-tertiary) mt-0.5">{row.annotationCount} annotations</p>
          )}
        </div>
      </td>

      {/* Course */}
      <td className="px-6 py-6">
        <span className="text-[14px] text-(--text-secondary) truncate max-w-48 block">
          {row.courseName || '-'}
        </span>
      </td>

      {/* Submitted date */}
      <td className="px-6 py-6">
        <span className="text-[14px] text-(--text-secondary) whitespace-nowrap">
          {formatDate(row.submittedAt)}
        </span>
      </td>

      {/* Status */}
      <td className="px-6 py-6">
        <div className="flex items-center gap-2">
          <StatusBadge status={statusToKey(row.status)} label={statusLabel(row.status)} size="sm" />
          {isProcessing && <Loader2 size={14} className="animate-spin text-(--info)" />}
        </div>
      </td>

      {/* Score */}
      <td className="px-6 py-6">
        {row.score !== null && row.maxScore !== null ? (
          <Badge variant="brand" size="sm">{row.score}/{row.maxScore}</Badge>
        ) : (
          <span className="text-[14px] text-(--text-quaternary)">-</span>
        )}
      </td>

      {/* Actions */}
      <td className="px-6 py-6 text-end">
        <div className="flex items-center justify-end gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
          {canReview ? (
            <Link href={`/reviews/${row.jobId}`}>
              <Button size="sm" icon={<ArrowRight size={14} className="rtl:rotate-180" />}>
                Review
              </Button>
            </Link>
          ) : (
            <Link href={`/reviews/${row.jobId}`}>
              <Button size="sm" variant="secondary" icon={<Eye size={14} />} disabled={row.status === 'SUBMITTED'}>
                View
              </Button>
            </Link>
          )}
        </div>
      </td>
    </tr>
  );
}
