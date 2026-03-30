'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { AccountMenu } from '../auth/AccountMenu';
import { cn } from '../../lib/utils';
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  ClipboardCheck,
  PenTool,
  Menu,
  X,
  ChevronRight,
  GraduationCap,
} from 'lucide-react';

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  matches: (p: string) => boolean;
};

const staffNavItems: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: <LayoutDashboard size={18} />, matches: (p) => p === '/' },
  { href: '/courses', label: 'Courses', icon: <BookOpen size={18} />, matches: (p) => p.startsWith('/courses') },
  { href: '/exams', label: 'Exams', icon: <FileText size={18} />, matches: (p) => p.startsWith('/exams') },
  { href: '/reviews', label: 'Reviews', icon: <ClipboardCheck size={18} />, matches: (p) => p.startsWith('/reviews') },
  { href: '/rubrics', label: 'Rubrics', icon: <PenTool size={18} />, matches: (p) => p.startsWith('/rubrics') },
];

function getPageTitle(pathname: string): string {
  if (pathname === '/') return 'Dashboard';
  if (pathname.startsWith('/courses/')) return 'Course Details';
  if (pathname === '/courses') return 'Courses';
  if (pathname === '/exams') return 'Exams';
  if (pathname.startsWith('/reviews/')) return 'Review Details';
  if (pathname === '/reviews') return 'Reviews';
  if (pathname === '/rubrics') return 'Rubrics';
  if (pathname === '/assignments') return 'Assignments';
  if (pathname.startsWith('/assignments/')) return 'Assignment';
  if (pathname === '/results') return 'Results';
  if (pathname.startsWith('/results/')) return 'Result';
  return 'Homework Grader';
}

function getBreadcrumbs(pathname: string): { label: string; href?: string }[] {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return [{ label: 'Dashboard' }];

  const labelMap: Record<string, string> = {
    courses: 'Courses',
    exams: 'Exams',
    reviews: 'Reviews',
    rubrics: 'Rubrics',
    assignments: 'Assignments',
    results: 'Results',
  };

  const crumbs: { label: string; href?: string }[] = [{ label: 'Home', href: '/' }];
  let path = '';

  for (const seg of segments) {
    path += `/${seg}`;
    const label = labelMap[seg] || (seg.length > 12 ? `${seg.slice(0, 10)}...` : seg);
    crumbs.push({ label, href: path });
  }

  delete crumbs[crumbs.length - 1].href;
  return crumbs;
}

function SidebarNav({
  pathname,
  collapsed,
  onNav,
}: {
  pathname: string;
  collapsed: boolean;
  onNav?: () => void;
}) {
  return (
    <nav className="flex-1 overflow-y-auto px-3 pt-4 pb-2" aria-label="Main navigation">
      <div className="space-y-1">
        {staffNavItems.map((item) => {
          const active = item.matches(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNav}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150',
                collapsed && 'justify-center px-2',
                active
                  ? 'bg-(--brand) text-white shadow-sm'
                  : 'text-(--text-secondary) hover:bg-(--surface-hover) hover:text-(--text-primary)'
              )}
            >
              <span className={cn(
                'shrink-0 transition-colors',
                active ? 'text-white' : 'text-(--text-tertiary) group-hover:text-(--text-secondary)'
              )}>
                {item.icon}
              </span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const breadcrumbs = getBreadcrumbs(pathname);
  const pageTitle = getPageTitle(pathname);

  return (
    <div className="flex h-screen overflow-hidden bg-(--bg)">
      {/* ─── Desktop Sidebar ─── */}
      <aside
        className={cn(
          'hidden lg:flex lg:flex-col lg:shrink-0 border-r border-(--border-light) bg-(--surface) transition-[width] duration-200 ease-(--ease)',
          collapsed ? 'w-[var(--sidebar-collapsed)]' : 'w-[var(--sidebar-width)]'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Brand */}
          <div className={cn(
            'flex items-center h-[var(--topbar-height)] border-b border-(--border-light)',
            collapsed ? 'justify-center px-2' : 'gap-3 px-5'
          )}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-(--brand) text-white">
              <GraduationCap size={16} />
            </div>
            {!collapsed && (
              <span className="text-sm font-bold tracking-tight text-(--text-primary)">
                Homework Grader
              </span>
            )}
          </div>

          {/* Navigation */}
          <SidebarNav pathname={pathname} collapsed={collapsed} />

          {/* Bottom section */}
          <div className="border-t border-(--border-light) p-3">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-(--text-tertiary)',
                'transition-colors hover:bg-(--surface-hover) hover:text-(--text-primary)',
                collapsed && 'justify-center px-2'
              )}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <ChevronRight
                size={16}
                className={cn('shrink-0 transition-transform duration-200', !collapsed && 'rotate-180')}
              />
              {!collapsed && <span>Collapse</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* ─── Main Area ─── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex h-[var(--topbar-height)] shrink-0 items-center gap-3 border-b border-(--border-light) bg-(--surface)/80 px-4 backdrop-blur-sm lg:px-6">
          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-(--text-tertiary) transition-colors hover:bg-(--surface-hover) hover:text-(--text-primary) lg:hidden"
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>

          {/* Breadcrumbs */}
          <nav className="hidden items-center gap-1 text-[13px] overflow-hidden md:flex" aria-label="Breadcrumb">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1 min-w-0">
                {i > 0 && <ChevronRight size={12} className="shrink-0 text-(--text-quaternary)" />}
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="truncate text-(--text-tertiary) hover:text-(--text-primary) transition-colors"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="truncate font-medium text-(--text-primary)">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>

          {/* Mobile page title */}
          <h1 className="text-sm font-semibold text-(--text-primary) md:hidden">{pageTitle}</h1>

          <div className="flex-1" />

          {/* Right side */}
          <div className="flex items-center gap-2">
            <AccountMenu compact />
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1200px] px-4 py-6 md:px-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
      </div>

      {/* ─── Mobile Drawer ─── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
            onClick={() => setMobileOpen(false)}
            aria-label="Close"
          />
          <aside className="relative h-full w-[280px] max-w-[85vw] border-r border-(--border-light) bg-(--surface) shadow-xl animate-slide-down">
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between h-[var(--topbar-height)] border-b border-(--border-light) px-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-(--brand) text-white">
                    <GraduationCap size={16} />
                  </div>
                  <span className="text-sm font-bold tracking-tight text-(--text-primary)">
                    Homework Grader
                  </span>
                </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg p-1.5 text-(--text-tertiary) hover:bg-(--surface-hover)"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>
              <SidebarNav pathname={pathname} collapsed={false} onNav={() => setMobileOpen(false)} />
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
