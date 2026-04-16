import { requireStaffPageAccess } from '@/lib/server/session';
import StaffDashboardClient from './dashboard-client';

export const dynamic = 'force-dynamic';

export default async function StaffHomePage() {
  await requireStaffPageAccess();
  return <StaffDashboardClient />;
}
