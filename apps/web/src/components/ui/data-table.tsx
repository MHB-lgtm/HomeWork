'use client';

import * as React from 'react';
import { cn } from '../../lib/utils';
import { EmptyState } from './empty-state';
import { Skeleton } from './skeleton';

export type Column<T> = {
  key: string;
  label: string;
  width?: string;
  render?: (row: T) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
};

type DataTableProps<T> = {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  onRowClick?: (row: T) => void;
  className?: string;
};

const alignClass: Record<string, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  loading,
  emptyMessage = 'No data found',
  emptyIcon,
  onRowClick,
  className,
}: DataTableProps<T>) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-[var(--radius-lg)] border border-(--border) bg-(--surface) shadow-(--shadow-xs)',
        className
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-150 text-sm">
          <thead>
            <tr className="border-b border-(--border) bg-linear-to-b from-(--surface-secondary)/70 to-(--surface-secondary)">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-4 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-(--text-tertiary)',
                    alignClass[col.align || 'left']
                  )}
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-(--border-light)">
                    {columns.map((col) => (
                      <td key={col.key} className="px-4 py-3.5">
                        <Skeleton className="h-4 w-full max-w-60" />
                      </td>
                    ))}
                  </tr>
                ))
              : data.map((row, rowIdx) => (
                  <tr
                    key={rowIdx}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      'border-b border-(--border-light) last:border-0',
                      'transition-colors duration-200 ease-(--ease)',
                      'hover:bg-(--surface-hover)',
                      onRowClick && 'cursor-pointer'
                    )}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          'px-4 py-3.5 text-(--text-primary)',
                          alignClass[col.align || 'left']
                        )}
                      >
                        {col.render
                          ? col.render(row)
                          : (row[col.key] as React.ReactNode) ?? '\u2014'}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {!loading && data.length === 0 && (
        <EmptyState
          icon={emptyIcon}
          title={emptyMessage}
          className="py-14"
        />
      )}
    </div>
  );
}
