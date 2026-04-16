'use client';

import { cn } from '../../lib/utils';
import { Bot, User, Send, Edit3, Flag, Save, Clock } from 'lucide-react';

export type AuditEntry = {
  id: string;
  timestamp: string;
  actor: 'ai' | 'lecturer' | 'system';
  action: string;
  detail?: string;
};

type AuditTimelineProps = {
  entries: AuditEntry[];
  className?: string;
};

const actorConfig = {
  ai: { icon: <Bot size={12} />, label: 'AI', color: 'text-(--info)' },
  lecturer: { icon: <User size={12} />, label: 'Lecturer', color: 'text-(--brand)' },
  system: { icon: <Clock size={12} />, label: 'System', color: 'text-(--text-tertiary)' },
};

const formatTime = (ts: string) => {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export function AuditTimeline({ entries, className }: AuditTimelineProps) {
  if (entries.length === 0) {
    return (
      <div className={cn('text-center py-6', className)}>
        <Clock size={16} className="mx-auto text-(--text-quaternary) mb-2" />
        <p className="text-xs text-(--text-tertiary)">No audit history yet</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-0', className)}>
      {entries.map((entry, i) => {
        const config = actorConfig[entry.actor];
        const isLast = i === entries.length - 1;

        return (
          <div key={entry.id} className="flex gap-3">
            {/* Timeline line + dot */}
            <div className="flex flex-col items-center">
              <div className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-(--border-light) bg-(--surface)', config.color)}>
                {config.icon}
              </div>
              {!isLast && <div className="w-px flex-1 bg-(--border-light) my-1" />}
            </div>

            {/* Content */}
            <div className={cn('pb-4 min-w-0 flex-1', isLast && 'pb-0')}>
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[12px] font-medium text-(--text-primary)">{entry.action}</p>
                <span className="text-[10px] text-(--text-quaternary) whitespace-nowrap shrink-0">{formatTime(entry.timestamp)}</span>
              </div>
              {entry.detail && (
                <p className="text-[11px] text-(--text-tertiary) mt-0.5 leading-relaxed">{entry.detail}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
