import { WorkspaceShell } from '@/components/layout/WorkspaceShell';
import { requireStaffPageAccess } from '@/lib/server/session';

export const dynamic = 'force-dynamic';

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireStaffPageAccess();

  return <WorkspaceShell role="staff">{children}</WorkspaceShell>;
}
