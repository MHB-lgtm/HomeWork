import * as React from 'react';
import { cn } from '../../lib/utils';
import { Info, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'info' | 'success' | 'warning' | 'error' | 'default' | 'destructive';
}

const variantConfig: Record<string, { bg: string; border: string; text: string; icon: React.ReactNode }> = {
  info: {
    bg: 'bg-(--info-subtle)',
    border: 'border-(--info)/20',
    text: 'text-(--info)',
    icon: <Info className="h-4 w-4" />,
  },
  success: {
    bg: 'bg-(--success-subtle)',
    border: 'border-(--success)/20',
    text: 'text-(--success)',
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  warning: {
    bg: 'bg-(--warning-subtle)',
    border: 'border-(--warning)/20',
    text: 'text-(--warning)',
    icon: <AlertTriangle className="h-4 w-4" />,
  },
  error: {
    bg: 'bg-(--error-subtle)',
    border: 'border-(--error)/20',
    text: 'text-(--error)',
    icon: <XCircle className="h-4 w-4" />,
  },
};

variantConfig.default = variantConfig.info;
variantConfig.destructive = variantConfig.error;

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = 'info', children, ...props }, ref) => {
    const config = variantConfig[variant] || variantConfig.info;

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(
          'relative flex gap-3 rounded-[var(--radius-lg)] border p-4',
          config.bg,
          config.border,
          'animate-in',
          className
        )}
        {...props}
      >
        <span className={cn('mt-0.5 shrink-0', config.text)}>{config.icon}</span>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    );
  }
);
Alert.displayName = 'Alert';

export interface AlertTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

const AlertTitle = React.forwardRef<HTMLHeadingElement, AlertTitleProps>(
  ({ className, ...props }, ref) => (
    <h5
      ref={ref}
      className={cn(
        'mb-1 text-[13px] font-semibold leading-tight tracking-tight text-(--text-primary)',
        className
      )}
      {...props}
    />
  )
);
AlertTitle.displayName = 'AlertTitle';

export interface AlertDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

const AlertDescription = React.forwardRef<HTMLParagraphElement, AlertDescriptionProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('text-[13px] text-(--text-secondary) leading-relaxed [&_p]:leading-relaxed', className)}
      {...props}
    />
  )
);
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertTitle, AlertDescription };
