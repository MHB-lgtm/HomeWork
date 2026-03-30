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
            className="mb-1.5 block text-[13px] font-semibold text-(--text-primary)"
          >
            {label}
          </label>
        )}
        <textarea
          id={textareaId}
          ref={ref}
          className={cn(
            'flex min-h-20 w-full rounded-[var(--radius-md)] border bg-(--surface) px-3 py-2.5 text-sm text-(--text-primary)',
            'shadow-(--shadow-xs)',
            'transition-all duration-200 ease-(--ease)',
            'placeholder:text-(--text-quaternary)',
            'focus-visible:outline-none focus-visible:border-(--brand) focus-visible:ring-2 focus-visible:ring-(--brand)/15',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error
              ? 'border-(--error) focus-visible:border-(--error) focus-visible:ring-(--error)/15'
              : 'border-(--border) hover:border-(--border-hover)',
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-xs font-medium text-(--error)">{error}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export { Textarea };
