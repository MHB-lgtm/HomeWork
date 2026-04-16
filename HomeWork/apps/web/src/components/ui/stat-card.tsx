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
        'group relative overflow-hidden rounded-[var(--radius-lg)] border border-(--border) bg-linear-to-b from-white to-[#FAFBFC] p-5 shadow-(--shadow-xs)',
        'transition-all duration-(--duration-slow) ease-(--ease)',
        'hover:shadow-(--shadow-md) hover:border-(--border-hover) hover:-translate-y-0.5',
        className
      )}
      {...props}
    >
      <div className="absolute inset-x-0 top-0 h-[2px] bg-linear-to-r from-transparent via-(--brand-subtle) to-transparent opacity-0 transition-opacity duration-(--duration-slow) group-hover:opacity-100" />

      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-(--text-tertiary)">
            {label}
          </p>
          <p className="text-2xl font-bold tracking-tight text-(--text-primary)">
            {value}
          </p>
        </div>
        {icon && (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-(--brand-subtle) text-(--brand) transition-colors duration-(--duration) group-hover:bg-(--brand) group-hover:text-white [&>svg]:h-[18px] [&>svg]:w-[18px]">
            {icon}
          </span>
        )}
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1.5">
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold',
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
