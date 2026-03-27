'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useRole, type UserRole } from '../../contexts/RoleContext';
import {
  LayoutDashboard, BookOpen, FileText, ClipboardCheck, BarChart3,
  Flag, Users, ChevronLeft, Menu, X, GraduationCap,
  LogOut, Sparkles, TrendingUp, ChevronRight,
} from 'lucide-react';
import { cn } from '../../lib/utils';

type NavSection = { label?: string; items: NavItem[] };
type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  matches: (p: string) => boolean;
  count?: number;
};

const studentSections: NavSection[] = [
  {
    items: [
      { href: '/s/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} />, matches: (p) => p.endsWith('/s/dashboard') },
      { href: '/s/courses', label: 'Courses', icon: <BookOpen size={18} />, matches: (p) => p.includes('/s/courses') },
      { href: '/s/results', label: 'Results', icon: <BarChart3 size={18} />, matches: (p) => p.includes('/s/results') },
      { href: '/s/results', label: 'Progress', icon: <TrendingUp size={18} />, matches: () => false },
    ],
  },
];

const lecturerSections: NavSection[] = [
  {
    items: [
      { href: '/l/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} />, matches: (p) => p.endsWith('/l/dashboard') },
      { href: '/l/courses', label: 'Courses', icon: <BookOpen size={18} />, matches: (p) => p.includes('/l/courses') },
      { href: '/l/submissions', label: 'Submissions', icon: <ClipboardCheck size={18} />, matches: (p) => p.includes('/l/submissions'), count: 18 },
      { href: '/l/exams', label: 'Exams', icon: <FileText size={18} />, matches: (p) => p.includes('/l/exams') },
      { href: '/l/analytics', label: 'Analytics', icon: <BarChart3 size={18} />, matches: (p) => p.includes('/l/analytics') },
    ],
  },
];

function getBreadcrumbs(pathname: string): { label: string; href?: string }[] {
  const segments = pathname.split('/').filter(Boolean);
  const crumbs: { label: string; href?: string }[] = [];
  const labelMap: Record<string, string> = {
    s: 'Student', l: 'Lecturer', dashboard: 'Dashboard', courses: 'Courses',
    results: 'Results', submissions: 'Submissions', exams: 'Exams',
    analytics: 'Analytics', assignments: 'Assignments', workspace: 'Workspace',
    result: 'Result', review: 'Review', create: 'Create',
  };
  let path = '';
  for (const seg of segments) {
    path += `/${seg}`;
    if (seg.length === 2 && /^[a-z]+$/.test(seg)) continue; // locale
    const label = labelMap[seg] || (seg.length > 8 ? `${seg.slice(0, 8)}...` : seg);
    crumbs.push({ label, href: path });
  }
  if (crumbs.length > 0) delete crumbs[crumbs.length - 1].href;
  return crumbs;
}

function Sidebar({ role, pathname, collapsed, onNav }: {
  role: UserRole; pathname: string; collapsed: boolean; onNav?: () => void;
}) {
  const { clearRole } = useRole();
  const sections = role === 'student' ? studentSections : lecturerSections;

  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className={cn(
        'flex items-center h-[var(--topbar-height)] border-b border-[var(--border-light)]',
        collapsed ? 'justify-center px-2' : 'gap-2.5 px-4'
      )}>
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--text-primary)] text-white">
          <Sparkles size={14} />
        </div>
        {!collapsed && (
          <span className="text-[13px] font-semibold tracking-tight text-[var(--text-primary)]">AcademyAI</span>
        )}
      </div>

      {/* Role pill */}
      {!collapsed && (
        <div className="px-3 pt-3">
          <div className="flex items-center gap-2 rounded-md bg-[var(--surface-secondary)] px-2.5 py-1.5">
            {role === 'student' ? <GraduationCap size={14} className="text-[var(--text-tertiary)]" /> : <Users size={14} className="text-[var(--text-tertiary)]" />}
            <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
              {role}
            </span>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 pt-3 pb-2">
        {sections.map((section, si) => (
          <div key={si} className="mb-1">
            {section.label && !collapsed && (
              <p className="mb-1 px-2.5 text-[11px] font-medium uppercase tracking-wider text-[var(--text-quaternary)]">
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = item.matches(pathname);
                return (
                  <Link
                    key={item.href + item.label}
                    href={item.href}
                    onClick={onNav}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] font-medium transition-colors',
                      collapsed && 'justify-center px-2',
                      active
                        ? 'bg-[var(--surface-secondary)] text-[var(--text-primary)]'
                        : 'text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]'
                    )}
                  >
                    <span className={cn('shrink-0', active ? 'text-[var(--text-primary)]' : 'text-[var(--text-quaternary)] group-hover:text-[var(--text-tertiary)]')}>
                      {item.icon}
                    </span>
                    {!collapsed && (
                      <>
                        <span className="truncate">{item.label}</span>
                        {item.count != null && item.count > 0 && (
                          <span className="ml-auto rounded bg-[var(--text-primary)] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                            {item.count}
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="border-t border-[var(--border-light)] p-2">
        <button
          onClick={() => { clearRole(); onNav?.(); }}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] font-medium text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]',
            collapsed && 'justify-center px-2'
          )}
        >
          <LogOut size={18} className="text-[var(--text-quaternary)]" />
          {!collapsed && <span>Switch Role</span>}
        </button>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { role } = useRole();
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
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [mobileOpen]);

  // No shell for: no role, landing, immersive routes
  if (!role || pathname === '/' || pathname.match(/^\/[a-z]{2}$/)) return <>{children}</>;
  if (pathname.includes('/workspace') || (pathname.includes('/assignments/') && (pathname.includes('/result') || pathname.includes('/review')))) return <>{children}</>;

  const breadcrumbs = getBreadcrumbs(pathname);

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)]">
      {/* Desktop sidebar */}
      <aside className={cn(
        'hidden lg:flex lg:flex-col lg:shrink-0 border-r border-[var(--border-light)] bg-[var(--surface)] transition-[width] duration-200 ease-[var(--ease)]',
        collapsed ? 'w-[var(--sidebar-collapsed)]' : 'w-[var(--sidebar-width)]'
      )}>
        <Sidebar role={role} pathname={pathname} collapsed={collapsed} />
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex h-[var(--topbar-height)] shrink-0 items-center gap-3 border-b border-[var(--border-light)] bg-[var(--surface)] px-4">
          {/* Mobile menu */}
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-1.5 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-hover)] lg:hidden"
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>

          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden rounded-md p-1.5 text-[var(--text-quaternary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-tertiary)] lg:flex"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronLeft size={16} className={cn('transition-transform', collapsed && 'rotate-180')} />
          </button>

          {/* Breadcrumbs */}
          <nav className="flex items-center gap-1 text-[13px] overflow-hidden" aria-label="Breadcrumb">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1 min-w-0">
                {i > 0 && <ChevronRight size={12} className="shrink-0 text-[var(--text-quaternary)]" />}
                {crumb.href ? (
                  <Link href={crumb.href} className="truncate text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="truncate font-medium text-[var(--text-primary)]">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>

          <div className="flex-1" />

          {/* Avatar */}
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[var(--brand)] to-[var(--brand-hover)]" />
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 lg:py-8">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-black/20" onClick={() => setMobileOpen(false)} aria-label="Close" />
          <aside className="relative h-full w-[240px] max-w-[80vw] border-r border-[var(--border-light)] bg-[var(--surface)] shadow-lg">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-2 top-3 rounded-md p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)]"
              aria-label="Close"
            >
              <X size={16} />
            </button>
            <Sidebar role={role} pathname={pathname} collapsed={false} onNav={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}
    </div>
  );
}
