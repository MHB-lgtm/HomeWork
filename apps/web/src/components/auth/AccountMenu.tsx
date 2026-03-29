'use client';

import { signOut, useSession } from 'next-auth/react';
import { Button } from '../ui/button';

type AccountMenuProps = {
  compact?: boolean;
};

export function AccountMenu({ compact = false }: AccountMenuProps) {
  const { data: session, status } = useSession();

  if (status !== 'authenticated' || !session?.user) {
    return null;
  }

  const label = session.user.name?.trim() || session.user.email?.trim() || 'Signed in';

  return (
    <div className="flex items-center gap-2">
      {!compact ? (
        <div className="hidden min-w-0 text-right md:block">
          <div className="truncate text-sm font-medium text-slate-900">{label}</div>
          <div className="text-xs text-slate-500">
            {session.user.globalRole === 'SUPER_ADMIN' ? 'Super admin' : 'Staff'}
          </div>
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
