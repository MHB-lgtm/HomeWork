import * as React from 'react';
import { Badge } from './badge';
import { cn } from '../../lib/utils';

type StatusValue = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED' | string | null | undefined;

type StatusStyle = {
  variant: 'default' | 'secondary' | 'outline' | 'destructive';
  className?: string;
  label: string;
};

const normalizeStatus = (status: StatusValue): string => {
  if (!status) {
    return 'UNKNOWN';
  }
  return String(status).toUpperCase();
};

const statusStyles: Record<string, StatusStyle> = {
  PENDING: { variant: 'outline', className: 'border-yellow-200 bg-yellow-100 text-yellow-800', label: 'PENDING' },
  PROPOSED: { variant: 'outline', className: 'border-yellow-200 bg-yellow-100 text-yellow-800', label: 'PROPOSED' },
  RUNNING: { variant: 'outline', className: 'border-blue-200 bg-blue-100 text-blue-800', label: 'RUNNING' },
  LOADING: { variant: 'outline', className: 'border-blue-200 bg-blue-100 text-blue-800', label: 'LOADING' },
  DONE: { variant: 'outline', className: 'border-emerald-200 bg-emerald-100 text-emerald-800', label: 'DONE' },
  FAILED: { variant: 'outline', className: 'border-red-200 bg-red-100 text-red-800', label: 'FAILED' },
  NOT_INDEXED: { variant: 'outline', className: 'border-gray-200 bg-gray-100 text-gray-800', label: 'NOT INDEXED' },
  UNKNOWN: { variant: 'outline', className: 'border-gray-200 bg-gray-100 text-gray-800', label: 'UNKNOWN' },
};

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  status: StatusValue;
  label?: string;
}

export function StatusBadge({ status, label, className, ...props }: StatusBadgeProps) {
  const normalized = normalizeStatus(status);
  const style = statusStyles[normalized] || statusStyles.UNKNOWN;
  const resolvedLabel = label || style.label;

  return (
    <Badge
      variant={style.variant}
      className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', style.className, className)}
      aria-label={`Status ${resolvedLabel}`}
      {...props}
    >
      {resolvedLabel}
    </Badge>
  );
}
