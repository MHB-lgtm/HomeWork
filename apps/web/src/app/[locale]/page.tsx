'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRole } from '../../contexts/RoleContext';
import { GraduationCap, Users, BookOpen, Brain, BarChart3, ArrowLeft, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';

const features = [
  { icon: <BookOpen size={16} />, label: 'Smart Assignments' },
  { icon: <Brain size={16} />, label: 'AI Grading' },
  { icon: <BarChart3 size={16} />, label: 'Analytics' },
];

export default function LandingPage() {
  const { role, setRole } = useRole();
  const router = useRouter();

  useEffect(() => {
    if (role === 'student') router.replace('/s/dashboard');
    else if (role === 'lecturer') router.replace('/l/dashboard');
  }, [role, router]);

  if (role) return null;

  return (
    <main className="min-h-screen bg-(--bg)">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
        {/* Hero with gradient */}
        <section className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-l from-teal-600 via-cyan-600 to-emerald-500 p-8 sm:p-12 text-white shadow-lg shadow-teal-600/15">
          <div className="hero-blur-tl" />
          <div className="hero-blur-br" />

          <div className="relative max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/20 backdrop-blur-sm px-3 py-1 text-xs font-medium tracking-[0.18em] uppercase mb-5">
              <Sparkles className="w-3.5 h-3.5" />
              Academic Grading Platform
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight tracking-tight">
              Homework Grader
            </h1>
            <p className="mt-4 text-base sm:text-lg text-white/90 max-w-xl leading-relaxed">
              AI-powered grading, assignments, and analytics — for modern classrooms.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-white/90">
              {features.map((f, i) => (
                <div key={i} className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-sm px-3 py-1.5">
                  {f.icon}
                  {f.label}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Role cards */}
        <section className="mt-8">
          <h2 className="text-xs font-medium tracking-[0.18em] uppercase text-(--text-tertiary) mb-4">
            Choose your role
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <RoleCard
              icon={<GraduationCap size={24} />}
              title="Student"
              desc="Submit work, track grades, and study smarter."
              onClick={() => setRole('student')}
            />
            <RoleCard
              icon={<Users size={24} />}
              title="Lecturer"
              desc="Create courses, review submissions, publish grades."
              onClick={() => setRole('lecturer')}
            />
          </div>
        </section>
      </div>

      <footer className="py-8 text-center text-xs text-(--text-quaternary)">
        © Homework Grader
      </footer>
    </main>
  );
}

function RoleCard({ icon, title, desc, onClick }: {
  icon: React.ReactNode; title: string; desc: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-(--border) bg-(--surface) p-6 text-start',
        'transition-all duration-(--duration) ease-(--ease) shadow-sm',
        'hover:border-(--border-hover) hover:shadow-md hover:-translate-y-0.5',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--brand) focus-visible:ring-offset-2'
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-(--brand-subtle) text-(--brand)">
          {icon}
        </div>
        <ArrowLeft className="h-5 w-5 text-(--text-quaternary) rtl:rotate-180 transition-transform duration-(--duration) group-hover:-translate-x-1 rtl:group-hover:translate-x-1" />
      </div>
      <h3 className="mt-5 text-lg font-bold text-(--text-primary)">{title}</h3>
      <p className="mt-1 text-sm text-(--text-tertiary) leading-relaxed">{desc}</p>
    </button>
  );
}
