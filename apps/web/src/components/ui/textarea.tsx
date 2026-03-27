import * as React from 'react';
import { cn } from '../../lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const textareaId = id || React.useId();

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={textareaId}
            className="mb-1.5 block text-sm font-medium text-(--text-primary)"
          >
            {label}
          </label>
        )}
        <textarea
          id={textareaId}
          ref={ref}
          className={cn(
            'flex min-h-20 w-full rounded-lg border bg-(--surface) px-3 py-2 text-sm text-(--text-primary)',
            'transition-colors duration-(--duration) ease-(--ease)',
            'placeholder:text-(--text-quaternary)',
            'focus-visible:outline-none focus-visible:border-(--border-focus) focus-visible:ring-1 focus-visible:ring-(--border-focus)',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error
              ? 'border-(--error) focus-visible:border-(--error) focus-visible:ring-(--error)'
              : 'border-(--border)',
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-xs text-(--error)">{error}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export { Textarea };
