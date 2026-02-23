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
    <section
      className={cn(
        'rounded-2xl border border-dashed border-slate-300/90 bg-slate-50/70 px-6 py-10 text-center',
        className
      )}
      {...props}
    >
      {icon ? <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center text-slate-400">{icon}</div> : null}
      <h2 className="font-heading text-lg font-semibold text-slate-900">{title}</h2>
      {description ? <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </section>
  );
}
