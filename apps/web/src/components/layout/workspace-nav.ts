export type WorkspaceRole = 'staff' | 'student';

export type WorkspaceNavItem = {
  href: string;
  label: string;
  matches: (pathname: string) => boolean;
};

const matchesSegment = (pathname: string, href: string): boolean =>
  pathname === href || pathname.startsWith(`${href}/`);

const matchesJobs = (pathname: string): boolean =>
  pathname === '/jobs/new' || pathname === '/jobs' || pathname.startsWith('/jobs/');

export const workspaceNavItems: Record<WorkspaceRole, WorkspaceNavItem[]> = {
  staff: [
    {
      href: '/',
      label: 'Dashboard',
      matches: (pathname) => pathname === '/',
    },
    {
      href: '/courses',
      label: 'Courses',
      matches: (pathname) => matchesSegment(pathname, '/courses'),
    },
    {
      href: '/reviews',
      label: 'Reviews',
      matches: (pathname) => matchesSegment(pathname, '/reviews'),
    },
    {
      href: '/jobs/new',
      label: 'Jobs',
      matches: matchesJobs,
    },
    {
      href: '/exams',
      label: 'Exams',
      matches: (pathname) => matchesSegment(pathname, '/exams'),
    },
    {
      href: '/rubrics',
      label: 'Rubrics',
      matches: (pathname) => matchesSegment(pathname, '/rubrics'),
    },
  ],
  student: [
    {
      href: '/assignments',
      label: 'Assignments',
      matches: (pathname) => matchesSegment(pathname, '/assignments'),
    },
    {
      href: '/results',
      label: 'Results',
      matches: (pathname) => matchesSegment(pathname, '/results'),
    },
  ],
};

export const workspaceRoleLabel: Record<WorkspaceRole, string> = {
  staff: 'Staff workspace',
  student: 'Student workspace',
};
