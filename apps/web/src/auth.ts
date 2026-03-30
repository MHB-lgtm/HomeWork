import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import {
  DEVELOPMENT_DEMO_SIGN_IN_OPTIONS,
  PrismaUserAuthStore,
  getPrismaClient,
} from '@hg/postgres-store';

const getUserAuthStore = () => new PrismaUserAuthStore(getPrismaClient());

const googleClientId = process.env.AUTH_GOOGLE_ID;
const googleClientSecret = process.env.AUTH_GOOGLE_SECRET;
const isDevelopment = process.env.NODE_ENV === 'development';

const providers = [
  ...(googleClientId && googleClientSecret
    ? [
        GoogleProvider({
          clientId: googleClientId,
          clientSecret: googleClientSecret,
        }),
      ]
    : []),
  ...(isDevelopment
    ? [
        CredentialsProvider({
          id: 'demo-login',
          name: 'Demo Login',
          credentials: {
            demoAccountId: { label: 'Demo Account ID', type: 'text' },
          },
          async authorize(credentials) {
            const demoAccountId = credentials?.demoAccountId?.trim();
            if (!demoAccountId) {
              return null;
            }

            const resolvedUser = await getUserAuthStore().resolveDemoUserForDevelopment(demoAccountId);
            if (!resolvedUser || resolvedUser.status !== 'ACTIVE') {
              return null;
            }

            return {
              id: resolvedUser.userId,
              email: resolvedUser.normalizedEmail ?? null,
              name:
                resolvedUser.displayName ??
                resolvedUser.normalizedEmail ??
                resolvedUser.userId,
              globalRole: resolvedUser.globalRole,
              hasStaffAccess: resolvedUser.hasStaffAccess,
            };
          },
        }),
      ]
    : []),
];

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

      const resolvedUser =
        account.provider === 'demo-login' && typeof user.id === 'string'
          ? await getUserAuthStore().getUserAccessById(user.id)
          : await getUserAuthStore().resolveUserForSignIn({
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

      if (!resolvedUser || resolvedUser.status !== 'ACTIVE') {
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

export const isGoogleAuthConfigured = (): boolean =>
  Boolean(process.env.AUTH_SECRET && googleClientId && googleClientSecret);

export const isDemoAuthEnabled = (): boolean => isDevelopment;

export const isAuthConfigured = (): boolean => isGoogleAuthConfigured() || isDemoAuthEnabled();

export const getDevelopmentDemoSignInOptions = () =>
  isDemoAuthEnabled() ? DEVELOPMENT_DEMO_SIGN_IN_OPTIONS : [];
