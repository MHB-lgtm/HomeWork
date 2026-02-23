import * as React from 'react';
import { cn } from '../../lib/utils';

type PageHeaderProps = React.HTMLAttributes<HTMLDivElement> & {
  title: React.ReactNode;
  description?: React.ReactNode;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
};

export function PageHeader({
  className,
  title,
  description,
  eyebrow,
  actions,
  ...props
}: PageHeaderProps) {
  return (
    <header className={cn('flex flex-wrap items-start justify-between gap-4', className)} {...props}>
      <div className="space-y-2">
        {eyebrow ? (
          <p className="text-xs font-semibold tracking-[0.2em] text-slate-500 uppercase">{eyebrow}</p>
        ) : null}
        <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">{title}</h1>
        {description ? <p className="max-w-3xl text-sm text-slate-600 md:text-base">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
