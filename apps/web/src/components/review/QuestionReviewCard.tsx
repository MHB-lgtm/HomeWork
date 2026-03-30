'use client';

import { useState } from 'react';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';
import { ChevronDown, ChevronUp, Bot, User, Edit3 } from 'lucide-react';

type Finding = {
  findingId: string;
  title: string;
  description: string;
  kind?: 'issue' | 'strength';
  severity?: 'critical' | 'major' | 'minor';
  confidence: number;
  suggestion?: string;
};

type QuestionReviewCardProps = {
  questionId: string;
  questionLabel: string;
  maxScore: number;
  aiScore: number;
  lecturerScore: number;
  onScoreChange: (score: number) => void;
  aiFeedback: string;
  lecturerFeedback: string;
  onFeedbackChange: (feedback: string) => void;
  findings: Finding[];
  isEdited: boolean;
  onFindingClick?: (findingId: string) => void;
  selectedFindingId?: string | null;
};

export function QuestionReviewCard({
  questionId,
  questionLabel,
  maxScore,
  aiScore,
  lecturerScore,
  onScoreChange,
  aiFeedback,
  lecturerFeedback,
  onFeedbackChange,
  findings,
  isEdited,
  onFindingClick,
  selectedFindingId,
}: QuestionReviewCardProps) {
  const [expanded, setExpanded] = useState(true);
  const scoreDelta = lecturerScore - aiScore;
  const issueCount = findings.filter((f) => f.kind !== 'strength').length;
  const strengthCount = findings.filter((f) => f.kind === 'strength').length;

  return (
    <div
      className={cn(
        'rounded-xl border overflow-hidden transition-all duration-200',
        isEdited
          ? 'border-(--brand)/30 bg-linear-to-b from-(--brand-subtle)/20 to-white shadow-(--shadow-sm)'
          : 'border-(--border) bg-(--surface) shadow-(--shadow-xs)'
      )}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition-colors hover:bg-(--surface-hover)"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-(--surface-secondary) text-[13px] font-bold text-(--text-secondary)">
            {questionLabel.replace(/^Q(uestion\s*)?/i, 'Q')}
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-(--text-primary) truncate">{questionLabel}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] text-(--text-tertiary)">Max {maxScore} pts</span>
              {isEdited && (
                <Badge variant="brand" size="sm">
                  <Edit3 size={8} className="mr-0.5" /> Edited
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Score pills */}
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 rounded-md bg-(--surface-secondary) px-2 py-1">
              <Bot size={10} className="text-(--text-tertiary)" />
              <span className="text-xs font-semibold text-(--text-secondary)">{aiScore}</span>
            </div>
            <span className="text-(--text-quaternary)">/</span>
            <div className={cn(
              'flex items-center gap-1 rounded-md px-2 py-1',
              isEdited ? 'bg-(--brand-subtle)' : 'bg-(--surface-secondary)'
            )}>
              <User size={10} className={isEdited ? 'text-(--brand)' : 'text-(--text-tertiary)'} />
              <span className={cn('text-xs font-semibold', isEdited ? 'text-(--brand)' : 'text-(--text-secondary)')}>
                {lecturerScore}
              </span>
            </div>
          </div>

          {scoreDelta !== 0 && (
            <Badge variant={scoreDelta > 0 ? 'success' : 'error'} size="sm">
              {scoreDelta > 0 ? '+' : ''}{scoreDelta}
            </Badge>
          )}

          {expanded ? <ChevronUp size={16} className="text-(--text-tertiary)" /> : <ChevronDown size={16} className="text-(--text-tertiary)" />}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-(--border-light) px-5 py-4 space-y-4">
          {/* Score editor */}
          <div className="flex items-end gap-4">
            <div className="w-32">
              <Input
                label="Score"
                type="number"
                min={0}
                max={maxScore}
                step={1}
                value={lecturerScore}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!Number.isNaN(val) && val >= 0 && val <= maxScore) {
                    onScoreChange(val);
                  }
                }}
              />
            </div>
            <p className="pb-2 text-xs text-(--text-tertiary)">
              of {maxScore} max
            </p>
          </div>

          {/* AI Feedback (read-only) */}
          {aiFeedback && (
            <div className="rounded-lg bg-(--surface-secondary)/70 border border-(--border-light) p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Bot size={12} className="text-(--text-tertiary)" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-(--text-tertiary)">AI Feedback</p>
              </div>
              <p className="text-[13px] text-(--text-secondary) leading-relaxed">{aiFeedback}</p>
            </div>
          )}

          {/* Lecturer Feedback (editable) */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <User size={12} className="text-(--brand)" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-(--brand)">Lecturer Feedback</p>
            </div>
            <Textarea
              value={lecturerFeedback}
              onChange={(e) => onFeedbackChange(e.target.value)}
              placeholder="Add your feedback for this question..."
              rows={2}
            />
          </div>

          {/* Findings */}
          {findings.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-(--text-tertiary) mb-2">
                Findings ({issueCount} issue{issueCount !== 1 ? 's' : ''}{strengthCount > 0 ? `, ${strengthCount} strength${strengthCount !== 1 ? 's' : ''}` : ''})
              </p>
              <div className="space-y-1.5">
                {findings.map((finding) => (
                  <button
                    key={finding.findingId}
                    onClick={() => onFindingClick?.(finding.findingId)}
                    className={cn(
                      'w-full text-left rounded-lg border p-2.5 transition-all duration-200',
                      selectedFindingId === finding.findingId
                        ? 'border-(--brand) bg-(--brand-subtle)/30 ring-1 ring-(--brand)/15'
                        : 'border-(--border-light) hover:border-(--border-hover) hover:bg-(--surface-hover)'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[12px] font-medium text-(--text-primary)">{finding.title}</p>
                      <div className="flex gap-1 shrink-0">
                        {finding.kind === 'strength' ? (
                          <Badge variant="success" size="sm">Strength</Badge>
                        ) : finding.severity ? (
                          <Badge
                            variant={finding.severity === 'critical' ? 'error' : finding.severity === 'major' ? 'warning' : 'default'}
                            size="sm"
                          >
                            {finding.severity}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    <p className="text-[11px] text-(--text-tertiary) mt-1 line-clamp-2">{finding.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
