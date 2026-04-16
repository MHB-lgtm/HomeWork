'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AccountMenu } from '../auth/AccountMenu';
import { cn } from '../../lib/utils';
import type { Course } from '@hg/shared-schemas';
import { listCourses } from '../../lib/coursesClient';
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  ClipboardCheck,
  PenTool,
  BarChart3,
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  GraduationCap,
  Sparkles,
} from 'lucide-react';

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  matches: (p: string) => boolean;
  group?: 'courses';
};

type CourseNavItem = {
  id: string;
  title: string;
  href: string;
  meta?: string;
};

const staffNavItems: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: <LayoutDashboard size={18} />, matches: (p) => p === '/' },
  { href: '/courses', label: 'Courses', icon: <BookOpen size={18} />, matches: (p) => p.startsWith('/courses'), group: 'courses' },
  { href: '/exams', label: 'Exams', icon: <FileText size={18} />, matches: (p) => p.startsWith('/exams') },
  { href: '/reviews', label: 'Reviews', icon: <ClipboardCheck size={18} />, matches: (p) => p.startsWith('/reviews') },
  { href: '/rubrics', label: 'Rubrics', icon: <PenTool size={18} />, matches: (p) => p.startsWith('/rubrics') },
];

function buildLecturerCourses(localePrefix: string): CourseNavItem[] {
  return [
    { id: 'c1', title: 'Linear Algebra', meta: 'MATH 2210', href: `${localePrefix}/l/courses/c1` },
    { id: 'c2', title: 'Calculus II', meta: 'MATH 1220', href: `${localePrefix}/l/courses/c2` },
    { id: 'c3', title: 'Introduction to Physics', meta: 'PHYS 1010', href: `${localePrefix}/l/courses/c3` },
  ];
}

function buildStudentCourses(localePrefix: string): CourseNavItem[] {
  return [
    { id: 'c1', title: 'Linear Algebra', meta: 'Spring 2026', href: `${localePrefix}/s/courses/c1` },
    { id: 'c2', title: 'Calculus II', meta: 'Spring 2026', href: `${localePrefix}/s/courses/c2` },
    { id: 'c3', title: 'Introduction to Physics', meta: 'Spring 2026', href: `${localePrefix}/s/courses/c3` },
    { id: 'c4', title: 'Discrete Mathematics', meta: 'Spring 2026', href: `${localePrefix}/s/courses/c4` },
  ];
}

function buildLecturerNavItems(localePrefix: string): NavItem[] {
  return [
    { href: `${localePrefix}/l/dashboard`, label: 'Dashboard', icon: <LayoutDashboard size={18} />, matches: (p) => p.includes('/l/dashboard') },
    { href: `${localePrefix}/l/courses`, label: 'Courses', icon: <BookOpen size={18} />, matches: (p) => p.includes('/l/courses'), group: 'courses' },
    { href: `${localePrefix}/l/exams`, label: 'Exams', icon: <FileText size={18} />, matches: (p) => p.includes('/l/exams') },
    { href: `${localePrefix}/l/analytics`, label: 'Analytics', icon: <BarChart3 size={18} />, matches: (p) => p.includes('/l/analytics') },
  ];
}

