import { NextResponse } from 'next/server';
import { getServerPersistence } from '@/lib/server/persistence';
import { requireStudentApiAccess } from '@/lib/server/session';

export const runtime = 'nodejs';

const ensurePersistence = () => {
  const persistence = getServerPersistence();
  if (!persistence) {
    return NextResponse.json(
      { ok: false, error: 'DATABASE_URL is not set in environment', code: 'DATABASE_URL_MISSING' },
      { status: 500 }
    );
  }

  return persistence;
};

export async function GET() {
  const access = await requireStudentApiAccess({ allowSuperAdmin: true });
  if (access instanceof NextResponse) {
    return access;
  }

  const persistence = ensurePersistence();
  if (persistence instanceof NextResponse) {
    return persistence;
  }

  const results = await persistence.studentResults.listStudentAssignmentResults(access.userId, {
    bypassVisibility: access.globalRole === 'SUPER_ADMIN',
  });

  return NextResponse.json({ ok: true, data: results });
}
