import SubmissionOpsDetailPageClient from '@/app/courses/[courseId]/assignments/[assignmentId]/submissions/[submissionId]/page-client';
import { requireActiveCourseRolePageAccess } from '@/lib/server/session';

type StaffSubmissionOpsDetailPageProps = {
  params: {
    courseId: string;
    assignmentId: string;
    submissionId: string;
  };
};

export default async function StaffSubmissionOpsDetailPage({
  params,
}: StaffSubmissionOpsDetailPageProps) {
  await requireActiveCourseRolePageAccess(params.courseId, ['COURSE_ADMIN', 'LECTURER']);
  return <SubmissionOpsDetailPageClient params={params} />;
}
