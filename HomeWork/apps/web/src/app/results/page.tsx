import StudentResultsPageClient from './page-client';
import { requireStudentPageAccess } from '@/lib/server/session';

export default async function StudentResultsPage() {
  await requireStudentPageAccess();
  return <StudentResultsPageClient />;
}
