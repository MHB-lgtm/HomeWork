import * as React from 'react';
import Link from 'next/link';
import { cn } from '../../lib/utils';
import { ChevronLeft } from 'lucide-react';

type PageHeaderProps = React.HTMLAttributes<HTMLDivElement> & {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  description?: React.ReactNode;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
  backHref?: string;
};

export function PageHeader({
  className,
  title,
  subtitle,
  description,
  eyebrow,
  actions,
  backHref,
  children,
  ...props
}: PageHeaderProps) {
  const resolvedDescription = subtitle || description;

  return (
    <header
      className={cn(
        'flex flex-col gap-4 pb-2 sm:flex-row sm:items-center sm:justify-between',
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-3">
        {backHref && (
          <Link
            href={backHref}
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)]',
              'border border-(--border) text-(--text-tertiary)',
              'transition-all duration-(--duration) ease-(--ease)',
              'hover:bg-(--surface-hover) hover:text-(--text-primary) hover:border-(--border-hover) hover:-translate-x-0.5'
            )}
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
        )}
        <div className="space-y-1">
          {eyebrow && (
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-(--brand)">
              {eyebrow}
            </p>
          )}
          <h1 className="text-xl font-bold tracking-tight text-(--text-primary) sm:text-2xl">
            {title}
          </h1>
          {resolvedDescription && (
            <p className="text-sm text-(--text-tertiary) max-w-lg">{resolvedDescription}</p>
          )}
        </div>
      </div>
      {(actions || children) && (
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          {children}
        </div>
      )}
    </header>
  );
}
