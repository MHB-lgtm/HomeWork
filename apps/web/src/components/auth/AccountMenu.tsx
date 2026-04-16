'use client';

import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { Button } from '../ui/button';
import { useAuthRuntime } from './AuthSessionProvider';

type AccountMenuProps = {
  compact?: boolean;
};

export function AccountMenu({ compact = false }: AccountMenuProps) {
  const { enabled } = useAuthRuntime();
  if (!enabled) {
    return null;
  }

  return <AuthenticatedAccountMenu compact={compact} />;
}

function AuthenticatedAccountMenu({ compact = false }: AccountMenuProps) {
  const { data: session, status } = useSession();

  if (status !== 'authenticated' || !session?.user) {
    return null;
  }

  const label = session.user.name?.trim() || session.user.email?.trim() || 'Signed in';
  const roleLabel =
    session.user.globalRole === 'SUPER_ADMIN'
      ? 'Super admin'
      : session.user.hasStaffAccess
        ? 'Staff'
        : session.user.hasStudentAccess
          ? 'Student'
          : 'Member';

  return (
    <div className="flex items-center gap-2">
      {session.user.hasStudentAccess ? (
        <>
          <Link href="/assignments">
            <Button type="button" variant="outline" size="sm">
              Assignments
            </Button>
          </Link>
          <Link href="/results">
            <Button type="button" variant="outline" size="sm">
              Results
            </Button>
          </Link>
        </>
      ) : null}
      {!compact ? (
          <div className="hidden min-w-0 text-right md:block">
            <div className="truncate text-sm font-medium text-slate-900">{label}</div>
            <div className="text-xs text-slate-500">{roleLabel}</div>
          </div>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => signOut({ callbackUrl: '/sign-in' })}
      >
        Sign out
      </Button>
    </div>
  );
}
