'use client';

import { useState, useEffect } from 'react';
import { createExam, ExamSummary, listExams } from '../../lib/examsClient';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/empty-state';
import { Input } from '../../components/ui/input';
import { PageHeader } from '../../components/ui/page-header';
import { Panel, PanelContent, PanelHeader, PanelTitle } from '../../components/ui/panel';
import { StatusBadge } from '../../components/ui/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { CardSkeleton, TableRowSkeleton } from '../../components/ui/skeleton';
import { cn } from '../../lib/utils';

type ExamMessage = {
  type: 'success' | 'error' | 'warning';
  text: string;
};

type IndexStatus = 'loading' | 'confirmed' | 'proposed' | 'missing' | 'error';

function toIndexStatusBadge(status: IndexStatus | undefined) {
  switch (status) {
    case 'confirmed':
      return <StatusBadge status="DONE" label="Confirmed" />;
    case 'proposed':
      return <StatusBadge status="PROPOSED" label="Proposed" />;
    case 'missing':
      return <StatusBadge status="NOT_INDEXED" label="Not indexed" />;
    case 'error':
      return <StatusBadge status="FAILED" label="Index error" />;
    case 'loading':
    default:
      return <StatusBadge status="LOADING" label="Loading" />;
  }
}

export default function ExamsPage() {
  const [title, setTitle] = useState('');
  const [examFile, setExamFile] = useState<File | null>(null);
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [message, setMessage] = useState<ExamMessage | null>(null);
  const [indexStatuses, setIndexStatuses] = useState<Record<string, IndexStatus>>({});
  const [lastCreatedExamId, setLastCreatedExamId] = useState<string | null>(null);
  const [copiedExamId, setCopiedExamId] = useState<string | null>(null);

  useEffect(() => {
    loadExams();
  }, []);

  const loadExamIndexStatuses = async (items: ExamSummary[]) => {
    if (items.length === 0) {
      setIndexStatuses({});
      return;
    }

    const loadingStatuses: Record<string, IndexStatus> = {};
    for (const exam of items) {
      loadingStatuses[exam.examId] = 'loading';
    }
    setIndexStatuses(loadingStatuses);

    const results = await Promise.all(
      items.map(async (exam) => {
        try {
          const response = await fetch(`/api/exams/${encodeURIComponent(exam.examId)}/index`);
          if (!response.ok) {
            return [exam.examId, 'error'] as const;
          }

          const payload = (await response.json()) as { ok?: boolean; data?: { status?: string } | null };
          const status = payload?.data?.status;

          if (status === 'confirmed') {
            return [exam.examId, 'confirmed'] as const;
          }
          if (status === 'proposed') {
            return [exam.examId, 'proposed'] as const;
          }
          return [exam.examId, 'missing'] as const;
        } catch {
          return [exam.examId, 'error'] as const;
        }
      })
    );

    setIndexStatuses(Object.fromEntries(results));
  };

  const loadExams = async () => {
    setIsLoading(true);
    const result = await listExams();
    setIsLoading(false);

    if (result.ok) {
      setExams(result.data);
      await loadExamIndexStatuses(result.data);
    } else {
      setMessage({ type: 'error', text: result.error });
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!title.trim()) {
      setMessage({ type: 'error', text: 'Title is required' });
      return;
    }

    if (!examFile) {
      setMessage({ type: 'error', text: 'Exam file is required' });
      return;
    }

    setIsCreating(true);

    const formData = new FormData();
    formData.append('title', title.trim());
    formData.append('examFile', examFile);

    const result = await createExam(formData);
    setIsCreating(false);

    if (result.ok) {
      setLastCreatedExamId(result.examId);
      if (result.indexing?.ok === false) {
        setMessage({
          type: 'warning',
          text: 'Exam created. Auto-indexing did not complete automatically.',
        });
      } else if (result.indexing?.ok === true) {
        setMessage({ type: 'success', text: 'Exam created and indexed successfully.' });
      } else {
        setMessage({ type: 'success', text: 'Exam created successfully.' });
      }

      setTitle('');
      setExamFile(null);
      const fileInput = document.getElementById('examFile') as HTMLInputElement | null;
      if (fileInput) {
        fileInput.value = '';
      }
      await loadExams();
    } else {
      setMessage({ type: 'error', text: result.error });
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  const alertTone =
    message?.type === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : message?.type === 'warning'
        ? 'border-amber-200 bg-amber-50 text-amber-900'
        : undefined;

  const copyExamId = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedExamId(value);
      window.setTimeout(() => {
        setCopiedExamId((prev) => (prev === value ? null : prev));
      }, 1200);
    } catch {
      setCopiedExamId(null);
    }
  };

  return (
    <main className="min-h-screen review-page-bg text-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-8 md:py-12 space-y-6">
      <PageHeader
        title="Exams"
        actions={
          <Button
            type="submit"
            form="create-exam-form"
            disabled={isCreating}
            className="h-auto w-fit rounded-md px-4 py-2 text-sm font-medium transition-colors"
          >
            {isCreating ? 'Creating...' : 'Upload Exam'}
          </Button>
        }
      />

      {message ? (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'} className={cn('rounded-xl', alertTone)}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <AlertTitle>
                {message.type === 'success'
                  ? 'Exam created'
                  : message.type === 'warning'
                    ? 'Exam created with indexing warning'
                    : 'Operation failed'}
              </AlertTitle>
              <AlertDescription className="break-words whitespace-pre-wrap">{message.text}</AlertDescription>
              {message.type === 'warning' && lastCreatedExamId ? (
                <details className="mt-2 rounded-lg border border-amber-200 bg-white/70 px-3 py-2 text-xs text-amber-900">
                  <summary className="cursor-pointer font-medium">Technical details</summary>
                  <div className="mt-2 space-y-1 font-mono">
                    <p>Exam ID: {lastCreatedExamId}</p>
                    <p>Manual command: pnpm --filter worker exam:index -- --examId {lastCreatedExamId}</p>
                  </div>
                </details>
              ) : null}
            </div>
            <StatusBadge
              status={message.type === 'error' ? 'FAILED' : message.type === 'warning' ? 'PENDING' : 'DONE'}
              label={message.type === 'error' ? 'Failed' : message.type === 'warning' ? 'Warning' : 'Success'}
            />
          </div>
        </Alert>
      ) : null}

      <Panel id="upload-exam">
        <PanelHeader>
          <PanelTitle>Upload exam</PanelTitle>
        </PanelHeader>
        <PanelContent>
          <form id="create-exam-form" onSubmit={handleCreate} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="title" className="text-sm font-medium text-slate-800">
                Exam title
              </label>
              <Input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="Example: Midterm 2026"
              />
            </div>

            <div className="space-y-2">
              <input
                id="examFile"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => setExamFile(e.target.files?.[0] || null)}
                required
                className="sr-only"
              />
              <label
                htmlFor="examFile"
                className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-10 text-center transition-colors hover:bg-gray-50"
              >
                <p className="text-sm font-medium text-slate-900">Click to upload or drag and drop</p>
              </label>
              {examFile ? (
                <p className="text-xs font-medium text-slate-700">
                  Selected: <span className="font-semibold">{examFile.name}</span>
                </p>
              ) : null}
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={isCreating} className="h-auto w-auto rounded-md px-4 py-2 text-sm font-medium transition-colors">
                {isCreating ? 'Creating...' : 'Create Exam'}
              </Button>
            </div>
          </form>
        </PanelContent>
      </Panel>

      <Panel>
        <PanelHeader>
          <PanelTitle>Existing exams</PanelTitle>
        </PanelHeader>
        <PanelContent>
          {isLoading ? (
            <div className="space-y-4">
              <CardSkeleton lines={2} />
              <Table className="w-full text-left text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-auto border-b border-gray-100 px-4 py-3 text-gray-500 font-medium">Title</TableHead>
                    <TableHead className="h-auto border-b border-gray-100 px-4 py-3 text-gray-500 font-medium">Created</TableHead>
                    <TableHead className="h-auto border-b border-gray-100 px-4 py-3 text-gray-500 font-medium">Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRowSkeleton columns={3} />
                  <TableRowSkeleton columns={3} />
                  <TableRowSkeleton columns={3} />
                </TableBody>
              </Table>
            </div>
          ) : exams.length === 0 ? (
            <EmptyState
              title="No exams yet"
              action={
                <Button
                  size="sm"
                  onClick={() => document.getElementById('title')?.focus()}
                  className="h-auto w-auto rounded-md px-4 py-2 text-sm font-medium transition-colors"
                >
                  Upload first exam
                </Button>
              }
            />
          ) : (
            <Table className="w-full text-left text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead className="h-auto border-b border-gray-100 px-4 py-3 text-gray-500 font-medium">Title</TableHead>
                  <TableHead className="h-auto border-b border-gray-100 px-4 py-3 text-gray-500 font-medium">Created</TableHead>
                  <TableHead className="h-auto border-b border-gray-100 px-4 py-3 text-gray-500 font-medium">Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exams.map((exam) => (
                  <TableRow key={exam.examId}>
                    <TableCell className="border-b border-gray-100 px-4 py-3 text-slate-900">
                      <div className="space-y-1">
                        <p className="font-medium">{exam.title}</p>
                        <details className="text-xs text-slate-500">
                          <summary className="cursor-pointer">Technical details</summary>
                          <div className="mt-1 space-y-2">
                            <div className="flex items-center gap-2 font-mono">
                              <span>{exam.examId}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={() => copyExamId(exam.examId)}
                              >
                                {copiedExamId === exam.examId ? 'Copied' : 'Copy'}
                              </Button>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500">Index:</span>
                              {toIndexStatusBadge(indexStatuses[exam.examId])}
                            </div>
                          </div>
                        </details>
                      </div>
                    </TableCell>
                    <TableCell className="border-b border-gray-100 px-4 py-3 text-slate-700">{formatDate(exam.createdAt)}</TableCell>
                    <TableCell className="border-b border-gray-100 px-4 py-3 text-slate-700">{exam.updatedAt ? formatDate(exam.updatedAt) : '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </PanelContent>
      </Panel>
      </div>
    </main>
  );
}
