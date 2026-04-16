'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AccountMenu } from '../auth/AccountMenu';
import { cn } from '../../lib/utils';
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  ClipboardCheck,
  PenTool,
  Inbox,
  BarChart3,
  Menu,
  X,
  ChevronRight,
  GraduationCap,
  Sparkles,
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

function buildLecturerNavItems(localePrefix: string): NavItem[] {
  return [
    { href: `${localePrefix}/l/dashboard`, label: 'Dashboard', icon: <LayoutDashboard size={18} />, matches: (p) => p.includes('/l/dashboard') },
    { href: `${localePrefix}/l/courses`, label: 'Courses', icon: <BookOpen size={18} />, matches: (p) => p.includes('/l/courses') },
    { href: `${localePrefix}/l/exams`, label: 'Exams', icon: <FileText size={18} />, matches: (p) => p.includes('/l/exams') },
    { href: `${localePrefix}/l/analytics`, label: 'Analytics', icon: <BarChart3 size={18} />, matches: (p) => p.includes('/l/analytics') },
  ];
}

function buildStudentNavItems(localePrefix: string): NavItem[] {
  return [
    { href: `${localePrefix}/s/dashboard`, label: 'Dashboard', icon: <LayoutDashboard size={18} />, matches: (p) => p.includes('/s/dashboard') },
    { href: `${localePrefix}/s/courses`, label: 'Courses', icon: <BookOpen size={18} />, matches: (p) => p.includes('/s/courses') },
    { href: `${localePrefix}/s/results`, label: 'Results', icon: <BarChart3 size={18} />, matches: (p) => p.includes('/s/results') },
  ];
}

function getPageTitle(pathname: string): string {
  // Staff routes
  if (pathname === '/') return 'Dashboard';
  if (pathname.startsWith('/courses/')) return 'Course Details';
  if (pathname === '/courses') return 'Courses';
  if (pathname === '/exams') return 'Exams';
  if (pathname.startsWith('/reviews/')) return 'Review Details';
  if (pathname === '/reviews') return 'Reviews';
  if (pathname === '/rubrics') return 'Rubrics';
  // Lecturer routes
  if (pathname.includes('/l/dashboard')) return 'Dashboard';
  if (pathname.includes('/l/courses/') && pathname.includes('/assignments/')) return 'Assignment';
  if (pathname.includes('/l/courses/')) return 'Course';
  if (pathname.includes('/l/courses')) return 'Courses';
  if (pathname.includes('/l/exams')) return 'Exams';
  if (pathname.includes('/l/analytics')) return 'Analytics';
  // Student routes
  if (pathname.includes('/s/dashboard')) return 'Dashboard';
  if (pathname.includes('/s/courses/')) return 'Course';
  if (pathname.includes('/s/courses')) return 'Courses';
  if (pathname.includes('/s/results')) return 'Results';
  return 'Homework Grader';
}

