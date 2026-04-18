'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AccountMenu } from '../auth/AccountMenu';
import { cn } from '../../lib/utils';
import { workspaceNavItems, workspaceRoleLabel, type WorkspaceRole } from './workspace-nav';

type WorkspaceShellProps = {
  role: WorkspaceRole;
  children: React.ReactNode;
};

export function WorkspaceShell({ role, children }: WorkspaceShellProps) {
  const pathname = usePathname() || (role === 'student' ? '/assignments' : '/');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isDesktopNavOpen, setIsDesktopNavOpen] = useState(false);
  const navItems = workspaceNavItems[role];
  const homeHref = role === 'student' ? '/assignments' : '/';
  const hideTopHeader = role === 'staff' && /^\/reviews\/[^/]+$/.test(pathname);

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onToggleDesktopNav = () => {
      setIsDesktopNavOpen((prev) => !prev);
    };

    window.addEventListener('workspace:toggle-desktop-nav', onToggleDesktopNav as EventListener);
    return () => {
      window.removeEventListener('workspace:toggle-desktop-nav', onToggleDesktopNav as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!isMobileNavOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMobileNavOpen(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileNavOpen]);

  return (
    <div className="min-h-screen text-slate-900 bg-[radial-gradient(1200px_520px_at_50%_-8%,rgba(255,255,255,0.98),rgba(255,255,255,0)_62%),radial-gradient(900px_520px_at_12%_38%,rgba(59,130,246,0.24),rgba(59,130,246,0)_70%),radial-gradient(900px_520px_at_88%_38%,rgba(56,189,248,0.2),rgba(56,189,248,0)_70%),radial-gradient(1000px_540px_at_50%_100%,rgba(244,114,182,0.18),rgba(244,114,182,0)_76%),linear-gradient(180deg,#f8fbff_0%,#eef4ff_48%,#f8fafc_100%)]">
      <a
        href="#app-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-slate-900 focus:shadow-lg"
      >
        Skip to content
      </a>

      <div className="min-h-screen lg:flex lg:h-screen lg:overflow-hidden">
        <aside
          id="workspace-desktop-nav"
          className={cn(
            'hidden overflow-hidden bg-white/78 backdrop-blur transition-[width,border-color] duration-200 ease-out lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col',
            isDesktopNavOpen ? 'lg:w-60 lg:border-r lg:border-slate-200/70' : 'lg:w-0 lg:border-r-0'
          )}
        >
          <div
            className={cn(
              'flex h-16 items-center border-b border-slate-200/70 transition-[padding] duration-200 ease-out',
              isDesktopNavOpen ? 'justify-between px-4' : 'justify-center px-3'
            )}
          >
            <button
              type="button"
              onClick={() => setIsDesktopNavOpen((prev) => !prev)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
              aria-label={isDesktopNavOpen ? 'Collapse navigation' : 'Expand navigation'}
              aria-expanded={isDesktopNavOpen}
            >
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 4h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M3 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            <Link
              href={homeHref}
              className={cn(
                'min-w-0 items-center gap-3',
                isDesktopNavOpen ? 'flex' : 'hidden'
              )}
              title="Homework Grader"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-300 text-[10px] font-semibold tracking-[0.18em] text-slate-700">
                HG
              </div>
              <div className="min-w-0 overflow-hidden">
                <p className="truncate font-heading text-sm font-semibold tracking-[0.14em] text-slate-700 uppercase">
                  Homework Grader
                </p>
                <p className="truncate text-xs text-slate-500">{workspaceRoleLabel[role]}</p>
              </div>
            </Link>
          </div>
          <nav className="flex-1 space-y-1 px-2 py-3" aria-label={`${workspaceRoleLabel[role]} navigation`}>
            {navItems.map((item) => {
              const isActive = item.matches(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  title={item.label}
                  className={cn(
                    'flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2',
                    isActive
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  )}
                >
                  <span className="flex w-4 shrink-0 items-center justify-center text-[10px] font-semibold uppercase tracking-[0.18em] text-current">
                    {item.label.charAt(0)}
                  </span>
                  <span
                    className={cn(
                      'min-w-0 overflow-hidden whitespace-nowrap transition-opacity duration-150 ease-out',
                      isDesktopNavOpen ? 'opacity-100' : 'opacity-0'
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 flex flex-1 flex-col lg:h-screen lg:overflow-hidden">
          <main id="app-content" className={cn('min-h-0 flex-1', hideTopHeader ? 'overflow-hidden' : 'overflow-auto')}>
            <div className={cn('flex flex-col', hideTopHeader ? 'h-full min-h-0' : 'min-h-full')}>
              {hideTopHeader ? null : (
                <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70">
                  <div className="flex h-16 items-center justify-between gap-3 px-4 md:px-6">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setIsDesktopNavOpen((prev) => !prev)}
                        className="hidden h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 lg:flex"
                        aria-label={isDesktopNavOpen ? 'Collapse navigation' : 'Expand navigation'}
                        aria-expanded={isDesktopNavOpen}
                      >
                        <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                          <path d="M3 4h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          <path d="M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          <path d="M3 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsMobileNavOpen(true)}
                        className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 lg:hidden"
                        aria-label="Open navigation menu"
                        aria-expanded={isMobileNavOpen}
                        aria-controls="mobile-nav-drawer"
                      >
                        Menu
                      </button>
                      <div className="space-y-0.5">
                        <p className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
                          Homework Grader
                        </p>
                        <p className="font-heading text-lg font-semibold tracking-tight text-slate-900">
                          {workspaceRoleLabel[role]}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0">
                      <AccountMenu compact />
                    </div>
                  </div>
                </header>
              )}

              <div className="flex min-h-0 flex-1 flex-col px-4 py-6 md:px-6 md:py-8">
                {children}
              </div>
            </div>
          </main>
        </div>
      </div>

      {isMobileNavOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setIsMobileNavOpen(false)}
            aria-label="Close navigation menu overlay"
          />
          <aside
            id="mobile-nav-drawer"
            className="relative h-full w-[272px] max-w-[85vw] border-r border-slate-200/80 bg-white p-4 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between border-b border-slate-200/80 pb-3">
              <div>
                <p className="font-heading text-sm font-semibold tracking-[0.14em] text-slate-700 uppercase">
                  Homework Grader
                </p>
                <p className="text-xs text-slate-500">{workspaceRoleLabel[role]}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileNavOpen(false)}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                aria-label="Close navigation menu"
              >
                Close
              </button>
            </div>
            <nav className="space-y-1.5" aria-label="Mobile navigation">
              {navItems.map((item) => {
                const isActive = item.matches(pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'block rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2',
                      isActive ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
