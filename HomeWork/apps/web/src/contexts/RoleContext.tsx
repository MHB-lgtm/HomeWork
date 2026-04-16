'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export type UserRole = 'student' | 'lecturer';

type RoleContextValue = {
  role: UserRole | null;
  setRole: (role: UserRole) => void;
  clearRole: () => void;
};

const RoleContext = createContext<RoleContextValue | null>(null);

const STORAGE_KEY = 'hg_role';

function getStoredRole(): UserRole | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'student' || stored === 'lecturer') return stored;
  return null;
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<UserRole | null>(() => getStoredRole());

  const setRole = useCallback((r: UserRole) => {
    setRoleState(r);
    localStorage.setItem(STORAGE_KEY, r);
  }, []);

  const clearRole = useCallback(() => {
    setRoleState(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <RoleContext.Provider value={{ role, setRole, clearRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRole must be used within RoleProvider');
  return ctx;
}
