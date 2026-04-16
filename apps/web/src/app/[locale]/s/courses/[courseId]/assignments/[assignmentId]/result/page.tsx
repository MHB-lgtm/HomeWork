'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, ChevronDown, ChevronUp,
  CheckCircle2, BookOpen, Lightbulb,
} from 'lucide-react';
import { cn } from '../../../../../../../../lib/utils';
import { Badge } from '../../../../../../../../components/ui/badge';
import { Card } from '../../../../../../../../components/ui/card';

/* ─────────────────────────────────────────────
   Types
   ───────────────────────────────────────────── */

type Severity = 'critical' | 'major' | 'minor';

interface Deduction {
  reason: string;
  points: number;
  severity: Severity;
}

interface QuestionResult {
  id: number;
  title: string;
  maxPoints: number;
  earnedPoints: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
  deductions: Deduction[];
}

interface GradedResult {
  assignmentTitle: string;
  courseName: string;
  totalScore: number;
  maxScore: number;
  gradedAt: string;
  overallFeedback: string;
  overallStrengths: string[];
  overallImprovements: string[];
  questions: QuestionResult[];
  recommendations: { topic: string; description: string; link: string }[];
}

/* ─────────────────────────────────────────────
   Mock Data
   ───────────────────────────────────────────── */

const MOCK_RESULT: GradedResult = {
  assignmentTitle: 'Matrix Operations \u2014 Week 5',
  courseName: 'Linear Algebra',
  totalScore: 63,
  maxScore: 80,
  gradedAt: '2026-03-28T14:30:00Z',
  overallFeedback:
    'Solid understanding of core matrix operations. Your matrix multiplication is flawless and your inverse calculation shows strong procedural knowledge. Focus on eigenvalue computation and determinant sign patterns to close the remaining gaps.',
  overallStrengths: [
    'Excellent matrix multiplication with clear step-by-step work',
    'Strong grasp of the inverse formula for 2x2 matrices',
  ],
  overallImprovements: [
    'Review cofactor expansion sign patterns for determinants',
    'Practice eigenvalue computation with the quadratic formula',
  ],
  questions: [
    {
      id: 1,
      title: 'Matrix Multiplication (3x3)',
      maxPoints: 20,
      earnedPoints: 18,
      feedback:
        'Nearly perfect execution. All nine elements of the resulting matrix are correct. One minor arithmetic slip in the (2,1) entry that did not propagate.',
      strengths: [
        'Clear intermediate dot-product calculations shown',
        'Proper matrix formatting throughout',
      ],
      improvements: [
        'Double-check arithmetic in final entries',
      ],
      deductions: [
        { reason: 'Arithmetic error in element (2,1): 4*2 + (-1)*3 written as 11 instead of 5', points: 2, severity: 'minor' },
      ],
    },
    {
      id: 2,
      title: 'Determinant Calculation',
      maxPoints: 20,
      earnedPoints: 15,
      feedback:
        'Good approach using cofactor expansion along the first row. The 2x2 sub-determinants were computed correctly, but a sign error in the third cofactor led to an incorrect final value.',
      strengths: [
        'Correct choice of cofactor expansion method',
      ],
      improvements: [
        'Watch the alternating sign pattern: +, -, +, -...',
        'Verify by expanding along a different row',
      ],
      deductions: [
        { reason: 'Sign error in third cofactor (should be + not -)', points: 3, severity: 'major' },
        { reason: 'Final determinant value incorrect due to propagated error', points: 2, severity: 'minor' },
      ],
    },
    {
      id: 3,
      title: 'Matrix Inverse (2x2)',
      maxPoints: 25,
      earnedPoints: 20,
      feedback:
        'You correctly applied the 2x2 inverse formula adj(A)/det(A). The adjugate matrix was formed properly. Minor arithmetic error in the final simplification.',
      strengths: [
        'Correct formula application: (1/det) * adj(A)',
        'Determinant computed correctly',
      ],
      improvements: [
        'Simplify fractions fully in the final answer',
        'Verify by multiplying A * A^(-1) = I',
      ],
      deductions: [
        { reason: 'Fraction -6/4 should simplify to -3/2, written as -2/3', points: 5, severity: 'major' },
      ],
    },
    {
      id: 4,
      title: 'Eigenvalues & Eigenvectors',
      maxPoints: 15,
      earnedPoints: 10,
      feedback:
        'You set up the characteristic equation correctly and found one eigenvalue. However, the second root was solved incorrectly and the corresponding eigenvector has errors.',
      strengths: [
        'Correct setup of characteristic equation',
      ],
      improvements: [
        'Use the quadratic formula carefully',
        'Verify eigenvalues by checking det(A - \u03bbI) = 0',
      ],
      deductions: [
        { reason: 'Incorrect second eigenvalue from quadratic formula error', points: 3, severity: 'critical' },
        { reason: 'Eigenvector for \u03bb2 derived from wrong eigenvalue', points: 2, severity: 'major' },
      ],
    },
  ],
  recommendations: [
    {
      topic: 'Cofactor Expansion & Determinants',
      description: 'Review the sign pattern in cofactor expansion and practice with 3x3 and 4x4 matrices.',
      link: '#lecture-4',
    },
    {
      topic: 'Eigenvalue Computation',
      description: 'Revisit the characteristic polynomial method and quadratic formula application.',
      link: '#lecture-6',
    },
    {
      topic: 'Matrix Inverse Verification',
      description: 'Practice verifying inverse matrices by multiplication.',
      link: '#lecture-3',
    },
  ],
};

/* ─────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────── */

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

