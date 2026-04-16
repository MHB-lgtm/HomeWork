'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRole } from '../../contexts/RoleContext';
import { GraduationCap, Users, BookOpen, Brain, BarChart3, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

const features = [
  { icon: <BookOpen size={15} />, label: 'Smart Assignments' },
  { icon: <Brain size={15} />, label: 'AI Grading' },
  { icon: <BarChart3 size={15} />, label: 'Analytics' },
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
    <div className="flex min-h-screen flex-col bg-(--surface)">
      {/* Hero */}
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-4 py-20">
        <h1 className="text-4xl font-bold tracking-tight text-(--text-primary)">
          AcademyAI
        </h1>
        <p className="mt-2 text-sm text-(--text-secondary)">
          The modern platform for homework, exams, and grading.
        </p>

        {/* Role cards */}
        <div className="mt-10 grid w-full grid-cols-2 gap-3">
          <RoleCard
            icon={<GraduationCap size={24} />}
            title="Student"
            desc="Submit work and track progress."
            onClick={() => setRole('student')}
          />
          <RoleCard
            icon={<Users size={24} />}
            title="Lecturer"
            desc="Create courses and review work."
            onClick={() => setRole('lecturer')}
          />
        </div>

        {/* Feature pills */}
        <div className="mt-8 flex items-center gap-3">
          {features.map((f, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 text-xs text-(--text-tertiary)"
            >
              <span className="text-(--text-quaternary)">{f.icon}</span>
              {f.label}
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-(--text-quaternary)">
        AcademyAI
      </footer>
    </div>
  );
}

function RoleCard({ icon, title, desc, onClick }: {
  icon: React.ReactNode; title: string; desc: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group flex flex-col items-center gap-2.5 rounded-lg border border-(--border) bg-(--surface) p-6 text-center',
        'transition-all duration-150',
        'hover:border-(--border-hover) hover:shadow-(--shadow-md)',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--brand) focus-visible:ring-offset-2'
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-(--surface-secondary) text-(--text-secondary)">
        {icon}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-(--text-primary)">{title}</h3>
        <p className="mt-0.5 text-xs text-(--text-tertiary)">{desc}</p>
      </div>
      <div className="flex items-center gap-0.5 text-xs font-medium text-(--text-quaternary) transition-colors group-hover:text-(--text-secondary)">
        Continue <ChevronRight size={14} />
      </div>
    </button>
  );
}
