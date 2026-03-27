import * as React from 'react';
import { cn } from '../../lib/utils';

type StatusKey =
  | 'pending'
  | 'active'
  | 'done'
  | 'error'
  | 'locked'
  | 'published'
  | 'review'
  | 'draft';

type StatusConfig = {
  label: string;
  dot: string;
  bg: string;
  text: string;
};

const statusMap: Record<StatusKey, StatusConfig> = {
  pending: {
    label: 'Pending',
    dot: 'bg-(--warning)',
    bg: 'bg-(--warning-subtle)',
    text: 'text-(--warning)',
  },
  active: {
    label: 'Active',
    dot: 'bg-(--success)',
    bg: 'bg-(--success-subtle)',
    text: 'text-(--success)',
  },
  done: {
    label: 'Done',
    dot: 'bg-(--success)',
    bg: 'bg-(--success-subtle)',
    text: 'text-(--success)',
  },
  error: {
    label: 'Error',
    dot: 'bg-(--error)',
    bg: 'bg-(--error-subtle)',
    text: 'text-(--error)',
  },
  locked: {
    label: 'Locked',
    dot: 'bg-(--text-quaternary)',
    bg: 'bg-(--surface-secondary)',
    text: 'text-(--text-tertiary)',
  },
  published: {
    label: 'Published',
    dot: 'bg-(--brand)',
    bg: 'bg-(--brand-subtle)',
    text: 'text-(--brand)',
  },
  review: {
    label: 'In Review',
    dot: 'bg-(--info)',
    bg: 'bg-(--info-subtle)',
    text: 'text-(--info)',
  },
  draft: {
    label: 'Draft',
    dot: 'bg-(--text-quaternary)',
    bg: 'bg-(--surface-secondary)',
    text: 'text-(--text-tertiary)',
  },
};

// Legacy uppercase status mapping
const legacyMap: Record<string, StatusKey> = {
  PENDING: 'pending',
  PROPOSED: 'pending',
  RUNNING: 'active',
  LOADING: 'active',
  DONE: 'done',
  FAILED: 'error',
  NOT_INDEXED: 'locked',
  UNKNOWN: 'locked',
};

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: StatusKey | string | null | undefined;
  label?: string;
  size?: 'sm' | 'md';
}

export function StatusBadge({
  status,
  label: labelOverride,
  size = 'md',
  className,
  ...props
}: StatusBadgeProps) {
  const normalizedKey = status
    ? (legacyMap[String(status).toUpperCase()] ?? (String(status).toLowerCase() as StatusKey))
    : 'locked';

  const config = statusMap[normalizedKey as StatusKey] || statusMap.locked;
  const displayLabel = labelOverride || config.label;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        config.bg,
        config.text,
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        className
      )}
      aria-label={`Status ${displayLabel}`}
      {...props}
    >
      <span
        className={cn(
          'shrink-0 rounded-full',
          config.dot,
          size === 'sm' ? 'h-1.5 w-1.5' : 'h-1.5 w-1.5'
        )}
      />
      {displayLabel}
    </span>
  );
}
