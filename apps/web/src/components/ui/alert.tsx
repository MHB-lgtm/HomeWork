import * as React from 'react';
import { cn } from '../../lib/utils';
import { Info, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'info' | 'success' | 'warning' | 'error' | 'default' | 'destructive';
}

const variantConfig: Record<string, { bg: string; border: string; text: string; icon: React.ReactNode }> = {
  info: {
    bg: 'bg-(--info-subtle)',
    border: 'border-(--info)',
    text: 'text-(--info)',
    icon: <Info className="h-4 w-4" />,
  },
  success: {
    bg: 'bg-(--success-subtle)',
    border: 'border-(--success)',
    text: 'text-(--success)',
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  warning: {
    bg: 'bg-(--warning-subtle)',
    border: 'border-(--warning)',
    text: 'text-(--warning)',
    icon: <AlertTriangle className="h-4 w-4" />,
  },
  error: {
    bg: 'bg-(--error-subtle)',
    border: 'border-(--error)',
    text: 'text-(--error)',
    icon: <XCircle className="h-4 w-4" />,
  },
};

// Legacy mappings
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
          'relative flex gap-3 rounded-lg border p-4',
          config.bg,
          config.border,
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
        'mb-1 text-sm font-medium leading-none tracking-tight text-(--text-primary)',
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
      className={cn('text-sm text-(--text-secondary) [&_p]:leading-relaxed', className)}
      {...props}
    />
  )
);
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertTitle, AlertDescription };
