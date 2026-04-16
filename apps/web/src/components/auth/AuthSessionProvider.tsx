'use client';

import { SessionProvider } from 'next-auth/react';
import type { Session } from 'next-auth';

type AuthSessionProviderProps = {
  children: React.ReactNode;
  enabled: boolean;
  session: Session | null;
};

export function AuthSessionProvider({ children, enabled, session }: AuthSessionProviderProps) {
  if (!enabled) {
    return <>{children}</>;
  }

  return <SessionProvider session={session}>{children}</SessionProvider>;
}
