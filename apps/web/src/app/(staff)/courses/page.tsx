import CoursesPageClient from '@/app/courses/page-client';
import { requireStaffPageAccess } from '@/lib/server/session';

export default async function StaffCoursesPage() {
  const access = await requireStaffPageAccess();

  return <CoursesPageClient canCreateCourses={access.globalRole === 'SUPER_ADMIN'} />;
}
