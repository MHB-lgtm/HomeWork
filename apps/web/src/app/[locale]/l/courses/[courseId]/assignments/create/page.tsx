'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Upload, X } from 'lucide-react';
import { cn } from '../../../../../../../lib/utils';
import { PageHeader } from '../../../../../../../components/ui/page-header';
import { Button } from '../../../../../../../components/ui/button';
import { Card } from '../../../../../../../components/ui/card';
import { Input } from '../../../../../../../components/ui/input';
import { Textarea } from '../../../../../../../components/ui/textarea';

export default function CreateAssignmentPage() {
  const params = useParams();
  const courseId = params.courseId as string;
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [week, setWeek] = useState(1);
  const [maxPoints, setMaxPoints] = useState(100);
  const [openDate, setOpenDate] = useState('');
  const [deadline, setDeadline] = useState('');
  const [instructions, setInstructions] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = 'Title is required';
    if (!openDate) errs.openDate = 'Open date is required';
    if (!deadline) errs.deadline = 'Deadline is required';
    if (openDate && deadline && new Date(openDate) >= new Date(deadline)) {
      errs.deadline = 'Deadline must be after open date';
    }
    if (maxPoints < 1) errs.maxPoints = 'Must be at least 1 point';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      router.push(`/l/courses/${courseId}`);
    }, 1000);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) setFile(dropped);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        backHref={`/l/courses/${courseId}`}
        title="Create Assignment"
        subtitle="Set up a new weekly assignment for your students."
      />

      <form onSubmit={handleSave}>
        <Card padding="lg" className="space-y-6">
          {/* Title */}
          <Input
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Vector Spaces & Subspaces"
            error={errors.title}
          />

          {/* Week + Max Points */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="w-full">
              <label className="mb-1.5 block text-sm font-medium text-(--text-primary)">
                Week Number
              </label>
              <select
                value={week}
                onChange={(e) => setWeek(Number(e.target.value))}
                className={cn(
                  'flex h-9 w-full rounded-lg border border-(--border) bg-(--surface) px-3 text-sm text-(--text-primary)',
                  'transition-colors focus-visible:outline-none focus-visible:border-(--border-focus) focus-visible:ring-1 focus-visible:ring-(--border-focus)',
                )}
              >
                {Array.from({ length: 14 }, (_, i) => i + 1).map((w) => (
                  <option key={w} value={w}>Week {w}</option>
                ))}
              </select>
            </div>

            <Input
              label="Max Points"
              type="number"
              min={1}
              max={1000}
              value={maxPoints}
              onChange={(e) => setMaxPoints(Number(e.target.value))}
              error={errors.maxPoints}
            />
          </div>

          {/* Opens + Deadline */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Opens"
              type="date"
              value={openDate}
              onChange={(e) => setOpenDate(e.target.value)}
              error={errors.openDate}
            />
            <Input
              label="Deadline"
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              error={errors.deadline}
            />
          </div>

          {/* Instructions */}
          <Textarea
            label="Instructions"
            rows={4}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Provide instructions for the assignment..."
          />

          {/* File Upload */}
          <div className="w-full">
            <label className="mb-1.5 block text-sm font-medium text-(--text-primary)">
              Assignment File
            </label>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors',
                dragOver
                  ? 'border-(--brand) bg-(--brand-subtle)'
                  : 'border-(--border) hover:border-(--border-hover) hover:bg-(--surface-hover)',
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="sr-only"
              />
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-(--surface-secondary) text-(--text-tertiary)">
                <Upload className="h-5 w-5" />
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
                  <p className="text-sm text-(--text-secondary)">
                    Drop file here or click to browse
                  </p>
                  <p className="text-xs text-(--text-quaternary)">PDF, DOC, DOCX, or TXT</p>
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-(--border-light) pt-6">
            <Link href={`/l/courses/${courseId}`}>
              <Button variant="secondary" type="button">Cancel</Button>
            </Link>
            <Button type="submit" loading={saving}>
              Create Assignment
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