function buildStudentNavItems(localePrefix: string): NavItem[] {
  return [
    { href: `${localePrefix}/s/dashboard`, label: 'Dashboard', icon: <LayoutDashboard size={18} />, matches: (p) => p.includes('/s/dashboard') },
    { href: `${localePrefix}/s/courses`, label: 'Courses', icon: <BookOpen size={18} />, matches: (p) => p.includes('/s/courses'), group: 'courses' },
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
  courses,
  coursesOpen,
  onToggleCourses,
  onExpandSidebar,
}: {
  pathname: string;
  collapsed: boolean;
  onNav?: () => void;
  items: NavItem[];
  courses: CourseNavItem[];
  coursesOpen: boolean;
  onToggleCourses: () => void;
  onExpandSidebar?: () => void;
}) {
  return (
    <nav className={cn('flex-1 overflow-y-auto pb-4', collapsed ? 'px-3 pt-5' : 'px-4 pt-6')} aria-label="Main navigation">
      {!collapsed && (
        <p className="mb-3 px-3 text-xs font-medium uppercase tracking-[0.18em] text-(--text-tertiary)">
          Navigation
        </p>
      )}
      <div className="space-y-1.5">
        {items.map((item) => {
          const active = item.matches(pathname);
          if (item.group === 'courses') {
            const hasActiveCourse = courses.some((course) => pathname === course.href || pathname.startsWith(`${course.href}/`));
            return (
              <div key={item.href} className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (collapsed) {
                      onExpandSidebar?.();
                    }
                    onToggleCourses();
                  }}
                  aria-expanded={coursesOpen}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'group relative flex w-full items-center rounded-xl text-sm font-medium',
                    'transition-all duration-(--duration) ease-(--ease)',
                    collapsed ? 'justify-center px-2 py-3' : 'gap-3 px-3 py-2.5',
                    active || hasActiveCourse
                      ? 'bg-(--brand-subtle) text-(--brand-hover)'
                      : 'text-(--text-secondary) hover:bg-(--surface-hover) hover:text-(--text-primary)'
                  )}
                >
                  <span
                    className={cn(
                      'shrink-0 transition-all duration-(--duration) [&>svg]:h-5 [&>svg]:w-5',
                      active || hasActiveCourse ? 'text-(--brand)' : 'text-(--text-tertiary) group-hover:text-(--brand)'
                    )}
                  >
                    {item.icon}
                  </span>
                  {!collapsed && (
                    <>
                      <span className="min-w-0 flex-1 truncate text-start">{item.label}</span>
                      {coursesOpen ? (
                        <ChevronDown className="h-4 w-4 shrink-0 text-(--text-quaternary)" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-(--text-quaternary) rtl:rotate-180" />
                      )}
                    </>
                  )}
                </button>

                {!collapsed && coursesOpen && (
                  <div className="ms-4 space-y-1 border-s border-(--border-light) ps-3">
                    <Link
                      href={item.href}
                      onClick={onNav}
                      className={cn(
                        'flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
                        pathname === item.href
                          ? 'bg-(--surface-secondary) text-(--text-primary)'
                          : 'text-(--text-tertiary) hover:bg-(--surface-hover) hover:text-(--text-primary)'
                      )}
                    >
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-45" />
                      <span className="truncate">All courses</span>
                    </Link>
                    {courses.map((course) => {
                      const courseActive = pathname === course.href || pathname.startsWith(`${course.href}/`);
                      return (
                        <Link
                          key={course.id}
                          href={course.href}
                          onClick={onNav}
                          aria-current={courseActive ? 'page' : undefined}
                          className={cn(
                            'group/course flex min-w-0 items-center gap-3 rounded-lg px-3 py-2.5 text-start transition-all',
                            courseActive
                              ? 'bg-(--brand-50) text-(--brand-hover) shadow-[inset_2px_0_0_var(--brand)] rtl:shadow-[inset_-2px_0_0_var(--brand)]'
                              : 'text-(--text-secondary) hover:bg-(--surface-hover) hover:text-(--text-primary)'
                          )}
                        >
                          <span
                            className={cn(
                              'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold',
                              courseActive
                                ? 'bg-(--brand-subtle) text-(--brand)'
                                : 'bg-(--surface-secondary) text-(--text-tertiary) group-hover/course:text-(--brand)'
                            )}
                          >
                            {course.title.slice(0, 1)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-semibold leading-tight">{course.title}</span>
                            {course.meta && (
                              <span className="mt-0.5 block truncate text-[11px] font-medium text-(--text-quaternary)">
                                {course.meta}
                              </span>
                            )}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNav}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium',
                'transition-all duration-(--duration) ease-(--ease)',
                collapsed && 'justify-center rounded-xl px-2 py-3',
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

function detectNavContext(pathname: string): { items: NavItem[]; brandLabel: string; courses: CourseNavItem[]; canLoadCourses: boolean } {
  // Locale-based lecturer routes: /en/l/..., /he/l/...
  const lecturerMatch = pathname.match(/^\/([a-z]{2})\/l\//);
  if (lecturerMatch) {
    const localePrefix = `/${lecturerMatch[1]}`;
    return {
      items: buildLecturerNavItems(localePrefix),
      brandLabel: 'Lecturer',
      courses: buildLecturerCourses(localePrefix),
      canLoadCourses: false,
    };
  }

  // Locale-based student routes: /en/s/..., /he/s/...
  const studentMatch = pathname.match(/^\/([a-z]{2})\/s\//);
  if (studentMatch) {
    const localePrefix = `/${studentMatch[1]}`;
    return {
      items: buildStudentNavItems(localePrefix),
      brandLabel: 'Student',
      courses: buildStudentCourses(localePrefix),
      canLoadCourses: false,
    };
  }

  // Default: staff routes
  return { items: staffNavItems, brandLabel: 'Staff', courses: [], canLoadCourses: true };
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [coursesOpen, setCoursesOpen] = useState(false);
  const [loadedCourses, setLoadedCourses] = useState<CourseNavItem[]>([]);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  useEffect(() => {
    const stored = window.localStorage.getItem('hg_sidebar_collapsed');
    if (stored === 'true') setCollapsed(true);
  }, []);

  useEffect(() => {
    window.localStorage.setItem('hg_sidebar_collapsed', String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    if (pathname.includes('/courses')) setCoursesOpen(true);
  }, [pathname]);

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

  const navContext = useMemo(() => detectNavContext(pathname), [pathname]);
  const { items: navItems, brandLabel } = navContext;

  useEffect(() => {
    if (!navContext.canLoadCourses) {
      setLoadedCourses([]);
      return;
    }

    let cancelled = false;
    listCourses()
      .then((courses) => {
        if (cancelled) return;
        setLoadedCourses(
          courses.map((course: Course) => ({
            id: course.courseId,
            title: course.title,
            href: `/courses/${course.courseId}`,
            meta: course.courseId,
          }))
        );
      })
      .catch(() => {
        if (!cancelled) setLoadedCourses([]);
      });

    return () => {
      cancelled = true;
    };
  }, [navContext.canLoadCourses]);

  const sidebarCourses = navContext.canLoadCourses ? loadedCourses : navContext.courses;
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
          <SidebarNav
            pathname={pathname}
            collapsed={collapsed}
            items={navItems}
            courses={sidebarCourses}
            coursesOpen={coursesOpen}
            onToggleCourses={() => setCoursesOpen((open) => !open)}
            onExpandSidebar={() => setCollapsed(false)}
          />

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
          <SidebarNav
            pathname={pathname}
            collapsed={false}
            onNav={() => setMobileOpen(false)}
            items={navItems}
            courses={sidebarCourses}
            coursesOpen={coursesOpen}
            onToggleCourses={() => setCoursesOpen((open) => !open)}
          />
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
