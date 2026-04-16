import * as React from 'react';
import { cn } from '../../lib/utils';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return <div className={cn('skeleton-line h-4 w-full', className)} {...props} />;
}

export function SkeletonLine({ className, ...props }: SkeletonProps) {
  return <div className={cn('skeleton-line h-4 w-full rounded', className)} {...props} />;
}

type CardSkeletonProps = React.HTMLAttributes<HTMLDivElement> & {
  lines?: number;
};

export function CardSkeleton({ className, lines = 3, ...props }: CardSkeletonProps) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-lg)] border border-(--border) bg-(--surface) p-5 shadow-(--shadow-xs)',
        className
      )}
      {...props}
    >
      <Skeleton className="mb-4 h-5 w-40" />
      <div className="space-y-2.5">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className={cn('h-4', i === lines - 1 ? 'w-2/3' : 'w-full')} />
        ))}
      </div>
    </div>
  );
}

export function SkeletonCard({ className, ...props }: CardSkeletonProps) {
  return <CardSkeleton className={className} {...props} />;
}

type TableRowSkeletonProps = React.HTMLAttributes<HTMLTableRowElement> & {
  columns?: number;
};

export function TableRowSkeleton({ columns = 4, className, ...props }: TableRowSkeletonProps) {
  return (
    <tr className={cn('border-b border-(--border-light)', className)} {...props}>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="p-3.5">
          <Skeleton className={cn('h-4', i === columns - 1 ? 'w-20' : 'w-full max-w-60')} />
        </td>
      ))}
    </tr>
  );
}

type SkeletonTableProps = React.HTMLAttributes<HTMLDivElement> & {
  columns?: number;
  rows?: number;
};

export function SkeletonTable({ columns = 4, rows = 5, className, ...props }: SkeletonTableProps) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-[var(--radius-lg)] border border-(--border) bg-(--surface) shadow-(--shadow-xs)',
        className
      )}
      {...props}
    >
      <table className="w-full">
        <thead>
          <tr className="border-b border-(--border) bg-(--surface-secondary)">
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="p-3.5">
                <Skeleton className="h-3 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <TableRowSkeleton key={i} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
