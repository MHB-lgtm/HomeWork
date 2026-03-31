import { WorkspaceShell } from '@/components/layout/WorkspaceShell';
import { requireStudentPageAccess } from '@/lib/server/session';

export const dynamic = 'force-dynamic';

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireStudentPageAccess();

  return <WorkspaceShell role="student">{children}</WorkspaceShell>;
}
