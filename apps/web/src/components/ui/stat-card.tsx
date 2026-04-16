import * as React from 'react';
import { cn } from '../../lib/utils';
import { ArrowUp, ArrowDown } from 'lucide-react';

type StatCardProps = React.HTMLAttributes<HTMLDivElement> & {
  label: string;
  value: string | number;
  trend?: { value: string; positive: boolean };
  icon?: React.ReactNode;
  accent?: string;
};

export function StatCard({
  className,
  label,
  value,
  trend,
  icon,
  accent,
  ...props
}: StatCardProps) {
  const accentColor = accent ?? 'var(--brand)';
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-(--border) bg-(--surface) px-6 py-8 text-center shadow-sm',
        'transition-all duration-(--duration) ease-(--ease)',
        'hover:shadow-md hover:-translate-y-0.5',
        'min-w-0',
        className
      )}
      {...props}
    >
      {/* Accent stripe top */}
      <div
        className="absolute top-0 inset-x-0 h-[3px]"
        style={{ background: accentColor }}
      />

      {icon && (
        <span
          className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl [&>svg]:h-5 [&>svg]:w-5"
          style={{
            background: `color-mix(in srgb, ${accentColor} 12%, transparent)`,
            color: accentColor,
          }}
        >
          {icon}
        </span>
      )}

      <div className="text-3xl sm:text-4xl font-bold tabular-nums tracking-tight text-(--text-primary) leading-none">
        {value}
      </div>
      <div className="mt-4 text-xs font-medium tracking-[0.18em] uppercase text-(--text-tertiary) truncate">
        {label}
      </div>

      {trend && (
        <div className="mt-5 flex items-center justify-center gap-1.5">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold',
              trend.positive
                ? 'bg-(--success-subtle) text-(--success)'
                : 'bg-(--error-subtle) text-(--error)'
            )}
          >
            {trend.positive ? (
              <ArrowUp className="h-3.5 w-3.5" />
            ) : (
              <ArrowDown className="h-3.5 w-3.5" />
            )}
            {trend.value}
          </span>
        </div>
      )}
    </div>
  );
}
