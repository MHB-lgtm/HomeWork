import * as React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'brand' | 'success' | 'warning' | 'error' | 'info' | 'secondary' | 'outline' | 'destructive';
  size?: 'sm' | 'md';
}

const variantStyles: Record<string, string> = {
  default: 'bg-(--surface-secondary) text-(--text-secondary)',
  brand: 'bg-(--brand-subtle) text-(--brand)',
  success: 'bg-(--success-subtle) text-(--success)',
  warning: 'bg-(--warning-subtle) text-(--warning)',
  error: 'bg-(--error-subtle) text-(--error)',
  info: 'bg-(--info-subtle) text-(--info)',
  // Legacy variants for backward compatibility
  secondary: 'bg-(--surface-secondary) text-(--text-secondary)',
  outline: 'border border-(--border) bg-transparent text-(--text-secondary)',
  destructive: 'bg-(--error-subtle) text-(--error)',
};

const sizeStyles: Record<string, string> = {
  sm: 'px-2 py-0.5 text-[11px]',
  md: 'px-2.5 py-0.5 text-xs',
};

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'default', size = 'md', ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        'transition-colors duration-(--duration) ease-(--ease)',
        variantStyles[variant] || variantStyles.default,
        sizeStyles[size],
        className
      )}
      {...props}
    />
  )
);

Badge.displayName = 'Badge';

export { Badge };
