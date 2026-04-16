'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, ChevronDown, ChevronUp,
  BookOpen,
} from 'lucide-react';
import { cn } from '../../../../../../../../lib/utils';
import { Badge } from '../../../../../../../../components/ui/badge';
import { Card } from '../../../../../../../../components/ui/card';
import {
  getAssignment,
  getCourseOrFallback,
  type DemoDeduction,
} from '../../../../../../../../lib/demoSeed';

function getGradeLetter(pct: number): string {
  if (pct >= 90) return 'A';
  if (pct >= 80) return 'B';
  if (pct >= 70) return 'C';
  if (pct >= 60) return 'D';
  return 'F';
}

function getScoreColor(pct: number): string {
  if (pct >= 90) return 'var(--success)';
  if (pct >= 70) return 'var(--brand)';
  if (pct >= 50) return 'var(--warning)';
  return 'var(--error)';
}

function getBarColor(pct: number): string {
  if (pct >= 85) return 'bg-(--brand)';
  if (pct >= 60) return 'bg-(--warning)';
  return 'bg-(--error)';
}

function getSeverityDot(severity: DemoDeduction['severity']): string {
  switch (severity) {
    case 'critical': return 'bg-(--error)';
    case 'major': return 'bg-(--warning)';
    case 'minor': return 'bg-(--text-quaternary)';
  }
}

function getGradeBadgeVariant(letter: string): 'success' | 'brand' | 'warning' | 'error' {
  switch (letter) {
    case 'A': return 'success';
    case 'B': return 'brand';
    case 'C': return 'warning';
    default: return 'error';
  }
}

