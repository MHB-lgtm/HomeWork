'use client';

import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';
import { TrendingDown, TrendingUp, Minus, AlertTriangle, Edit3, CheckCircle2 } from 'lucide-react';

type ReviewScoreSummaryProps = {
  aiScore: number | null;
  lecturerScore: number | null;
  maxScore: number | null;
  editedQuestionCount: number;
  totalQuestionCount: number;
  flagCount: number;
  isPublished: boolean;
};

export function ReviewScoreSummary({
  aiScore,
  lecturerScore,
  maxScore,
  editedQuestionCount,
  totalQuestionCount,
  flagCount,
  isPublished,
}: ReviewScoreSummaryProps) {
  const finalScore = lecturerScore ?? aiScore;
  const delta = aiScore !== null && lecturerScore !== null ? lecturerScore - aiScore : null;
  const hasEdits = editedQuestionCount > 0;

  return (
    <div className="rounded-xl border border-(--border) bg-linear-to-b from-white to-(--surface-secondary)/30 shadow-(--shadow-sm) overflow-hidden">
      <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-(--border-light)">
        {/* AI Score */}
        <div className="p-4 text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-(--text-quaternary) mb-1">AI Score</p>
          <p className="text-xl font-bold text-(--text-secondary)">
            {aiScore !== null ? aiScore : '-'}
            {maxScore !== null && <span className="text-sm font-normal text-(--text-quaternary)">/{maxScore}</span>}
          </p>
        </div>

        {/* Lecturer Score */}
        <div className="p-4 text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-(--text-quaternary) mb-1">Final Score</p>
          <p className={cn('text-xl font-bold', hasEdits ? 'text-(--brand)' : 'text-(--text-primary)')}>
            {finalScore !== null ? finalScore : '-'}
            {maxScore !== null && <span className="text-sm font-normal text-(--text-quaternary)">/{maxScore}</span>}
          </p>
        </div>

        {/* Delta */}
        <div className="p-4 text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-(--text-quaternary) mb-1">Delta</p>
          <div className="flex items-center justify-center gap-1">
            {delta !== null ? (
              <>
                {delta > 0 ? (
                  <TrendingUp size={14} className="text-(--success)" />
                ) : delta < 0 ? (
                  <TrendingDown size={14} className="text-(--error)" />
                ) : (
                  <Minus size={14} className="text-(--text-tertiary)" />
                )}
                <span className={cn(
                  'text-lg font-bold',
                  delta > 0 ? 'text-(--success)' : delta < 0 ? 'text-(--error)' : 'text-(--text-tertiary)'
                )}>
                  {delta > 0 ? `+${delta}` : delta}
                </span>
              </>
            ) : (
              <span className="text-lg font-bold text-(--text-quaternary)">-</span>
            )}
          </div>
        </div>

        {/* Edited */}
        <div className="p-4 text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-(--text-quaternary) mb-1">Edited</p>
          <div className="flex items-center justify-center gap-1.5">
            <Edit3 size={13} className={hasEdits ? 'text-(--brand)' : 'text-(--text-quaternary)'} />
            <span className={cn('text-lg font-bold', hasEdits ? 'text-(--brand)' : 'text-(--text-tertiary)')}>
              {editedQuestionCount}/{totalQuestionCount}
            </span>
          </div>
        </div>

        {/* Flags */}
        <div className="p-4 text-center col-span-2 md:col-span-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-(--text-quaternary) mb-1">Flags</p>
          <div className="flex items-center justify-center gap-1.5">
            {flagCount > 0 ? (
              <>
                <AlertTriangle size={13} className="text-(--warning)" />
                <span className="text-lg font-bold text-(--warning)">{flagCount}</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={13} className="text-(--success)" />
                <span className="text-lg font-bold text-(--success)">0</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
