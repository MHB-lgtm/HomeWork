'use client';

import * as React from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'default' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, icon, children, disabled, ...props }, ref) => {
    const resolvedVariant = variant === 'default' ? 'primary' : variant === 'outline' ? 'secondary' : variant;

    const variants: Record<string, string> = {
      primary:
        'bg-(--text-primary) text-white shadow-(--shadow-xs) hover:shadow-(--shadow-md) hover:-translate-y-px active:translate-y-0 active:shadow-(--shadow-xs)',
      secondary:
        'bg-(--surface) border border-(--border) text-(--text-primary) shadow-(--shadow-xs) hover:bg-(--surface-hover) hover:border-(--border-hover) hover:shadow-(--shadow-sm) hover:-translate-y-px active:translate-y-0',
      ghost:
        'bg-transparent text-(--text-secondary) hover:bg-(--surface-hover) hover:text-(--text-primary)',
      danger:
        'bg-(--error) text-white shadow-(--shadow-xs) hover:shadow-[0_4px_14px_-2px_rgba(239,68,68,0.3)] hover:-translate-y-px active:translate-y-0',
    };

    const sizes: Record<string, string> = {
      sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
      md: 'h-9 px-4 text-sm gap-2 rounded-[var(--radius-md)]',
      lg: 'h-11 px-6 text-sm gap-2 rounded-[var(--radius-lg)]',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center font-medium',
          'transition-all duration-(--duration) ease-(--ease)',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--brand) focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50',
          'select-none whitespace-nowrap cursor-pointer',
          variants[resolvedVariant] || variants.primary,
          sizes[size],
          className
        )}
        {...props}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        ) : icon ? (
          <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };
