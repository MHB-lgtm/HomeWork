import * as React from 'react';
import { cn } from '../../lib/utils';

type EmptyStateProps = React.HTMLAttributes<HTMLDivElement> & {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
};

export function EmptyState({
  className,
  title,
  description,
  icon,
  action,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 text-center',
        className
      )}
      {...props}
    >
      {icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-b from-(--surface-secondary) to-(--surface-tertiary)/50 text-(--text-tertiary) shadow-inner [&>svg]:h-6 [&>svg]:w-6">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-semibold text-(--text-primary)">{title}</h3>
      {description && (
        <p className="mx-auto mt-2 max-w-xs text-sm text-(--text-tertiary) leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
