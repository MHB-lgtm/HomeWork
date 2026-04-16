import * as React from 'react';
import { cn } from '../../lib/utils';

type FormSectionProps = React.HTMLAttributes<HTMLFieldSetElement> & {
  title: string;
  description?: string;
};

export function FormSection({
  className,
  title,
  description,
  children,
  ...props
}: FormSectionProps) {
  return (
    <fieldset
      className={cn(
        'rounded-[var(--radius-lg)] border border-(--border) bg-(--surface) p-6 shadow-(--shadow-xs)',
        className
      )}
      {...props}
    >
      <legend className="sr-only">{title}</legend>
      <div className="mb-6 border-b border-(--border-light) pb-5">
        <h3 className="text-[15px] font-semibold text-(--text-primary)">{title}</h3>
        {description && (
          <p className="mt-1 text-[13px] text-(--text-tertiary)">{description}</p>
        )}
      </div>
      <div className="space-y-5">{children}</div>
    </fieldset>
  );
}
