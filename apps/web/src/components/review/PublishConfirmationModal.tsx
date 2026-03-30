'use client';

import { Modal } from '../ui/modal';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { AlertTriangle, Send } from 'lucide-react';

type PublishConfirmationModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  publishing: boolean;
  reviewName: string;
  finalScore: number | null;
  maxScore: number | null;
  editedQuestionCount: number;
  flagCount: number;
};

export function PublishConfirmationModal({
  open,
  onClose,
  onConfirm,
  publishing,
  reviewName,
  finalScore,
  maxScore,
  editedQuestionCount,
  flagCount,
}: PublishConfirmationModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Publish Review" size="md">
      <div className="space-y-4">
        <div className="rounded-lg border border-(--warning)/20 bg-(--warning-subtle) p-3">
          <div className="flex gap-2">
            <AlertTriangle size={16} className="text-(--warning) shrink-0 mt-0.5" />
            <div>
              <p className="text-[13px] font-semibold text-(--text-primary)">This action publishes results to the student</p>
              <p className="text-[12px] text-(--text-secondary) mt-0.5">
                The student will only see the published version. Make sure the review is complete before publishing.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-(--border) bg-(--surface-secondary) p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs text-(--text-tertiary)">Review</span>
            <span className="text-sm font-medium text-(--text-primary)">{reviewName}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-(--text-tertiary)">Final Score</span>
            <span className="text-sm font-bold text-(--text-primary)">
              {finalScore !== null ? `${finalScore}/${maxScore ?? '?'}` : 'Not scored'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-(--text-tertiary)">Questions edited</span>
            <Badge variant={editedQuestionCount > 0 ? 'brand' : 'default'} size="sm">
              {editedQuestionCount}
            </Badge>
          </div>
          {flagCount > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-xs text-(--text-tertiary)">Open flags</span>
              <Badge variant="warning" size="sm">{flagCount}</Badge>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-5">
        <Button variant="secondary" onClick={onClose} disabled={publishing}>Cancel</Button>
        <Button
          onClick={onConfirm}
          loading={publishing}
          icon={<Send size={14} />}
          className="shadow-(--shadow-brand)"
        >
          Publish to student
        </Button>
      </div>
    </Modal>
  );
}
