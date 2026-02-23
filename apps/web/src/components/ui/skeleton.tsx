import * as React from 'react';
import { cn } from '../../lib/utils';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return <div className={cn('animate-pulse rounded-md bg-slate-200/80', className)} {...props} />;
}

type CardSkeletonProps = React.HTMLAttributes<HTMLDivElement> & {
  lines?: number;
};

export function CardSkeleton({ className, lines = 3, ...props }: CardSkeletonProps) {
  return (
    <div
      className={cn('rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-[0_12px_35px_rgba(15,23,42,0.05)]', className)}
      {...props}
    >
      <Skeleton className="mb-4 h-5 w-40" />
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, index) => (
          <Skeleton key={index} className={cn('h-4', index === lines - 1 ? 'w-2/3' : 'w-full')} />
        ))}
      </div>
    </div>
  );
}

type TableRowSkeletonProps = React.HTMLAttributes<HTMLTableRowElement> & {
  columns?: number;
};

export function TableRowSkeleton({ columns = 4, className, ...props }: TableRowSkeletonProps) {
  return (
    <tr className={cn('border-b', className)} {...props}>
      {Array.from({ length: columns }).map((_, index) => (
        <td key={index} className="p-4">
          <Skeleton className={cn('h-4', index === columns - 1 ? 'w-20' : 'w-full max-w-[240px]')} />
        </td>
      ))}
    </tr>
  );
}
