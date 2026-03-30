import StudentResultDetailsPageClient from './page-client';
import { requireStudentPageAccess } from '@/lib/server/session';

type StudentResultDetailsPageProps = {
  params: {
    assignmentId: string;
  };
};

export default async function StudentResultDetailsPage({
  params,
}: StudentResultDetailsPageProps) {
  await requireStudentPageAccess();
  return <StudentResultDetailsPageClient params={params} />;
}
