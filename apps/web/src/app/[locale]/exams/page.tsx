'use client';

import { useState, useEffect } from 'react';
import { createExam, ExamSummary, listExams } from '../../../lib/examsClient';
import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { EmptyState } from '../../../components/ui/empty-state';
import { Input } from '../../../components/ui/input';
import { Panel, PanelContent, PanelHeader, PanelTitle } from '../../../components/ui/panel';
import { StatusBadge } from '../../../components/ui/status-badge';
import { DataTable, type Column } from '../../../components/ui/data-table';
import { PageHeader } from '../../../components/ui/page-header';
import { FormSection } from '../../../components/ui/form-section';
import { PageTransition, FadeIn } from '../../../components/ui/motion';
import { Upload, FileText, Copy, Check } from 'lucide-react';

type ExamMessage = {
  type: 'success' | 'error' | 'warning';
  text: string;
};

type IndexStatus = 'loading' | 'confirmed' | 'proposed' | 'missing' | 'error';

function toIndexStatusBadge(status: IndexStatus | undefined) {
  switch (status) {
    case 'confirmed': return <StatusBadge status="DONE" label="Confirmed" />;
    case 'proposed': return <StatusBadge status="PROPOSED" label="Proposed" />;
    case 'missing': return <StatusBadge status="NOT_INDEXED" label="Not indexed" />;
    case 'error': return <StatusBadge status="FAILED" label="Index error" />;
    case 'loading':
    default: return <StatusBadge status="LOADING" label="Loading" />;
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

  useEffect(() => { loadExams(); }, []);

  const loadExamIndexStatuses = async (items: ExamSummary[]) => {
    if (items.length === 0) { setIndexStatuses({}); return; }
    const loadingStatuses: Record<string, IndexStatus> = {};
    for (const exam of items) loadingStatuses[exam.examId] = 'loading';
    setIndexStatuses(loadingStatuses);

    const results = await Promise.all(
      items.map(async (exam) => {
        try {
          const response = await fetch(`/api/exams/${encodeURIComponent(exam.examId)}/index`);
          if (!response.ok) return [exam.examId, 'error'] as const;
          const payload = (await response.json()) as { ok?: boolean; data?: { status?: string } | null };
          const status = payload?.data?.status;
          if (status === 'confirmed') return [exam.examId, 'confirmed'] as const;
          if (status === 'proposed') return [exam.examId, 'proposed'] as const;
          return [exam.examId, 'missing'] as const;
        } catch { return [exam.examId, 'error'] as const; }
      })
    );
    setIndexStatuses(Object.fromEntries(results));
  };

  const loadExams = async () => {
    setIsLoading(true);
    const result = await listExams();
    setIsLoading(false);
    if (result.ok) { setExams(result.data); await loadExamIndexStatuses(result.data); }
    else setMessage({ type: 'error', text: result.error });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!title.trim()) { setMessage({ type: 'error', text: 'Title is required' }); return; }
    if (!examFile) { setMessage({ type: 'error', text: 'Exam file is required' }); return; }

    setIsCreating(true);
    const formData = new FormData();
    formData.append('title', title.trim());
    formData.append('examFile', examFile);
    const result = await createExam(formData);
    setIsCreating(false);

    if (result.ok) {
      setLastCreatedExamId(result.examId);
      if (result.indexing?.ok === false) setMessage({ type: 'warning', text: 'Exam created. Auto-indexing did not complete automatically.' });
      else if (result.indexing?.ok === true) setMessage({ type: 'success', text: 'Exam created and indexed successfully.' });
      else setMessage({ type: 'success', text: 'Exam created successfully.' });
      setTitle(''); setExamFile(null);
      const fileInput = document.getElementById('examFile') as HTMLInputElement | null;
      if (fileInput) fileInput.value = '';
      await loadExams();
    } else {
      setMessage({ type: 'error', text: result.error });
    }
  };

  const formatDate = (dateString: string) => {
    try { return new Date(dateString).toLocaleString(); } catch { return dateString; }
  };

  const copyExamId = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedExamId(value);
      window.setTimeout(() => setCopiedExamId((prev) => (prev === value ? null : prev)), 1200);
    } catch { setCopiedExamId(null); }
  };

  const columns: Column<ExamSummary>[] = [
    {
      key: 'title',
      label: 'Title',
      render: (exam) => (
        <div className="space-y-1">
          <p className="font-medium text-(--text-primary)">{exam.title}</p>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-(--text-tertiary)">{exam.examId}</span>
            <button
              onClick={(e) => { e.stopPropagation(); copyExamId(exam.examId); }}
              className="rounded p-0.5 text-(--text-quaternary) hover:text-(--text-secondary) transition-colors"
            >
              {copiedExamId === exam.examId ? <Check size={12} /> : <Copy size={12} />}
            </button>
          </div>
        </div>
      ),
    },
    {
      key: 'index',
      label: 'Index',
      render: (exam) => toIndexStatusBadge(indexStatuses[exam.examId]),
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (exam) => <span className="text-sm text-(--text-secondary)">{formatDate(exam.createdAt)}</span>,
    },
  ];

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          title="Exams"
          description="Upload and manage exam templates for AI-powered grading."
        />

        {message && (
          <Alert variant={message.type === 'error' ? 'error' : message.type === 'warning' ? 'warning' : 'success'}>
            <AlertTitle>
              {message.type === 'success' ? 'Exam created' : message.type === 'warning' ? 'Created with warning' : 'Operation failed'}
            </AlertTitle>
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
          {/* Upload Form */}
          <FadeIn>
            <FormSection title="Upload exam" description="Add a new exam template for grading.">
              <form onSubmit={handleCreate} className="space-y-4">
                <Input
                  label="Exam title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Midterm 2026"
                  required
                />

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-(--text-primary)">Exam file</label>
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
                    className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-(--border) p-8 text-center transition-colors hover:border-(--border-hover) hover:bg-(--surface-hover)"
                  >
                    <Upload size={20} className="text-(--text-tertiary)" />
                    <span className="text-sm font-medium text-(--text-secondary)">Click to upload</span>
                    <span className="text-xs text-(--text-tertiary)">PDF, PNG, or JPG</span>
                  </label>
                  {examFile && (
                    <p className="text-xs text-(--text-secondary)">
                      Selected: <span className="font-medium">{examFile.name}</span>
                    </p>
                  )}
                </div>

                <Button type="submit" loading={isCreating} className="w-full">
                  Create Exam
                </Button>
              </form>
            </FormSection>
          </FadeIn>

          {/* Exams Table */}
          <FadeIn delay={0.1}>
            <DataTable
              columns={columns}
              data={exams as unknown as Record<string, unknown>[]}
              loading={isLoading}
              emptyMessage="No exams yet"
              emptyIcon={<FileText />}
            />
          </FadeIn>
        </div>
      </div>
    </PageTransition>
  );
}
