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
  icon?: React.ReactNode;
  gradient?: boolean | string;
};

export function PageHeader({
  className,
  title,
  subtitle,
  description,
  eyebrow,
  actions,
  backHref,
  icon,
  gradient,
  children,
  ...props
}: PageHeaderProps) {
  const resolvedDescription = subtitle || description;
  const isGradient = gradient === true || typeof gradient === 'string';
  const gradientClass =
    typeof gradient === 'string'
      ? gradient
      : 'from-teal-600 via-cyan-600 to-emerald-500';

  if (isGradient) {
    return (
      <header
        className={cn(
          'relative overflow-hidden rounded-[1.75rem] px-8 py-12 sm:px-12 sm:py-16 text-white shadow-lg',
          `bg-gradient-to-l ${gradientClass}`,
          className
        )}
        {...props}
      >
        <div className="hero-blur-tl" />
        <div className="hero-blur-br" />

        <div className="relative flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5 min-w-0">
            {backHref && (
              <Link
                href={backHref}
                className={cn(
                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                  'bg-white/20 backdrop-blur-sm text-white',
                  'transition-all duration-(--duration) hover:bg-white/30'
                )}
              >
                <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
              </Link>
            )}
            {icon && (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm [&>svg]:h-7 [&>svg]:w-7">
                {icon}
              </div>
            )}
            <div className="min-w-0 space-y-2.5">
              {eyebrow && (
                <div className="inline-flex items-center gap-2 rounded-full bg-white/20 backdrop-blur-sm px-3 py-1 text-xs font-medium tracking-[0.18em] uppercase">
                  {eyebrow}
                </div>
              )}
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight">
                {title}
              </h1>
              {resolvedDescription && (
                <p className="text-sm sm:text-base text-white/90 max-w-xl leading-relaxed">
                  {resolvedDescription}
                </p>
              )}
            </div>
          </div>
          {(actions || children) && (
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              {actions}
              {children}
            </div>
          )}
        </div>
      </header>
    );
  }

  return (
    <header
      className={cn(
        'flex flex-col gap-5 py-1 sm:flex-row sm:items-center sm:justify-between',
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-4 min-w-0">
        {backHref && (
          <Link
            href={backHref}
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
              'border border-(--border) text-(--text-tertiary) bg-(--surface)',
              'transition-all duration-(--duration) ease-(--ease)',
              'hover:bg-(--surface-hover) hover:text-(--text-primary) hover:border-(--border-hover)'
            )}
          >
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
          </Link>
        )}
        <div className="space-y-2 min-w-0">
          {eyebrow && (
            <p className="text-xs font-medium tracking-[0.18em] uppercase text-(--brand)">
              {eyebrow}
            </p>
          )}
          <h1 className="text-2xl font-extrabold tracking-tight text-(--text-primary) leading-tight sm:text-3xl">
            {title}
          </h1>
          {resolvedDescription && (
            <p className="text-sm text-(--text-tertiary) max-w-xl leading-relaxed">{resolvedDescription}</p>
          )}
        </div>
      </div>
      {(actions || children) && (
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {actions}
          {children}
        </div>
      )}
    </header>
  );
}
