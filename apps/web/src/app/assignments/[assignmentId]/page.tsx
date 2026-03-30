import AssignmentDetailsPageClient from './page-client';
import { requireStudentPageAccess } from '@/lib/server/session';

type AssignmentDetailsPageProps = {
  params: {
    assignmentId: string;
  };
};

export default async function AssignmentDetailsPage({
  params,
}: AssignmentDetailsPageProps) {
  await requireStudentPageAccess();
  return <AssignmentDetailsPageClient params={params} />;
}
