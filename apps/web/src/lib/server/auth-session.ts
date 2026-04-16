import 'server-only';

import type { Session } from 'next-auth';
import { getServerSession } from 'next-auth';
import { authOptions, isAuthSecretConfigured } from '@/auth';

export const getOptionalServerSession = async (): Promise<Session | null> => {
  if (!isAuthSecretConfigured()) {
    return null;
  }

  return getServerSession(authOptions);
};
