import * as React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'brand' | 'success' | 'warning' | 'error' | 'info' | 'secondary' | 'outline' | 'destructive';
  size?: 'sm' | 'md';
}

const variantStyles: Record<string, string> = {
  default: 'bg-(--surface-secondary) text-(--text-secondary) border border-(--border-light)',
  brand: 'bg-(--brand-subtle) text-(--brand) border border-(--brand)/10',
  success: 'bg-(--success-subtle) text-(--success) border border-(--success)/10',
  warning: 'bg-(--warning-subtle) text-(--warning) border border-(--warning)/10',
  error: 'bg-(--error-subtle) text-(--error) border border-(--error)/10',
  info: 'bg-(--info-subtle) text-(--info) border border-(--info)/10',
  secondary: 'bg-(--surface-secondary) text-(--text-secondary) border border-(--border-light)',
  outline: 'border border-(--border) bg-transparent text-(--text-secondary)',
  destructive: 'bg-(--error-subtle) text-(--error) border border-(--error)/10',
};

const sizeStyles: Record<string, string> = {
  sm: 'px-2 py-0.5 text-[10px] leading-4',
  md: 'px-2.5 py-0.5 text-[11px] leading-4',
};

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'default', size = 'md', ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'inline-flex items-center rounded-full font-semibold tracking-wide status-transition',
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
