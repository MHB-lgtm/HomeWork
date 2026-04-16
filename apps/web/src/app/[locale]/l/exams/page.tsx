'use client';

import { useState, useRef } from 'react';
import { Upload, FileText, X, Database, Loader2 } from 'lucide-react';
import { cn } from '../../../../lib/utils';
import { PageHeader } from '../../../../components/ui/page-header';
import { Button } from '../../../../components/ui/button';
import { Card } from '../../../../components/ui/card';
import { Input } from '../../../../components/ui/input';
import { StatusBadge } from '../../../../components/ui/status-badge';
import { DataTable, Column } from '../../../../components/ui/data-table';

/* ── Types ── */

type Exam = {
  id: string;
  title: string;
  questionsCount: number;
  indexStatus: 'active' | 'pending' | 'locked' | 'error';
  indexLabel: string;
  createdAt: string;
};

/* ── Mock Data ── */

const mockExams: Exam[] = [
  { id: 'e1', title: 'Midterm 2026 - Linear Algebra', questionsCount: 8, indexStatus: 'active', indexLabel: 'Indexed', createdAt: '2026-03-01T10:00:00' },
  { id: 'e2', title: 'Quiz 3 - Calculus II', questionsCount: 5, indexStatus: 'active', indexLabel: 'Indexed', createdAt: '2026-03-10T14:30:00' },
  { id: 'e3', title: 'Final Exam - Physics I', questionsCount: 12, indexStatus: 'pending', indexLabel: 'Indexing...', createdAt: '2026-03-20T09:00:00' },
  { id: 'e4', title: 'Quiz 4 - Calculus II', questionsCount: 4, indexStatus: 'locked', indexLabel: 'Not Indexed', createdAt: '2026-03-25T16:00:00' },
];

/* ── Component ── */

export default function ExamsPage() {
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [creating, setCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) setFile(dropped);
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !file) return;
    setCreating(true);
    setTimeout(() => {
      setCreating(false);
      setTitle('');
      setFile(null);
    }, 1500);
  }

  const columns: Column<Exam & Record<string, unknown>>[] = [
    {
      key: 'title',
      label: 'Title',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-(--surface-secondary) text-(--text-tertiary)">
            <FileText className="h-4 w-4" />
          </div>
          <span className="font-medium text-(--text-primary)">{row.title as string}</span>
        </div>
      ),
    },
    {
      key: 'questionsCount',
      label: 'Questions',
      render: (row) => <span className="text-(--text-secondary)">{row.questionsCount as number}</span>,
    },
    {
      key: 'indexStatus',
      label: 'Index Status',
      render: (row) => <StatusBadge status={row.indexStatus as string} label={row.indexLabel as string} size="sm" />,
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (row) => (
        <span className="text-(--text-tertiary)">
          {new Date(row.createdAt as string).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-12">
      <PageHeader title="Exams" subtitle="Upload exam templates for AI-powered grading." />

      {/* Upload Section */}
      <Card padding="lg">
        <h2 className="mb-6 text-lg font-semibold text-(--text-primary)">Upload New Exam</h2>
        <form onSubmit={handleCreate} className="space-y-6">
          <Input
            label="Exam Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Midterm 2026 - Linear Algebra"
          />

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed px-8 py-14 text-center transition-colors',
              dragOver
                ? 'border-(--brand) bg-(--brand-subtle)'
                : 'border-(--border) hover:border-(--border-hover) hover:bg-(--surface-hover)',
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="sr-only"
            />
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-(--brand-subtle) text-(--brand)">
              <Upload className="h-6 w-6" />
            </div>
            {file ? (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-(--text-primary)">{file.name}</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setFile(null); }}
                  className="rounded-md p-0.5 text-(--text-quaternary) transition-colors hover:text-(--error)"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <>
                <p className="text-base text-(--text-secondary)">Drop file here or click to browse</p>
                <p className="text-xs font-medium tracking-[0.18em] uppercase text-(--text-quaternary)">PDF · PNG · JPG</p>
              </>
            )}
          </div>

          <div className="flex justify-end">
            <Button type="submit" loading={creating} icon={<Upload />} size="md">
              Upload
            </Button>
          </div>
        </form>
      </Card>

      {/* Exams Table */}
      <DataTable
        columns={columns}
        data={mockExams.map((e) => ({ ...e } as Exam & Record<string, unknown>))}
        emptyMessage="No exams found"
        emptyIcon={<Database />}
      />
    </div>
  );
}
