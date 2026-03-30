import { AppShell } from '@/components/layout/AppShell';
import { requireStaffPageAccess } from '@/lib/server/session';

export const dynamic = 'force-dynamic';

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireStaffPageAccess();

  return <AppShell>{children}</AppShell>;
}
