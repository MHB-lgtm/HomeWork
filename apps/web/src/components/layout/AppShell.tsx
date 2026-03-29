'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AccountMenu } from '../auth/AccountMenu';
import { cn } from '../../lib/utils';

type NavItem = {
  href: string;
  label: string;
  title: string | ((pathname: string) => string);
  matches: (pathname: string) => boolean;
};

const matchesSegment = (pathname: string, href: string): boolean => {
  return pathname === href || pathname.startsWith(`${href}/`);
};

const navItems: NavItem[] = [
  {
    href: '/',
    label: 'Home',
    title: 'Dashboard',
    matches: (pathname) => pathname === '/',
  },
  {
    href: '/exams',
    label: 'Exams',
    title: 'Exams',
    matches: (pathname) => matchesSegment(pathname, '/exams'),
  },
  {
    href: '/rubrics',
    label: 'Rubrics',
    title: 'Rubrics',
    matches: (pathname) => matchesSegment(pathname, '/rubrics'),
  },
  {
    href: '/reviews',
    label: 'Reviews',
    title: (pathname) => (pathname === '/reviews' ? 'All Reviews' : 'Review Details'),
    matches: (pathname) => matchesSegment(pathname, '/reviews'),
  },
  {
    href: '/courses',
    label: 'Courses',
    title: (pathname) => (pathname === '/courses' ? 'Courses' : 'Course Details'),
    matches: (pathname) => matchesSegment(pathname, '/courses'),
  },
];

const getRouteTitle = (pathname: string): string => {
  const matched = navItems.find((item) => item.matches(pathname));
  if (!matched) {
    return 'Homework Grader';
  }
  return typeof matched.title === 'function' ? matched.title(pathname) : matched.title;
};

const immersivePrefixes = ['/exams', '/rubrics', '/reviews', '/courses'];

const isImmersiveRoutePath = (pathname: string): boolean => {
  if (pathname === '/') {
    return true;
  }
  return immersivePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
};

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname() || '/';
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const title = useMemo(() => getRouteTitle(pathname), [pathname]);
  const isImmersiveRoute = isImmersiveRoutePath(pathname);

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [pathname]);

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

  if (isImmersiveRoute) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-body text-body">
      <a
        href="#app-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-slate-900 focus:shadow-lg"
      >
        Skip to content
      </a>

      <div className="min-h-screen lg:flex">
        <aside className="group/sidebar hidden overflow-hidden border-r border-slate-200/80 bg-white/85 backdrop-blur transition-[width] duration-200 ease-out lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-3 lg:flex-col lg:hover:w-[252px] lg:focus-within:w-[252px]">
          <div className="min-w-[252px] h-full opacity-0 transition-opacity duration-150 ease-out group-hover/sidebar:opacity-100 group-focus-within/sidebar:opacity-100">
            <div className="flex h-16 items-center border-b border-slate-200/80 px-5">
              <p className="font-heading text-sm font-semibold tracking-[0.14em] text-slate-700 uppercase">
                Homework Grader
              </p>
            </div>
            <nav className="flex-1 space-y-1 p-3" aria-label="Primary">
              {navItems.map((item) => {
                const isActive = item.matches(pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'block overflow-hidden rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2',
                      isActive
                        ? 'bg-blue-600 text-white shadow-[0_8px_25px_rgba(37,99,235,0.25)]'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    )}
                  >
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>

        <div className="min-w-0 flex flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70">
            <div className="flex h-16 items-center justify-between gap-3 px-4 md:px-6">
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
              <h1 className="font-heading text-lg font-semibold tracking-tight text-slate-900 md:text-xl">
                {title}
              </h1>
              <div className="shrink-0">
                <AccountMenu compact />
              </div>
            </div>
          </header>

          <div id="app-content" className="flex-1 min-w-0">
            <div className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-6 md:py-8">{children}</div>
          </div>
        </div>
      </div>

      {isMobileNavOpen && (
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
              <p className="font-heading text-sm font-semibold tracking-[0.14em] text-slate-700 uppercase">
                Navigation
              </p>
              <button
                type="button"
                onClick={() => setIsMobileNavOpen(false)}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                aria-label="Close navigation menu"
              >
                Close
              </button>
            </div>
            <nav className="space-y-1.5" aria-label="Mobile primary">
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
      )}
    </div>
  );
}
