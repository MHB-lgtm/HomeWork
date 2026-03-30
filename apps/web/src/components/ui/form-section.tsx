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
        'rounded-xl border border-(--border) bg-(--surface) p-5 shadow-(--shadow-xs)',
        className
      )}
      {...props}
    >
      <legend className="sr-only">{title}</legend>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-(--text-primary)">{title}</h3>
        {description && (
          <p className="mt-1 text-sm text-(--text-tertiary)">{description}</p>
        )}
      </div>
      <div className="space-y-4">{children}</div>
    </fieldset>
  );
}
