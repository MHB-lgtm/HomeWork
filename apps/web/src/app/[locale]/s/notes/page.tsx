/**
 * StudyFlow — Notes Home
 *
 * Entry point for the Smart Notes product. Shows a grid of the student's
 * Workspaces (one per course) and a prominent "New Workspace" CTA.
 *
 * Server component — loads workspaces from the DB (stubbed here with demo data
 * until the notes postgres-store slice lands; the shape matches the Zod schema).
 */

import Link from 'next/link';
import { BookOpen, Plus, Sparkles } from 'lucide-react';
import { cn } from '../../../../lib/utils';
import { getDemoWorkspaces } from '../../../../lib/notes/demoWorkspaces';

interface Props {
  params: { locale: string };
}

export default async function NotesHomePage({ params }: Props) {
  const { locale } = params;
  const workspaces = await getDemoWorkspaces();

  return (
    <main className="mx-auto max-w-6xl px-6 py-10" dir="rtl">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-brand">
            <Sparkles className="h-4 w-4" />
            StudyFlow · Smart Notes
          </div>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">
            המרחבים שלך
          </h1>
          <p className="mt-1 text-slate-600">
            כל קורס הוא workspace — הרצאות, תרגולים ושיעורי בית במקום אחד.
          </p>
        </div>
        <Link
          href={`/${locale}/s/notes/new`}
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-white shadow hover:bg-brand/90"
        >
          <Plus className="h-4 w-4" />
          Workspace חדש
        </Link>
      </header>

      {workspaces.length === 0 ? (
        <EmptyState locale={locale} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((ws) => (
            <WorkspaceCard key={ws.id} ws={ws} locale={locale} />
          ))}
        </div>
      )}
    </main>
  );
}

function WorkspaceCard({
  ws,
  locale,
}: {
  ws: {
    id: string;
    name: string;
    color: string;
    icon?: string;
    filesCount: number;
    lastActivityIso: string;
  };
  locale: string;
}) {
  return (
    <Link
      href={`/${locale}/s/notes/workspaces/${ws.id}`}
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition',
        'hover:-translate-y-0.5 hover:shadow-lg',
      )}
    >
      <div
        className="absolute inset-x-0 top-0 h-1.5"
        style={{ background: ws.color }}
      />
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-slate-500" />
            <h2 className="text-lg font-semibold text-slate-900">{ws.name}</h2>
          </div>
          <p className="mt-2 text-sm text-slate-500">
            {ws.filesCount} קבצים · עודכן {formatRelative(ws.lastActivityIso)}
          </p>
        </div>
      </div>
      <span className="mt-4 inline-block text-sm text-brand opacity-0 transition group-hover:opacity-100">
        פתח workspace ←
      </span>
    </Link>
  );
}

function EmptyState({ locale }: { locale: string }) {
  return (
    <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-white p-12 text-center">
      <Sparkles className="mx-auto h-10 w-10 text-brand" />
      <h2 className="mt-4 text-xl font-semibold text-slate-900">
        בואי נתחיל — workspace ראשון
      </h2>
      <p className="mt-2 text-slate-600">
        כל קורס שלך יקבל workspace משלו. העלי/י PDF של הרצאה או שיעורי בית —
        והמערכת תזהה ותפתח בצורה הנכונה.
      </p>
      <Link
        href={`/${locale}/s/notes/new`}
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-white shadow hover:bg-brand/90"
      >
        <Plus className="h-4 w-4" />
        יצירת Workspace
      </Link>
    </div>
  );
}

/** Simple RTL-friendly relative time — replace with next-intl later */
function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'לפני רגע';
  if (min < 60) return `לפני ${min} דקות`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `לפני ${hr} שעות`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `לפני ${day} ימים`;
  return new Date(iso).toLocaleDateString('he-IL');
}
