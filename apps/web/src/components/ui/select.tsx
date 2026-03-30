import * as React from 'react';
import { cn } from '../../lib/utils';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, id, children, ...props }, ref) => {
    const selectId = id || React.useId();

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={selectId}
            className="mb-1.5 block text-sm font-medium text-(--text-primary)"
          >
            {label}
          </label>
        )}
        <select
          id={selectId}
          ref={ref}
          className={cn(
            'flex h-9 w-full appearance-none rounded-lg border bg-(--surface) px-3 pr-8 text-sm text-(--text-primary)',
            'transition-colors duration-(--duration) ease-(--ease)',
            'focus-visible:outline-none focus-visible:border-(--border-focus) focus-visible:ring-1 focus-visible:ring-(--border-focus)',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'bg-[url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E")] bg-[length:16px] bg-[right_8px_center] bg-no-repeat',
            error
              ? 'border-(--error) focus-visible:border-(--error) focus-visible:ring-(--error)'
              : 'border-(--border)',
            className
          )}
          {...props}
        >
          {children}
        </select>
        {error && (
          <p className="mt-1.5 text-xs text-(--error)">{error}</p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

export { Select };
