import * as React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, hint, icon, id, ...props }, ref) => {
    const inputId = id || React.useId();

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="mb-1.5 block text-[13px] font-semibold text-(--text-primary)"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-(--text-tertiary) [&>svg]:h-4 [&>svg]:w-4">
              {icon}
            </span>
          )}
          <input
            id={inputId}
            type={type}
            ref={ref}
            className={cn(
              'flex h-9 w-full rounded-[var(--radius-md)] border bg-(--surface) px-3 text-sm text-(--text-primary)',
              'shadow-(--shadow-xs)',
              'transition-all duration-200 ease-(--ease)',
              'placeholder:text-(--text-quaternary)',
              'focus-visible:outline-none focus-visible:border-(--brand) focus-visible:ring-2 focus-visible:ring-(--brand)/15',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'file:border-0 file:bg-transparent file:text-sm file:font-medium',
              error
                ? 'border-(--error) focus-visible:border-(--error) focus-visible:ring-(--error)/15'
                : 'border-(--border) hover:border-(--border-hover)',
              icon && 'pl-9',
              className
            )}
            {...props}
          />
        </div>
        {error && (
          <p className="mt-1.5 text-xs font-medium text-(--error)">{error}</p>
        )}
        {hint && !error && (
          <p className="mt-1.5 text-xs text-(--text-tertiary)">{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
