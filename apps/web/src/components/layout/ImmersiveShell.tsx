'use client';

import Link from 'next/link';
import * as React from 'react';
import { AccountMenu } from '../auth/AccountMenu';
import { cn } from '../../lib/utils';

type ImmersiveShellProps = {
  children: React.ReactNode;
  mainClassName?: string;
  contentClassName?: string;
  showTopNav?: boolean;
  style?: React.CSSProperties;
};

export function ImmersiveShell({
  children,
  mainClassName,
  contentClassName,
  showTopNav = true,
  style,
}: ImmersiveShellProps) {
  return (
    <main
      className={cn(
        'min-h-screen text-slate-900 bg-[radial-gradient(1200px_520px_at_50%_-8%,rgba(255,255,255,0.98),rgba(255,255,255,0)_62%),radial-gradient(900px_520px_at_12%_38%,rgba(59,130,246,0.44),rgba(59,130,246,0)_70%),radial-gradient(900px_520px_at_88%_38%,rgba(56,189,248,0.38),rgba(56,189,248,0)_70%),radial-gradient(1000px_540px_at_50%_100%,rgba(244,114,182,0.42),rgba(244,114,182,0)_76%),linear-gradient(180deg,#f8fbff_0%,#eef4ff_48%,#ffe8f4_100%)]',
        mainClassName
      )}
      style={style}
    >
      {showTopNav ? (
        <header className="fixed top-4 inset-x-0 z-50 flex justify-center px-4 md:px-6">
          <div className="flex w-full max-w-[1180px] items-center justify-between rounded-full bg-white px-8 py-3 md:px-10 shadow-md">
            <Link href="/" className="flex items-center gap-3">
              <span className="font-heading text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
                Homework Grader
              </span>
            </Link>

            <nav className="hidden items-center gap-8 text-base font-medium text-slate-900 md:flex">
              <Link href="/exams" className="transition-colors hover:text-slate-700">
                Exams
              </Link>
              <Link href="/rubrics" className="transition-colors hover:text-slate-700">
                Rubrics
              </Link>
              <Link href="/reviews" className="transition-colors hover:text-slate-700">
                Reviews
              </Link>
              <Link href="/courses" className="transition-colors hover:text-slate-700">
                Courses
              </Link>
              <Link href="/jobs/new" className="transition-colors hover:text-slate-700">
                Jobs
              </Link>
            </nav>

            <AccountMenu compact />
          </div>
        </header>
      ) : null}

      <div
        className={cn(
          'mx-auto flex min-h-screen w-full flex-col px-4 pb-8 pt-36 md:px-6 md:pb-10 md:pt-40',
          contentClassName
        )}
      >
        {children}
      </div>
    </main>
  );
}
