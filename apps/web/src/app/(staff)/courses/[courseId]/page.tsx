import CourseDetailsPageClient from '@/app/[locale]/courses/[courseId]/page-client';
import { requireActiveCourseRolePageAccess } from '@/lib/server/session';

type StaffCourseDetailsPageProps = {
  params: { courseId: string };
};

export default async function StaffCourseDetailsPage({ params }: StaffCourseDetailsPageProps) {
  const { access, courseAccess } = await requireActiveCourseRolePageAccess(params.courseId, [
    'COURSE_ADMIN',
    'LECTURER',
  ]);

  return (
    <CourseDetailsPageClient
      params={params}
      canManageMemberships={
        access.globalRole === 'SUPER_ADMIN' || courseAccess?.role === 'COURSE_ADMIN'
      }
    />
  );
}
