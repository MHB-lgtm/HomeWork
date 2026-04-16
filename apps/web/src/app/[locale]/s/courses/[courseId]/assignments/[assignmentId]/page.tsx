'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  FileText,
  Upload,
  RefreshCw,
  CheckCircle2,
  Clock,
  Lock,
  AlertTriangle,
  Sparkles,
  ChevronRight,
  Eye,
  Calendar,
  PenSquare,
  Cpu,
  Trash2,
} from 'lucide-react';
import { cn } from '../../../../../../../lib/utils';
import { PageHeader } from '../../../../../../../components/ui/page-header';
import { Card } from '../../../../../../../components/ui/card';
import { Badge } from '../../../../../../../components/ui/badge';
import { Button } from '../../../../../../../components/ui/button';
import { StatusBadge } from '../../../../../../../components/ui/status-badge';
import {
  getAssignment,
  getCourseOrFallback,
  getWeek,
  STATUS_LABEL,
  STATUS_DESCRIPTION,
  statusBadgeTone,
  isSubmissionAllowed,
} from '../../../../../../../lib/demoSeed';

/* ─────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────── */

function formatDateTime(iso?: string): string {
  if (!iso) return '\u2014';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatRelativeDeadline(iso: string): { label: string; tone: 'safe' | 'warn' | 'late' } {
  const ms = new Date(iso).getTime() - Date.now();
  const hours = Math.round(ms / (1000 * 60 * 60));
  if (ms <= 0) return { label: 'Past deadline', tone: 'late' };
  if (hours < 24) return { label: `${hours}h left`, tone: 'warn' };
  const days = Math.round(hours / 24);
  if (days <= 3) return { label: `${days}d left`, tone: 'warn' };
  return { label: `${days}d left`, tone: 'safe' };
}

/* ─────────────────────────────────────────────
   Page
   ───────────────────────────────────────────── */

export default function StudentAssignmentLandingPage() {
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;
  const courseId = params.courseId as string;
  const assignmentId = params.assignmentId as string;
  const studentPrefix = `/${locale}/s`;

  const assignment = getAssignment(assignmentId);
  const course = getCourseOrFallback(courseId);
  const week = assignment ? getWeek(assignment.weekId) : undefined;

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const deadlineInfo = useMemo(
    () => (assignment ? formatRelativeDeadline(assignment.deadline) : null),
    [assignment],
  );

  if (!assignment) {
    return (
      <div className="space-y-6">
        <PageHeader
          backHref={`${studentPrefix}/courses/${courseId}`}
          title="Assignment not found"
          subtitle="This assignment is no longer available or has been removed."
        />
        <Card padding="lg" className="text-center">
          <p className="text-sm text-(--text-tertiary)">
            Return to the course page to see the current assignments.
          </p>
        </Card>
      </div>
    );
  }

  const canSubmit = isSubmissionAllowed(assignment.status);
  const hasSubmission = !!assignment.submittedAt;
  const showResultLink = assignment.status === 'PUBLISHED';
  const workspaceHref = `${studentPrefix}/courses/${courseId}/assignments/${assignment.id}/workspace`;
  const resultHref = `${studentPrefix}/courses/${courseId}/assignments/${assignment.id}/result`;

  function handleFilePick(file: File) {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      alert('Please upload a PDF file.');
      return;
    }
    setPendingFile(file);
    if (hasSubmission) {
      setConfirmReplace(true);
    }
  }

  function handleConfirmSubmit() {
    setConfirmReplace(false);
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    router.push(workspaceHref);
  }

  return (
    <div className="space-y-12">
      <PageHeader
        backHref={`${studentPrefix}/courses/${courseId}`}
        eyebrow={`${course.code} \u00b7 Week ${assignment.weekNumber}`}
        title={assignment.title}
        subtitle={course.title}
        gradient
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 backdrop-blur-sm px-3 py-1.5 text-xs font-semibold text-white">
              <Calendar className="h-3.5 w-3.5" /> Due {formatDateTime(assignment.deadline)}
            </span>
            {deadlineInfo && (
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold',
                  deadlineInfo.tone === 'safe' && 'bg-white/20 text-white',
                  deadlineInfo.tone === 'warn' && 'bg-amber-200 text-amber-900',
                  deadlineInfo.tone === 'late' && 'bg-rose-200 text-rose-900',
                )}
              >
                <Clock className="h-3.5 w-3.5" />
                {deadlineInfo.label}
              </span>
            )}
          </div>
        }
      />

      {/* Status banner */}
      <Card padding="lg" className="overflow-hidden">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4 min-w-0">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-(--brand-subtle) text-(--brand)">
              {statusIcon(assignment.status)}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <StatusBadge status={statusBadgeTone(assignment.status)} label={STATUS_LABEL[assignment.status]} />
                {assignment.status === 'PROCESSING' && assignment.processingProgress != null && (
                  <span className="text-xs font-semibold tabular-nums text-(--text-secondary)">
                    {Math.round(assignment.processingProgress * 100)}%
                  </span>
                )}
              </div>
              <p className="mt-2 text-[15px] font-semibold text-(--text-primary)">
                {STATUS_DESCRIPTION[assignment.status]}
              </p>
              {assignment.status === 'PROCESSING' && assignment.processingEtaMinutes != null && (
                <p className="mt-1 text-xs text-(--text-tertiary)">
                  Estimated time remaining: ~{assignment.processingEtaMinutes} min.
                </p>
              )}
              {assignment.status === 'PUBLISHED' && assignment.publishedAt && (
                <p className="mt-1 text-xs text-(--text-tertiary)">
                  Published {formatDateTime(assignment.publishedAt)}.
                </p>
              )}
              {assignment.status === 'CLOSED' && (
                <p className="mt-1 text-xs text-(--text-tertiary)">
                  Deadline was {formatDateTime(assignment.deadline)}.
                </p>
              )}
            </div>
          </div>

          {showResultLink && (
            <Link href={resultHref} className="shrink-0">
              <Button variant="primary" size="md">
                View result
                <ChevronRight className="ms-1 h-4 w-4 rtl:rotate-180" />
              </Button>
            </Link>
          )}
        </div>

        {assignment.status === 'PROCESSING' && assignment.processingProgress != null && (
          <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-(--surface-tertiary)">
            <div
              className="h-full rounded-full bg-(--brand) transition-all duration-700"
              style={{ width: `${Math.round(assignment.processingProgress * 100)}%` }}
            />
          </div>
        )}
      </Card>

      <div className="grid gap-7 xl:grid-cols-[1fr_360px]">
        {/* ── Left column: instructions + submission ── */}
        <div className="space-y-7 min-w-0">
          {/* Instructions */}
          <Card padding="lg">
            <div className="flex items-start gap-3 mb-5">
              <FileText className="h-5 w-5 text-(--brand) shrink-0 mt-0.5" />
              <div>
                <h2 className="text-lg font-semibold text-(--text-primary) leading-tight">Assignment overview</h2>
                {week && (
                  <p className="mt-1 text-sm text-(--text-tertiary)">
                    Week {week.number}: {week.title}
                  </p>
                )}
              </div>
            </div>
            <p className="text-sm leading-relaxed text-(--text-secondary)">{assignment.description}</p>

            {assignment.questions.length > 0 && (
              <div className="mt-7">
                <p className="label-micro mb-3">Question breakdown</p>
                <ul className="divide-y divide-(--border-light) rounded-xl border border-(--border-light) bg-(--surface-secondary)/40">
                  {assignment.questions.map((q) => (
                    <li key={q.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <span className="flex items-center gap-3 min-w-0">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-(--brand-subtle) text-xs font-bold text-(--brand)">
                          Q{q.id}
                        </span>
                        <span className="truncate text-sm font-medium text-(--text-primary)">{q.title}</span>
                      </span>
                      <span className="shrink-0 text-xs font-semibold tabular-nums text-(--text-tertiary)">
                        {q.maxPoints} pts
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          {/* Submission section */}
          <Card padding="lg">
            <div className="flex items-start gap-3 mb-5">
              <Upload className="h-5 w-5 text-(--brand) shrink-0 mt-0.5" />
              <div>
                <h2 className="text-lg font-semibold text-(--text-primary) leading-tight">Your submission</h2>
                <p className="mt-1 text-sm text-(--text-tertiary)">
                  Upload a PDF and continue working in the assignment workspace.
                </p>
              </div>
            </div>

            {hasSubmission ? (
              <div className="rounded-2xl border border-(--border-light) bg-(--surface-secondary)/60 p-5">
                <div className="flex items-start gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-(--brand) text-white shadow-sm">
                    <FileText className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate text-sm font-semibold text-(--text-primary)">
                      {assignment.submissionFileName ?? 'submission.pdf'}
                    </p>
                    <p className="text-xs text-(--text-tertiary)">
                      Submitted {formatDateTime(assignment.submittedAt)}
                      {assignment.submissionPages != null && ` \u00b7 ${assignment.submissionPages} pages`}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-(--success-subtle) px-2.5 py-1 text-xs font-semibold text-(--success) shrink-0">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Received
                  </span>
                </div>

                {canSubmit ? (
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
                      <RefreshCw className="me-1 h-4 w-4" /> Replace PDF
                    </Button>
                    <Link href={workspaceHref}>
                      <Button variant="primary" size="sm">
                        <PenSquare className="me-1 h-4 w-4" /> Open workspace
                      </Button>
                    </Link>
                    <p className="text-xs text-(--text-tertiary)">
                      You can replace until the deadline.
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl bg-(--surface) px-4 py-3 text-xs text-(--text-tertiary) flex items-center gap-2">
                    <Lock className="h-3.5 w-3.5" /> Submission closed at the deadline.
                  </div>
                )}
              </div>
            ) : canSubmit ? (
              <UploadDropzone
                inputRef={fileInputRef}
                pendingFile={pendingFile}
                onPick={handleFilePick}
                onClear={() => {
                  setPendingFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                onSubmit={handleConfirmSubmit}
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-(--border) bg-(--surface-secondary)/40 px-6 py-8 text-center">
                <Lock className="mx-auto h-6 w-6 text-(--text-quaternary)" />
                <p className="mt-3 text-sm font-semibold text-(--text-primary)">No submission was received</p>
                <p className="mt-1 text-xs text-(--text-tertiary)">
                  This assignment closed on {formatDateTime(assignment.deadline)}.
                </p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFilePick(f);
              }}
            />
          </Card>

          {/* Late-stage panels */}
          {assignment.status === 'WAITING_FOR_REVIEW' && (
            <Card padding="lg">
              <div className="flex items-start gap-3">
                <Cpu className="h-5 w-5 text-(--brand) shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-base font-semibold text-(--text-primary)">Queued for AI grading</h3>
                  <p className="mt-1 text-sm text-(--text-secondary) leading-relaxed">
                    Your submission is in the grading queue. Most assignments take 5\u201310 minutes once they start. We\u2019ll notify you the moment your grade is published.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {assignment.status === 'READY_FOR_REVIEW' && (
            <Card padding="lg">
              <div className="flex items-start gap-3">
                <Eye className="h-5 w-5 text-(--brand) shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-base font-semibold text-(--text-primary)">AI grading complete \u2014 lecturer review pending</h3>
                  <p className="mt-1 text-sm text-(--text-secondary) leading-relaxed">
                    The AI has analysed your submission and prepared a suggested grade. Your lecturer will confirm or adjust it before publishing.
                  </p>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* ── Right column: meta + timeline ── */}
        <aside className="space-y-6">
          <Card padding="md">
            <p className="label-micro mb-4">Assignment details</p>
            <dl className="space-y-3 text-sm">
              <DetailRow label="Course" value={course.title} />
              <DetailRow label="Lecturer" value={course.lecturer} />
              <DetailRow label="Week" value={week ? `${week.number} \u00b7 ${week.title}` : `Week ${assignment.weekNumber}`} />
              <DetailRow label="Released" value={formatDateTime(assignment.releasedAt)} />
              <DetailRow label="Deadline" value={formatDateTime(assignment.deadline)} />
              <DetailRow label="Max score" value={`${assignment.maxScore} pts`} />
              <DetailRow label="Questions" value={`${assignment.questions.length}`} />
            </dl>
          </Card>

          <Card padding="md">
            <p className="label-micro mb-4">Lifecycle</p>
            <ol className="space-y-4">
              <TimelineStep
                label="Released"
                value={formatDateTime(assignment.releasedAt)}
                done
              />
              <TimelineStep
                label="Submitted"
                value={assignment.submittedAt ? formatDateTime(assignment.submittedAt) : 'Pending'}
                done={!!assignment.submittedAt}
              />
              <TimelineStep
                label="AI grading"
                value={
                  assignment.status === 'PROCESSING'
                    ? 'In progress'
                    : assignment.queuedAt
                      ? formatDateTime(assignment.queuedAt)
                      : ['WAITING_FOR_REVIEW', 'READY_FOR_REVIEW', 'PUBLISHED'].includes(assignment.status)
                        ? 'Queued'
                        : 'Pending'
                }
                done={['READY_FOR_REVIEW', 'PUBLISHED'].includes(assignment.status)}
                active={assignment.status === 'PROCESSING' || assignment.status === 'WAITING_FOR_REVIEW'}
              />
              <TimelineStep
                label="Lecturer review"
                value={
                  assignment.status === 'PUBLISHED'
                    ? 'Confirmed'
                    : assignment.status === 'READY_FOR_REVIEW'
                      ? 'In progress'
                      : 'Pending'
                }
                done={assignment.status === 'PUBLISHED'}
                active={assignment.status === 'READY_FOR_REVIEW'}
              />
              <TimelineStep
                label="Published"
                value={assignment.publishedAt ? formatDateTime(assignment.publishedAt) : 'Pending'}
                done={assignment.status === 'PUBLISHED'}
              />
            </ol>
          </Card>

          {assignment.status !== 'PUBLISHED' && (
            <Card padding="md">
              <div className="flex items-start gap-2.5">
                <Sparkles className="h-4 w-4 text-(--brand) shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-(--text-primary)">Tips</p>
                  <ul className="mt-2 space-y-1.5 text-xs text-(--text-tertiary) leading-relaxed">
                    <li>\u2022 Show all intermediate steps clearly.</li>
                    <li>\u2022 Number every answer to match the question.</li>
                    <li>\u2022 Replace your PDF as many times as needed before the deadline.</li>
                  </ul>
                </div>
              </div>
            </Card>
          )}
        </aside>
      </div>

      {/* ── Replace confirmation modal ── */}
      {confirmReplace && pendingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-2xl bg-(--surface) p-6 shadow-(--shadow-lg) animate-in">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-(--warning-subtle) text-(--warning)">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-base font-semibold text-(--text-primary)">Replace previous submission?</h3>
                <p className="mt-1 text-sm text-(--text-secondary) leading-relaxed">
                  Your existing PDF will be replaced with <span className="font-semibold">{pendingFile.name}</span>. This is reversible until the deadline.
                </p>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setConfirmReplace(false);
                  setPendingFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              >
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleConfirmSubmit}>
                Replace and continue
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Subcomponents
   ───────────────────────────────────────────── */

function statusIcon(status: string) {
  switch (status) {
    case 'OPEN':
      return <Upload className="h-5 w-5" />;
    case 'SUBMITTED':
      return <CheckCircle2 className="h-5 w-5" />;
    case 'WAITING_FOR_REVIEW':
      return <Clock className="h-5 w-5" />;
    case 'PROCESSING':
      return <Cpu className="h-5 w-5" />;
    case 'READY_FOR_REVIEW':
      return <Eye className="h-5 w-5" />;
    case 'PUBLISHED':
      return <CheckCircle2 className="h-5 w-5" />;
    case 'CLOSED':
      return <Lock className="h-5 w-5" />;
    default:
      return <FileText className="h-5 w-5" />;
  }
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-(--text-quaternary) shrink-0 w-24">{label}</dt>
      <dd className="min-w-0 text-end text-sm font-medium text-(--text-primary) break-words">{value}</dd>
    </div>
  );
}

function TimelineStep({
  label,
  value,
  done,
  active,
}: {
  label: string;
  value: React.ReactNode;
  done?: boolean;
  active?: boolean;
}) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={cn(
          'mt-1 flex h-2.5 w-2.5 shrink-0 items-center justify-center rounded-full',
          done && 'bg-(--brand)',
          !done && active && 'bg-(--warning) animate-pulse',
          !done && !active && 'bg-(--surface-tertiary)',
        )}
      />
      <div className="min-w-0">
        <p className="text-sm font-medium text-(--text-primary) leading-tight">{label}</p>
        <p className="mt-0.5 text-xs text-(--text-tertiary)">{value}</p>
      </div>
    </li>
  );
}

/* Upload dropzone */

function UploadDropzone({
  inputRef,
  pendingFile,
  onPick,
  onClear,
  onSubmit,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  pendingFile: File | null;
  onPick: (f: File) => void;
  onClear: () => void;
  onSubmit: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onPick(f);
      }}
      className={cn(
        'rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors',
        dragOver
          ? 'border-(--brand) bg-(--brand-subtle)'
          : 'border-(--border) bg-(--surface-secondary)/30 hover:border-(--border-hover) hover:bg-(--surface-secondary)/50',
      )}
    >
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-(--brand-subtle) text-(--brand)">
        <Upload className="h-6 w-6" />
      </span>
      <p className="mt-4 text-sm font-semibold text-(--text-primary)">
        {pendingFile ? pendingFile.name : 'Drop your PDF here, or click to browse'}
      </p>
      <p className="mt-1 text-xs text-(--text-tertiary)">PDF only \u00b7 up to 25 MB</p>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        {pendingFile ? (
          <>
            <Button variant="primary" size="sm" onClick={onSubmit}>
              Submit and open workspace
            </Button>
            <Button variant="ghost" size="sm" onClick={onClear}>
              <Trash2 className="me-1 h-4 w-4" /> Remove
            </Button>
          </>
        ) : (
          <Button variant="primary" size="sm" onClick={() => inputRef.current?.click()}>
            <Upload className="me-1 h-4 w-4" /> Choose file
          </Button>
        )}
      </div>
    </div>
  );
}
