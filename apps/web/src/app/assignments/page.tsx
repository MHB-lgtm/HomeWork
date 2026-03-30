import StudentAssignmentsPageClient from './page-client';
import { requireStudentPageAccess } from '@/lib/server/session';

export default async function StudentAssignmentsPage() {
  await requireStudentPageAccess();
  return <StudentAssignmentsPageClient />;
}
