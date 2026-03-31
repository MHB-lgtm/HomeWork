import AssignmentOpsPageClient from '@/app/courses/[courseId]/assignments/[assignmentId]/page-client';
import { requireActiveCourseRolePageAccess } from '@/lib/server/session';

type StaffAssignmentOpsPageProps = {
  params: {
    courseId: string;
    assignmentId: string;
  };
};

export default async function StaffAssignmentOpsPage({
  params,
}: StaffAssignmentOpsPageProps) {
  await requireActiveCourseRolePageAccess(params.courseId, ['COURSE_ADMIN', 'LECTURER']);
  return <AssignmentOpsPageClient params={params} />;
}
