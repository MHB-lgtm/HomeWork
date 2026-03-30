'use client';

import { useState } from 'react';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select } from '../ui/select';
import { AlertTriangle, Plus, X, Bot, User, Cog } from 'lucide-react';

export type ReviewFlag = {
  id: string;
  code: string;
  summary: string;
  source: 'ai' | 'lecturer' | 'rule';
  severity: 'low' | 'medium' | 'high';
  status: 'open' | 'resolved' | 'dismissed';
  questionId?: string;
};

const FLAG_CODES = [
  { value: 'suspected_copy', label: 'Suspected copy issue' },
  { value: 'critical_mistake', label: 'Critical mistake' },
  { value: 'missing_steps', label: 'Missing steps' },
  { value: 'unrelated_answer', label: 'Unrelated answer' },
  { value: 'instruction_violation', label: 'Instruction violation' },
  { value: 'needs_attention', label: 'Needs attention' },
  { value: 'other', label: 'Other' },
];

type FlagManagerProps = {
  flags: ReviewFlag[];
  onAddFlag: (flag: Omit<ReviewFlag, 'id'>) => void;
  onRemoveFlag: (flagId: string) => void;
  onResolveFlag: (flagId: string) => void;
  className?: string;
};

const sourceIcon = {
  ai: <Bot size={10} />,
  lecturer: <User size={10} />,
  rule: <Cog size={10} />,
};

const severityVariant = {
  low: 'default' as const,
  medium: 'warning' as const,
  high: 'error' as const,
};

export function FlagManager({ flags, onAddFlag, onRemoveFlag, onResolveFlag, className }: FlagManagerProps) {
  const [adding, setAdding] = useState(false);
  const [newCode, setNewCode] = useState('needs_attention');
  const [newSummary, setNewSummary] = useState('');
  const [newSeverity, setNewSeverity] = useState<'low' | 'medium' | 'high'>('medium');

  const openFlags = flags.filter((f) => f.status === 'open');
  const resolvedFlags = flags.filter((f) => f.status !== 'open');

  const handleAdd = () => {
    if (!newSummary.trim()) return;
    onAddFlag({
      code: newCode,
      summary: newSummary.trim(),
      source: 'lecturer',
      severity: newSeverity,
      status: 'open',
    });
    setNewSummary('');
    setAdding(false);
  };

  return (
    <div className={cn('space-y-3', className)}>
      {/* Open flags */}
      {openFlags.length > 0 && (
        <div className="space-y-1.5">
          {openFlags.map((flag) => (
            <div
              key={flag.id}
              className="flex items-start gap-2 rounded-lg border border-(--border-light) bg-(--surface) p-2.5 group"
            >
              <AlertTriangle size={13} className="mt-0.5 shrink-0 text-(--warning)" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[11px] font-semibold text-(--text-primary)">{flag.summary}</span>
                  <Badge variant={severityVariant[flag.severity]} size="sm">{flag.severity}</Badge>
                  <span className={cn('text-(--text-quaternary)', flag.source === 'ai' ? 'text-(--info)' : flag.source === 'lecturer' ? 'text-(--brand)' : '')}>
                    {sourceIcon[flag.source]}
                  </span>
                </div>
                <p className="text-[10px] text-(--text-tertiary)">{FLAG_CODES.find((c) => c.value === flag.code)?.label ?? flag.code}</p>
              </div>
              {flag.source === 'lecturer' && (
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => onResolveFlag(flag.id)} className="text-[10px] font-medium text-(--success) hover:underline">Resolve</button>
                  <button onClick={() => onRemoveFlag(flag.id)} className="text-[10px] font-medium text-(--error) hover:underline">Remove</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Resolved flags */}
      {resolvedFlags.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-(--text-tertiary) font-medium">{resolvedFlags.length} resolved</summary>
          <div className="mt-1.5 space-y-1">
            {resolvedFlags.map((flag) => (
              <div key={flag.id} className="flex items-center gap-2 rounded-md bg-(--surface-secondary)/50 px-2 py-1.5 opacity-60">
                <span className="text-[11px] text-(--text-tertiary) line-through">{flag.summary}</span>
                <Badge variant="default" size="sm">{flag.status}</Badge>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Add new flag */}
      {adding ? (
        <div className="rounded-lg border border-(--brand)/20 bg-(--brand-subtle)/10 p-3 space-y-2.5">
          <Select label="Type" value={newCode} onChange={(e) => setNewCode(e.target.value)}>
            {FLAG_CODES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </Select>
          <Select label="Severity" value={newSeverity} onChange={(e) => setNewSeverity(e.target.value as 'low' | 'medium' | 'high')}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </Select>
          <Input
            label="Note"
            value={newSummary}
            onChange={(e) => setNewSummary(e.target.value)}
            placeholder="Describe the issue..."
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={!newSummary.trim()}>Add flag</Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="secondary" icon={<Plus size={12} />} onClick={() => setAdding(true)}>
          Add flag
        </Button>
      )}
    </div>
  );
}
