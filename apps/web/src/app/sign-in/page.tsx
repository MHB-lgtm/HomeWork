import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import {
  authOptions,
  getDevelopmentDemoSignInOptions,
  isDemoAuthEnabled,
  isGoogleAuthConfigured,
} from '@/auth';
import { DemoSignInButtons } from '@/components/auth/DemoSignInButtons';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';

type SignInPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getCallbackUrl(value: string | string[] | undefined): string {
  if (typeof value === 'string' && value.startsWith('/')) {
    return value;
  }

  return '/';
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    redirect(session.user.hasStudentAccess && !session.user.hasStaffAccess ? '/assignments' : '/');
  }

  const params = (await searchParams) ?? {};
  const callbackUrl = getCallbackUrl(params.callbackUrl);
  const googleConfigured = isGoogleAuthConfigured();
  const demoAuthEnabled = isDemoAuthEnabled();
  const demoOptions = getDevelopmentDemoSignInOptions();

  return (
    <main className="min-h-screen bg-[radial-gradient(1200px_520px_at_50%_-8%,rgba(255,255,255,0.98),rgba(255,255,255,0)_62%),radial-gradient(900px_520px_at_12%_38%,rgba(59,130,246,0.24),rgba(59,130,246,0)_70%),radial-gradient(900px_520px_at_88%_38%,rgba(56,189,248,0.2),rgba(56,189,248,0)_70%),linear-gradient(180deg,#f8fbff_0%,#eef4ff_48%,#f6f9ff_100%)] px-4 py-10 md:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md items-center justify-center">
        <section className="w-full rounded-[2rem] border border-slate-200/80 bg-white/95 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur-sm">
          <div className="space-y-3 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Homework Grader</p>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-slate-900">Sign in</h1>
            <p className="text-sm text-slate-600">
              The workspace is private by default. Sign in with a provisioned account to continue.
            </p>
          </div>

          <div className="mt-8 space-y-4">
            {googleConfigured ? (
              <GoogleSignInButton callbackUrl={callbackUrl} />
            ) : (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Google auth is not configured. Set `AUTH_SECRET`, `AUTH_GOOGLE_ID`, and `AUTH_GOOGLE_SECRET`.
              </div>
            )}

            {demoAuthEnabled ? (
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="space-y-1 text-left">
                  <p className="text-sm font-semibold text-slate-900">Development demo sign-in</p>
                  <p className="text-sm text-slate-600">
                    These buttons create or reuse real Postgres-backed users, memberships, and Auth.js sessions.
                  </p>
                </div>
                <DemoSignInButtons callbackUrl={callbackUrl} options={demoOptions} />
              </div>
            ) : null}

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              First Google access is bootstrap-only. Use `AUTH_BOOTSTRAP_SUPER_ADMIN_EMAILS` for the initial
              super-admin email, then provision users through course memberships or future admin work.
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
