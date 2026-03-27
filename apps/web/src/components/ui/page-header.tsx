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
        'flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between',
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-3">
        {backHref && (
          <Link
            href={backHref}
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
              'border border-(--border) text-(--text-tertiary)',
              'transition-colors duration-(--duration) ease-(--ease)',
              'hover:bg-(--surface-hover) hover:text-(--text-primary)'
            )}
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
        )}
        <div className="space-y-1">
          {eyebrow && (
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-(--text-quaternary)">
              {eyebrow}
            </p>
          )}
          <h1 className="text-xl font-semibold tracking-tight text-(--text-primary)">
            {title}
          </h1>
          {resolvedDescription && (
            <p className="text-sm text-(--text-tertiary)">{resolvedDescription}</p>
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
