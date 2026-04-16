import * as React from 'react';
import { cn } from '../../lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  hover?: boolean;
  elevated?: boolean;
}

const paddingMap: Record<string, string> = {
  none: '',
  sm: 'px-5 py-6',
  md: 'px-6 py-8',
  lg: 'px-8 py-10',
  xl: 'px-10 py-12',
};

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, padding, hover, elevated, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-2xl border border-(--border) bg-(--surface) shadow-sm',
        'transition-all duration-200 ease-(--ease)',
        elevated && 'shadow-md',
        hover && 'hover:shadow-md hover:-translate-y-0.5',
        padding && paddingMap[padding],
        className
      )}
      {...props}
    />
  )
);
Card.displayName = 'Card';

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex flex-col space-y-2 px-6 pb-5 pt-6', className)}
      {...props}
    />
  )
);
CardHeader.displayName = 'CardHeader';

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn(
        'text-lg font-bold leading-snug tracking-tight text-(--text-primary)',
        className
      )}
      {...props}
    />
  )
);
CardTitle.displayName = 'CardTitle';

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}

const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('px-6 pb-6 pt-0', className)} {...props} />
  )
);
CardContent.displayName = 'CardContent';

export { Card, CardHeader, CardTitle, CardContent };
