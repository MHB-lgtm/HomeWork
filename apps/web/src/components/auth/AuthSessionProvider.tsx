'use client';

import { createContext, useContext } from 'react';
import { SessionProvider } from 'next-auth/react';
import type { Session } from 'next-auth';

type AuthSessionProviderProps = {
  children: React.ReactNode;
  enabled: boolean;
  session: Session | null;
};

const AuthRuntimeContext = createContext({ enabled: false });

export function AuthSessionProvider({ children, enabled, session }: AuthSessionProviderProps) {
  return (
    <AuthRuntimeContext.Provider value={{ enabled }}>
      <SessionProvider session={enabled ? session : null}>{children}</SessionProvider>
    </AuthRuntimeContext.Provider>
  );
}

export function useAuthRuntime() {
  return useContext(AuthRuntimeContext);
}