export default function ResultPage() {
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) ?? 'en';
  const courseId = params.courseId as string;
  const assignmentId = params.assignmentId as string;
  const studentPrefix = `/${locale}/s`;

  const assignment = getAssignment(assignmentId);
  const course = getCourseOrFallback(courseId);

  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set([1]));

  if (!assignment || assignment.status !== 'PUBLISHED' || !assignment.results) {
    return (
      <div className="min-h-screen bg-(--bg)">
        <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-(--border) bg-(--surface) px-4 md:px-6">
          <button
            onClick={() => router.back()}
            className="h-7 w-7 inline-flex items-center justify-center rounded-md text-(--text-tertiary) hover:bg-(--surface-hover) transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft size={18} />
          </button>
          <span className="text-sm font-medium text-(--text-primary)">Result not available</span>
        </header>
        <main className="mx-auto max-w-2xl px-5 md:px-8 py-12">
          <Card padding="lg" className="text-center">
            <h1 className="text-lg font-semibold text-(--text-primary)">
              This assignment hasn\u2019t been published yet
            </h1>
            <p className="mt-2 text-sm text-(--text-tertiary)">
              Once your lecturer publishes the grade, you\u2019ll see the full breakdown here.
            </p>
            <Link
              href={`${studentPrefix}/courses/${courseId}/assignments/${assignmentId}`}
              className="mt-6 inline-block text-sm font-semibold text-(--brand) hover:underline"
            >
              Back to assignment
            </Link>
          </Card>
        </main>
      </div>
    );
  }

  const totalScore = assignment.finalScore ?? 0;
  const maxScore = assignment.maxScore;
  const pct = Math.round((totalScore / maxScore) * 100);
  const gradeLetter = getGradeLetter(pct);
  const scoreColor = getScoreColor(pct);

  const toggleQuestion = (id: number) => {
    setExpandedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const ringRadius = 54;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - (pct / 100) * ringCircumference;

  return (
    <div className="min-h-screen bg-(--bg)">
      {/* Top bar */}
      <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-(--border) bg-(--surface) px-4 md:px-6">
        <button
          onClick={() => router.back()}
          className="h-7 w-7 inline-flex items-center justify-center rounded-md text-(--text-tertiary) hover:bg-(--surface-hover) transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft size={18} />
        </button>
        <span className="text-sm font-medium text-(--text-primary)">Assignment result</span>
        <div className="flex-1" />
        <Badge variant="default">{course.title}</Badge>
      </header>

      <main className="mx-auto max-w-3xl px-5 md:px-8 py-12 md:py-16 space-y-12">
        {/* Hero */}
        <section className="flex flex-col items-center text-center animate-in">
          <div className="flex items-center gap-8 mb-6">
            <div className="relative shrink-0" style={{ width: 140, height: 140 }}>
              <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                <circle cx="60" cy="60" r={ringRadius} fill="none" stroke="var(--surface-tertiary)" strokeWidth="8" />
                <circle
                  cx="60" cy="60" r={ringRadius}
                  fill="none"
                  stroke={scoreColor}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringOffset}
                  className="transition-all duration-1000"
                  style={{ transitionTimingFunction: 'var(--ease)' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-bold tracking-tight tabular-nums" style={{ color: scoreColor }}>
                  {pct}
                </span>
                <span className="text-xs text-(--text-tertiary) mt-1 tabular-nums">
                  {totalScore}/{maxScore}
                </span>
              </div>
            </div>

            <Badge variant={getGradeBadgeVariant(gradeLetter)} className="text-xl font-bold px-4 py-2">
              {gradeLetter}
            </Badge>
          </div>

          <h1 className="text-2xl font-bold text-(--text-primary) mb-2 tracking-tight">{assignment.title}</h1>
          <p className="text-sm text-(--text-tertiary)">
            Published on{' '}
            {assignment.publishedAt &&
              new Date(assignment.publishedAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
          </p>
        </section>

        {/* Summary Card */}
        {assignment.overallFeedback && (
          <Card padding="lg">
            <p className="text-base text-(--text-secondary) leading-relaxed mb-8">{assignment.overallFeedback}</p>

            <div className="grid md:grid-cols-2 gap-5">
              {assignment.overallStrengths && assignment.overallStrengths.length > 0 && (
                <div className="rounded-xl bg-(--success-subtle) px-5 py-6">
                  <h3 className="text-xs font-semibold text-(--success) uppercase tracking-[0.18em] mb-4">
                    Strengths
                  </h3>
                  <ul className="space-y-3">
                    {assignment.overallStrengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-(--text-secondary) leading-relaxed">
                        <span className="mt-2 h-1.5 w-1.5 rounded-full bg-(--success) shrink-0" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {assignment.overallImprovements && assignment.overallImprovements.length > 0 && (
                <div className="rounded-xl bg-(--warning-subtle) px-5 py-6">
                  <h3 className="text-xs font-semibold text-(--warning) uppercase tracking-[0.18em] mb-4">
                    Areas to improve
                  </h3>
                  <ul className="space-y-3">
                    {assignment.overallImprovements.map((s, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-(--text-secondary) leading-relaxed">
                        <span className="mt-2 h-1.5 w-1.5 rounded-full bg-(--warning) shrink-0" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Score Breakdown */}
        <Card padding="lg">
          <h2 className="text-lg font-semibold text-(--text-primary) mb-6">Score breakdown</h2>
          <div className="space-y-5">
            {assignment.results.map((q) => {
              const qPct = Math.round((q.earnedPoints / q.maxPoints) * 100);
              return (
                <div key={q.id} className="space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-(--text-secondary) truncate">
                      Q{q.id}. {q.title}
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-(--text-primary) shrink-0">
                      {q.earnedPoints}/{q.maxPoints}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-(--surface-tertiary)">
                    <div
                      className={cn('h-full rounded-full transition-all duration-700', getBarColor(qPct))}
                      style={{ width: `${qPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Per-Question Detail */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-(--text-primary)">Detailed breakdown</h2>

          {assignment.results.map((q) => {
            const isOpen = expandedQuestions.has(q.id);
            const qPct = Math.round((q.earnedPoints / q.maxPoints) * 100);
            return (
              <Card key={q.id} padding="none" className="overflow-hidden">
                <button
                  onClick={() => toggleQuestion(q.id)}
                  className={cn(
                    'w-full flex items-center gap-3 p-4 text-left transition-colors',
                    isOpen ? 'bg-(--surface-secondary)' : 'hover:bg-(--surface-hover)',
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-(--text-primary)">
                      Q{q.id}. {q.title}
                    </h3>
                  </div>
                  <Badge variant={qPct >= 85 ? 'success' : qPct >= 60 ? 'warning' : 'error'} size="sm">
                    {q.earnedPoints}/{q.maxPoints}
                  </Badge>
                  {isOpen ? (
                    <ChevronUp size={16} className="text-(--text-quaternary) shrink-0" />
                  ) : (
                    <ChevronDown size={16} className="text-(--text-quaternary) shrink-0" />
                  )}
                </button>

                {isOpen && (
                  <div className="border-t border-(--border) p-4 space-y-4 animate-in">
                    {q.feedback && (
                      <p className="text-sm text-(--text-secondary) leading-relaxed">{q.feedback}</p>
                    )}

                    {q.deductions.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-(--text-tertiary) uppercase tracking-wider">
                          Deductions
                        </h4>
                        {q.deductions.map((d, i) => (
                          <div key={i} className="flex items-start gap-2.5 text-sm text-(--text-secondary)">
                            <span className={cn('mt-1.5 h-2 w-2 rounded-full shrink-0', getSeverityDot(d.severity))} />
                            <span className="flex-1">{d.reason}</span>
                            <span className="text-xs font-medium text-(--error) shrink-0">-{d.points}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {q.strengths.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-(--text-tertiary) uppercase tracking-wider">
                          Strengths
                        </h4>
                        <ul className="space-y-1.5">
                          {q.strengths.map((s, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-(--text-secondary)">
                              <span className="mt-1.5 h-2 w-2 rounded-full bg-(--success) shrink-0" />
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {q.improvements.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-(--text-tertiary) uppercase tracking-wider">
                          Suggestions
                        </h4>
                        <ul className="space-y-1.5">
                          {q.improvements.map((s, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-(--text-secondary)">
                              <span className="mt-1.5 h-2 w-2 rounded-full bg-(--info) shrink-0" />
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        {/* Recommendations */}
        {assignment.recommendations && assignment.recommendations.length > 0 && (
          <Card padding="lg">
            <h2 className="text-sm font-semibold text-(--text-primary) mb-4">Learning recommendations</h2>
            <div className="space-y-3">
              {assignment.recommendations.map((rec, i) => (
                <a
                  key={i}
                  href={rec.link}
                  className="flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-(--surface-hover)"
                >
                  <BookOpen size={16} className="text-(--brand) mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <h4 className="text-sm font-medium text-(--text-primary)">{rec.topic}</h4>
                    <p className="text-xs text-(--text-tertiary) mt-0.5">{rec.description}</p>
                  </div>
                </a>
              ))}
            </div>
          </Card>
        )}

        <div className="h-8" />
      </main>
    </div>
  );
}
