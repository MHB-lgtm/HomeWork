import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaUserAuthStore, getPrismaClient } from '@hg/postgres-store';

const getUserAuthStore = () => new PrismaUserAuthStore(getPrismaClient());

const googleClientId = process.env.AUTH_GOOGLE_ID;
const googleClientSecret = process.env.AUTH_GOOGLE_SECRET;

const providers =
  googleClientId && googleClientSecret
    ? [
        GoogleProvider({
          clientId: googleClientId,
          clientSecret: googleClientSecret,
        }),
      ]
    : [];

export const authOptions: NextAuthOptions = {
  secret: process.env.AUTH_SECRET,
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/sign-in',
  },
  providers,
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!account) {
        return '/forbidden';
      }

      const resolvedUser = await getUserAuthStore().resolveUserForSignIn({
        provider: account.provider,
        providerAccountId: account.providerAccountId,
        email:
          typeof user.email === 'string'
            ? user.email
            : typeof profile?.email === 'string'
              ? profile.email
              : null,
        displayName:
          typeof user.name === 'string'
            ? user.name
            : typeof profile?.name === 'string'
              ? profile.name
              : null,
      });

      if (!resolvedUser || resolvedUser.status !== 'ACTIVE' || !resolvedUser.hasStaffAccess) {
        return '/forbidden';
      }

      user.id = resolvedUser.userId;
      user.email = resolvedUser.normalizedEmail ?? user.email ?? null;
      user.name = resolvedUser.displayName ?? user.name ?? resolvedUser.normalizedEmail ?? resolvedUser.userId;
      user.globalRole = resolvedUser.globalRole;
      user.hasStaffAccess = resolvedUser.hasStaffAccess;

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.globalRole = user.globalRole;
        token.hasStaffAccess = user.hasStaffAccess;
      }

      return token;
    },
    async session({ session, token }) {
      if (!session.user || typeof token.sub !== 'string') {
        return session;
      }

      session.user.id = token.sub;
      session.user.globalRole = token.globalRole === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'USER';
      session.user.hasStaffAccess = token.hasStaffAccess === true;

      return session;
    },
  },
};

export const isAuthConfigured = (): boolean =>
  Boolean(process.env.AUTH_SECRET && googleClientId && googleClientSecret);
