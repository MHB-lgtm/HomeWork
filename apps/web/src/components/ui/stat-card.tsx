import * as React from 'react';
import { cn } from '../../lib/utils';
import { ArrowUp, ArrowDown } from 'lucide-react';

type StatCardProps = React.HTMLAttributes<HTMLDivElement> & {
  label: string;
  value: string | number;
  trend?: { value: string; positive: boolean };
  icon?: React.ReactNode;
};

export function StatCard({
  className,
  label,
  value,
  trend,
  icon,
  ...props
}: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-(--border) bg-(--surface) p-5 shadow-(--shadow-xs)',
        className
      )}
      {...props}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-(--text-tertiary)">
            {label}
          </p>
          <p className="text-2xl font-semibold tracking-tight text-(--text-primary)">
            {value}
          </p>
        </div>
        {icon && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-(--surface-secondary) text-(--text-tertiary) [&>svg]:h-4 [&>svg]:w-4">
            {icon}
          </span>
        )}
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1">
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium',
              trend.positive
                ? 'bg-(--success-subtle) text-(--success)'
                : 'bg-(--error-subtle) text-(--error)'
            )}
          >
            {trend.positive ? (
              <ArrowUp className="h-3 w-3" />
            ) : (
              <ArrowDown className="h-3 w-3" />
            )}
            {trend.value}
          </span>
        </div>
      )}
    </div>
  );
}
