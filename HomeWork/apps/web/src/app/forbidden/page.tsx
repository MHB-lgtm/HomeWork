import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function ForbiddenPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 md:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-xl items-center justify-center">
        <section className="w-full rounded-[2rem] border border-slate-200/80 bg-white p-8 text-center shadow-[0_24px_80px_rgba(15,23,42,0.06)]">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Access denied</p>
          <h1 className="mt-3 font-heading text-3xl font-bold tracking-tight text-slate-900">
            This workspace is staff-only
          </h1>
          <p className="mt-3 text-sm text-slate-600">
            Your account does not currently have staff access. Contact a super admin or sign in with a
            provisioned staff account.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/sign-in">
              <Button type="button">Back to sign in</Button>
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