function getBreadcrumbs(pathname: string): { label: string; href?: string }[] {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return [{ label: 'Dashboard' }];

  const labelMap: Record<string, string> = {
    courses: 'Courses', exams: 'Exams', reviews: 'Reviews',
    rubrics: 'Rubrics', assignments: 'Assignments', results: 'Results',
    dashboard: 'Dashboard', analytics: 'Analytics', create: 'Create',
    review: 'Review', workspace: 'Workspace', result: 'Result',
    l: 'Lecturer', s: 'Student',
  };

  // Detect locale prefix and role prefix for home link
  const localeMatch = pathname.match(/^\/([a-z]{2})\//);
  const roleMatch = pathname.match(/^\/[a-z]{2}\/(l|s)\//);
  const homeHref = roleMatch
    ? `/${localeMatch![1]}/${roleMatch[1]}/dashboard`
    : '/';

  const crumbs: { label: string; href?: string }[] = [{ label: 'Home', href: homeHref }];
  let path = '';

  for (const seg of segments) {
    path += `/${seg}`;
    // Skip locale segment and role segment in breadcrumbs
    if (seg.length === 2 && /^[a-z]+$/.test(seg) && segments.indexOf(seg) === 0) continue;
    if ((seg === 'l' || seg === 's') && localeMatch) continue;

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
  items,
}: {
  pathname: string;
  collapsed: boolean;
  onNav?: () => void;
  items: NavItem[];
}) {
  return (
    <nav className="flex-1 overflow-y-auto px-4 pt-6 pb-2" aria-label="Main navigation">
      {!collapsed && (
        <p className="mb-3 px-3 text-xs font-medium uppercase tracking-[0.18em] text-(--text-tertiary)">
          Navigation
        </p>
      )}
      <div className="space-y-1">
        {items.map((item) => {
          const active = item.matches(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNav}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium',
                'transition-all duration-(--duration) ease-(--ease)',
                collapsed && 'justify-center px-2',
                active
                  ? 'bg-(--brand-subtle) text-(--brand-hover)'
                  : 'text-(--text-secondary) hover:bg-(--surface-hover) hover:text-(--text-primary)'
              )}
            >
              <span className={cn(
                'shrink-0 transition-all duration-(--duration) [&>svg]:h-5 [&>svg]:w-5',
                active ? 'text-(--brand)' : 'text-(--text-tertiary) group-hover:text-(--brand)'
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

function detectNavContext(pathname: string): { items: NavItem[]; brandLabel: string } {
  // Locale-based lecturer routes: /en/l/..., /he/l/...
  const lecturerMatch = pathname.match(/^\/([a-z]{2})\/l\//);
  if (lecturerMatch) {
    return { items: buildLecturerNavItems(`/${lecturerMatch[1]}`), brandLabel: 'Lecturer' };
  }

  // Locale-based student routes: /en/s/..., /he/s/...
  const studentMatch = pathname.match(/^\/([a-z]{2})\/s\//);
  if (studentMatch) {
    return { items: buildStudentNavItems(`/${studentMatch[1]}`), brandLabel: 'Student' };
  }

  // Default: staff routes
  return { items: staffNavItems, brandLabel: 'Staff' };
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

  // Skip shell for landing page, role selection, and immersive routes
  const isLocaleLanding = /^\/[a-z]{2}$/.test(pathname);
  if (pathname === '/' && !pathname.startsWith('/courses') && !pathname.startsWith('/exams') && !pathname.startsWith('/reviews') && !pathname.startsWith('/rubrics')) {
    // Only skip for the actual root landing - let staff routes through
  }
  if (isLocaleLanding) return <>{children}</>;

  const { items: navItems, brandLabel } = detectNavContext(pathname);
  const breadcrumbs = getBreadcrumbs(pathname);
  const pageTitle = getPageTitle(pathname);

  return (
    <div className="flex h-screen overflow-hidden bg-(--bg)">
      {/* ─── Desktop Sidebar ─── */}
      <aside
        className={cn(
          'hidden lg:flex lg:flex-col lg:shrink-0 border-e border-(--border) bg-(--surface) transition-[width] duration-250 ease-(--ease)',
          collapsed ? 'w-(--sidebar-collapsed)' : 'w-(--sidebar-width)'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Brand */}
          <div className={cn(
            'flex items-center h-(--topbar-height) border-b border-(--border-light)',
            collapsed ? 'justify-center px-2' : 'gap-3 px-6'
          )}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-(--brand) text-white shadow-md">
              <GraduationCap size={20} />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-base font-bold tracking-tight text-(--text-primary) leading-tight">
                  Homework Grader
                </p>
                <p className="mt-0.5 text-xs font-medium text-(--text-tertiary) flex items-center gap-1">
                  <Sparkles size={10} /> {brandLabel}
                </p>
              </div>
            )}
          </div>

          {/* Navigation */}
          <SidebarNav pathname={pathname} collapsed={collapsed} items={navItems} />

          {/* Bottom section */}
          <div className="border-t border-(--border-light) p-3">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2.5 text-[13px] font-medium text-(--text-tertiary)',
                'transition-all duration-200 hover:bg-(--surface-hover) hover:text-(--text-primary)',
                collapsed && 'justify-center px-2'
              )}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <ChevronRight
                size={16}
                className={cn('shrink-0 transition-transform duration-250 ease-(--ease)', !collapsed && 'rotate-180')}
              />
              {!collapsed && <span>Collapse</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* ─── Main Area ─── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Topbar — sticky glass header */}
        <header className="sticky top-0 z-40 flex h-(--topbar-height) shrink-0 items-center gap-3 glass-header px-4 lg:px-8">
          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-(--text-tertiary) transition-colors hover:bg-(--surface-hover) hover:text-(--text-primary) lg:hidden"
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>

          {/* Breadcrumbs */}
          <nav className="hidden items-center gap-2 text-sm overflow-hidden md:flex" aria-label="Breadcrumb">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-2 min-w-0">
                {i > 0 && <ChevronRight size={14} className="shrink-0 text-(--text-quaternary) rtl:rotate-180" />}
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="truncate text-(--text-tertiary) transition-colors duration-150 hover:text-(--brand)"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="truncate font-semibold text-(--text-primary)">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>

          {/* Mobile page title */}
          <h1 className="text-base font-semibold text-(--text-primary) md:hidden truncate">{pageTitle}</h1>

          <div className="flex-1" />

          {/* Right side */}
          <div className="flex items-center gap-2">
            <AccountMenu compact />
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="app-shell-content mx-auto w-full max-w-7xl px-5 py-12 sm:px-7 sm:py-14 lg:px-10 lg:py-16">
            {children}
          </div>
        </main>
      </div>

      {/* ─── Mobile Drawer ─── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-black/25 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-label="Close"
          />
          <aside className="relative h-full w-72 max-w-[85vw] border-e border-(--border) bg-(--surface) shadow-xl animate-slide-left">
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between h-(--topbar-height) border-b border-(--border-light) px-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-(--brand) text-white shadow-md">
                    <GraduationCap size={20} />
                  </div>
                  <span className="text-base font-bold tracking-tight text-(--text-primary)">
                    Homework Grader
                  </span>
                </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg p-2 text-(--text-tertiary) hover:bg-(--surface-hover) transition-colors"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>
              <SidebarNav pathname={pathname} collapsed={false} onNav={() => setMobileOpen(false)} items={navItems} />
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