function getSeverityDot(severity: Severity): string {
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

/* ─────────────────────────────────────────────
   Component
   ───────────────────────────────────────────── */

export default function ResultPage() {
  const router = useRouter();
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set([1]));
  const data = MOCK_RESULT;

  const pct = Math.round((data.totalScore / data.maxScore) * 100);
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

  /* SVG ring geometry */
  const ringRadius = 54;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - (pct / 100) * ringCircumference;

  return (
    <div className="min-h-screen bg-(--bg)">
      {/* ── Top bar ── */}
      <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-(--border) bg-(--surface) px-4 md:px-6">
        <button
          onClick={() => router.back()}
          className="h-7 w-7 inline-flex items-center justify-center rounded-md text-(--text-tertiary) hover:bg-(--surface-hover) transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft size={18} />
        </button>
        <span className="text-sm font-medium text-(--text-primary)">Assignment Result</span>
        <div className="flex-1" />
        <Badge variant="default">{data.courseName}</Badge>
      </header>

      <main className="mx-auto max-w-3xl px-5 md:px-8 py-12 md:py-16 space-y-12">
        {/* ── Hero: Score Ring ── */}
        <section className="flex flex-col items-center text-center animate-in">
          <div className="flex items-center gap-8 mb-6">
            {/* Score circle */}
            <div className="relative shrink-0" style={{ width: 140, height: 140 }}>
              <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                <circle
                  cx="60" cy="60" r={ringRadius}
                  fill="none"
                  stroke="var(--surface-tertiary)"
                  strokeWidth="8"
                />
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
                <span
                  className="text-4xl font-bold tracking-tight tabular-nums"
                  style={{ color: scoreColor }}
                >
                  {pct}
                </span>
              </div>
            </div>

            {/* Grade letter badge */}
            <Badge
              variant={getGradeBadgeVariant(gradeLetter)}
              className="text-xl font-bold px-4 py-2"
            >
              {gradeLetter}
            </Badge>
          </div>

          <h1 className="text-2xl font-bold text-(--text-primary) mb-2 tracking-tight">
            {data.assignmentTitle}
          </h1>
          <p className="text-sm text-(--text-tertiary)">
            Graded on{' '}
            {new Date(data.gradedAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </section>

        {/* ── Summary Card ── */}
        <Card padding="lg">
          <p className="text-base text-(--text-secondary) leading-relaxed mb-8">
            {data.overallFeedback}
          </p>

          <div className="grid md:grid-cols-2 gap-5">
            {/* Strengths */}
            <div className="rounded-xl bg-(--success-subtle) px-5 py-6">
              <h3 className="text-xs font-semibold text-(--success) uppercase tracking-[0.18em] mb-4">
                Strengths
              </h3>
              <ul className="space-y-3">
                {data.overallStrengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-(--text-secondary) leading-relaxed">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-(--success) shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>

            {/* Areas to Improve */}
            <div className="rounded-xl bg-(--warning-subtle) px-5 py-6">
              <h3 className="text-xs font-semibold text-(--warning) uppercase tracking-[0.18em] mb-4">
                Areas to Improve
              </h3>
              <ul className="space-y-3">
                {data.overallImprovements.map((s, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-(--text-secondary) leading-relaxed">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-(--warning) shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>

        {/* ── Score Breakdown: Horizontal Bars ── */}
        <Card padding="lg">
          <h2 className="text-lg font-semibold text-(--text-primary) mb-6">
            Score Breakdown
          </h2>
          <div className="space-y-5">
            {data.questions.map((q) => {
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

        {/* ── Per-Question Detail (Collapsible) ── */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-(--text-primary)">
            Detailed Breakdown
          </h2>

          {data.questions.map((q) => {
            const isOpen = expandedQuestions.has(q.id);
            const qPct = Math.round((q.earnedPoints / q.maxPoints) * 100);

            return (
              <Card key={q.id} padding="none" className="overflow-hidden">
                <button
                  onClick={() => toggleQuestion(q.id)}
                  className={cn(
                    'w-full flex items-center gap-3 p-4 text-left transition-colors',
                    isOpen ? 'bg-(--surface-secondary)' : 'hover:bg-(--surface-hover)'
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
                    {/* Feedback */}
                    <p className="text-sm text-(--text-secondary) leading-relaxed">
                      {q.feedback}
                    </p>

                    {/* Deductions */}
                    {q.deductions.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-(--text-tertiary) uppercase tracking-wider">
                          Deductions
                        </h4>
                        {q.deductions.map((d, i) => (
                          <div
                            key={i}
                            className="flex items-start gap-2.5 text-sm text-(--text-secondary)"
                          >
                            <span className={cn('mt-1.5 h-2 w-2 rounded-full shrink-0', getSeverityDot(d.severity))} />
                            <span className="flex-1">{d.reason}</span>
                            <span className="text-xs font-medium text-(--error) shrink-0">
                              -{d.points}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Strengths */}
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

                    {/* Suggestions */}
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

        {/* ── Learning Recommendations ── */}
        <Card padding="lg">
          <h2 className="text-sm font-semibold text-(--text-primary) mb-4">
            Learning Recommendations
          </h2>
          <div className="space-y-3">
            {data.recommendations.map((rec, i) => (
              <a
                key={i}
                href={rec.link}
                className="flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-(--surface-hover)"
              >
                <BookOpen size={16} className="text-(--brand) mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <h4 className="text-sm font-medium text-(--text-primary)">
                    {rec.topic}
                  </h4>
                  <p className="text-xs text-(--text-tertiary) mt-0.5">
                    {rec.description}
                  </p>
                </div>
              </a>
            ))}
          </div>
        </Card>

        {/* Bottom spacer */}
        <div className="h-8" />
      </main>
    </div>
  );
}
