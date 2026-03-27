'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, ChevronLeft, ChevronRight, Save, Send,
  FileText, Clock, User, Bot, Shield,
  AlertTriangle, XCircle, Check,
} from 'lucide-react';
import { cn } from '../../../../../../../../lib/utils';
import { Button } from '../../../../../../../../components/ui/button';
import { Card } from '../../../../../../../../components/ui/card';
import { Badge } from '../../../../../../../../components/ui/badge';
import { StatusBadge } from '../../../../../../../../components/ui/status-badge';

/* ── Types ── */

type ReviewStatus = 'draft' | 'review' | 'published';
type Severity = 'critical' | 'major' | 'minor';

interface QuestionGrade {
  id: number;
  title: string;
  maxPoints: number;
  aiScore: number;
  editedScore: number | null;
  aiFeedback: string;
  editedFeedback: string | null;
  aiConfidence: number;
  overridden: boolean;
}

interface Annotation {
  id: number;
  text: string;
  severity: Severity;
  location: string;
}

/* ── Mock Data ── */

const MOCK_STUDENT = {
  name: 'Noa Levi',
  submittedAt: '2026-03-24T22:15:00Z',
  submissionNumber: 3,
  totalSubmissions: 18,
};

const MOCK_QUESTIONS: QuestionGrade[] = [
  {
    id: 1, title: 'Matrix Multiplication (3x3)', maxPoints: 25, aiScore: 25,
    editedScore: null, aiFeedback: 'Perfect execution. All nine elements of the resulting matrix are correct with clear intermediate calculations shown for each dot product.',
    editedFeedback: null, aiConfidence: 0.97, overridden: false,
  },
  {
    id: 2, title: 'Determinant Calculation', maxPoints: 25, aiScore: 20,
    editedScore: null, aiFeedback: 'Cofactor expansion along the first row was applied correctly, but a sign error in the third cofactor led to an incorrect final determinant value.',
    editedFeedback: null, aiConfidence: 0.89, overridden: false,
  },
  {
    id: 3, title: 'Matrix Inverse (2x2)', maxPoints: 25, aiScore: 22,
    editedScore: null, aiFeedback: 'Correct application of the 2x2 inverse formula. Minor arithmetic error in fraction simplification: -6/4 written as -2/3 instead of -3/2.',
    editedFeedback: null, aiConfidence: 0.93, overridden: false,
  },
  {
    id: 4, title: 'Eigenvalues & Eigenvectors', maxPoints: 25, aiScore: 18,
    editedScore: null, aiFeedback: 'Characteristic equation set up correctly. Quadratic formula applied incorrectly for the second root, leading to a wrong eigenvalue and incorrect second eigenvector.',
    editedFeedback: null, aiConfidence: 0.82, overridden: false,
  },
];

const MOCK_ANNOTATIONS: Annotation[] = [
  { id: 1, text: 'Sign error in cofactor C13 -- should be positive', severity: 'major', location: 'Q2, Step 3' },
  { id: 2, text: 'Fraction not fully simplified: -6/4 != -2/3', severity: 'minor', location: 'Q3, Final answer' },
  { id: 3, text: 'Quadratic formula: discriminant computed incorrectly', severity: 'critical', location: 'Q4, Step 2' },
  { id: 4, text: 'Eigenvector derived from incorrect eigenvalue', severity: 'major', location: 'Q4, Step 4' },
];

const MOCK_SUBMISSION_TEXT = `Question 1: Matrix Multiplication (3x3)
Given A = [[1,2,3],[4,5,6],[7,8,9]] and B = [[9,8,7],[6,5,4],[3,2,1]]

C = A * B

C11 = 1*9 + 2*6 + 3*3 = 9 + 12 + 9 = 30
C12 = 1*8 + 2*5 + 3*2 = 8 + 10 + 6 = 24
C13 = 1*7 + 2*4 + 3*1 = 7 + 8 + 3 = 18
C21 = 4*9 + 5*6 + 6*3 = 36 + 30 + 18 = 84
C22 = 4*8 + 5*5 + 6*2 = 32 + 25 + 12 = 69
C23 = 4*7 + 5*4 + 6*1 = 28 + 20 + 6 = 54
C31 = 7*9 + 8*6 + 9*3 = 63 + 48 + 27 = 138
C32 = 7*8 + 8*5 + 9*2 = 56 + 40 + 18 = 114
C33 = 7*7 + 8*4 + 9*1 = 49 + 32 + 9 = 90

C = [[30,24,18],[84,69,54],[138,114,90]]

Question 2: Determinant of A = [[2,1,3],[4,5,6],[7,8,9]]

det(A) = 2*(5*9-6*8) - 1*(4*9-6*7) + 3*(4*8-5*7)
       = 2*(45-48) - 1*(36-42) - 3*(32-35)
       = 2*(-3) - 1*(-6) - 3*(-3)
       = -6 + 6 + 9 = 9

Question 3: Inverse of A = [[4,6],[2,4]]

det(A) = 4*4 - 6*2 = 16-12 = 4
A^(-1) = (1/4)*[[4,-6],[-2,4]] = [[1, -2/3],[-1/2, 1]]

(Error: -6/4 = -3/2, not -2/3)

Question 4: Eigenvalues of A = [[3,1],[1,3]]

det(A - \u03BBI) = 0
(3-\u03BB)(3-\u03BB) - 1 = 0
\u03BB^2 - 6\u03BB + 8 = 0

\u03BB1 = 4, \u03BB2 = 3 (should be 2)`;

/* ── Helpers ── */

function confidenceVariant(c: number): 'success' | 'warning' | 'error' {
  if (c >= 0.9) return 'success';
  if (c >= 0.8) return 'warning';
  return 'error';
}

function confidenceLabel(c: number): string {
  if (c >= 0.9) return 'High';
  if (c >= 0.8) return 'Medium';
  return 'Low';
}

function severityVariant(s: Severity): 'error' | 'warning' | 'info' {
  if (s === 'critical') return 'error';
  if (s === 'major') return 'warning';
  return 'info';
}

/* ── Component ── */

export default function ReviewPage() {
  const router = useRouter();
  const [questions, setQuestions] = useState(MOCK_QUESTIONS);
  const [status, setStatus] = useState<ReviewStatus>('draft');
  const [annotationsOpen, setAnnotationsOpen] = useState(true);

  const aiTotal = questions.reduce((s, q) => s + q.aiScore, 0);
  const currentTotal = questions.reduce((s, q) => s + (q.editedScore ?? q.aiScore), 0);
  const maxTotal = questions.reduce((s, q) => s + q.maxPoints, 0);

  const updateScore = (id: number, val: string) => {
    const num = parseInt(val, 10);
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== id) return q;
        const clamped = isNaN(num) ? null : Math.max(0, Math.min(num, q.maxPoints));
        return { ...q, editedScore: clamped, overridden: clamped !== null && clamped !== q.aiScore };
      }),
    );
  };

  const updateFeedback = (id: number, val: string) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === id ? { ...q, editedFeedback: val || null, overridden: true } : q,
      ),
    );
  };

  const resetToAI = (id: number) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === id ? { ...q, editedScore: null, editedFeedback: null, overridden: false } : q,
      ),
    );
  };

  return (
    <div className="flex h-screen flex-col bg-(--bg)">
      {/* ── Top Bar ── */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-(--border) bg-(--surface) px-4 py-2.5 md:px-6">
        <button
          onClick={() => router.back()}
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
            'border border-(--border) text-(--text-tertiary)',
            'transition-colors hover:bg-(--surface-hover) hover:text-(--text-primary)',
          )}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-(--text-tertiary)" />
          <span className="text-sm font-medium text-(--text-primary)">{MOCK_STUDENT.name}</span>
        </div>

        <div className="flex-1" />

        <span className="hidden text-xs text-(--text-quaternary) sm:block">
          {MOCK_STUDENT.submissionNumber} of {MOCK_STUDENT.totalSubmissions}
        </span>

        <div className="flex items-center gap-1">
          <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-(--border) text-(--text-tertiary) transition-colors hover:bg-(--surface-hover)">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-(--border) text-(--text-tertiary) transition-colors hover:bg-(--surface-hover)">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="ml-2 flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={<Save />} onClick={() => setStatus('review')}>
            Save
          </Button>
          <Button size="sm" icon={<Send />} onClick={() => setStatus('published')}>
            Publish
          </Button>
        </div>
      </header>

      {/* ── Split Layout ── */}
      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        {/* Left: Submission Content */}
        <div className="flex-1 overflow-y-auto border-b border-(--border) p-4 md:p-6 lg:w-3/5 lg:border-b-0 lg:border-r">
          <Card padding="lg">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-(--surface-secondary) text-(--text-tertiary)">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-(--text-primary)">Student Submission</h3>
                <p className="text-xs text-(--text-tertiary)">
                  <Clock className="mr-1 inline h-3 w-3" />
                  {new Date(MOCK_STUDENT.submittedAt).toLocaleString(undefined, {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
            <pre className="whitespace-pre-wrap rounded-xl bg-(--surface-secondary) p-4 text-xs leading-relaxed text-(--text-secondary) font-mono">
              {MOCK_SUBMISSION_TEXT}
            </pre>
            <div className="mt-3 text-center text-xs text-(--text-quaternary)">Page 1 of 1</div>
          </Card>
        </div>

        {/* Right: Grading Panel */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:w-2/5">
          <div className="space-y-4">
            {/* Overall Score */}
            <Card padding="lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-(--text-tertiary)">Total Score</p>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <input
                      type="number"
                      value={currentTotal}
                      readOnly
                      className="w-16 bg-transparent text-3xl font-semibold tracking-tight text-(--text-primary) outline-none"
                    />
                    <span className="text-lg text-(--text-quaternary)">/ {maxTotal}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-(--text-tertiary)">AI Suggested</p>
                  <p className="text-lg font-semibold text-(--brand)">{aiTotal}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <StatusBadge status={status} size="sm" />
              </div>
            </Card>

            {/* Per-Question Sections */}
            {questions.map((q) => {
              const currentScore = q.editedScore ?? q.aiScore;
              const currentFeedback = q.editedFeedback ?? q.aiFeedback;

              return (
                <Card key={q.id} padding="lg" className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h3 className="flex-1 text-sm font-semibold text-(--text-primary)">
                      Q{q.id}: {q.title}
                    </h3>
                    <Badge variant={confidenceVariant(q.aiConfidence)} size="sm">
                      <Shield className="mr-1 inline h-3 w-3" />
                      {confidenceLabel(q.aiConfidence)}
                    </Badge>
                  </div>

                  {/* Score input */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-(--text-tertiary)">Score</span>
                    <input
                      type="number"
                      min={0}
                      max={q.maxPoints}
                      value={currentScore}
                      onChange={(e) => updateScore(q.id, e.target.value)}
                      className={cn(
                        'h-8 w-14 rounded-lg border text-center text-sm font-semibold text-(--text-primary) outline-none',
                        q.overridden
                          ? 'border-(--warning) bg-(--warning-subtle)'
                          : 'border-(--border) bg-(--surface)',
                      )}
                    />
                    <span className="text-xs text-(--text-quaternary)">/ {q.maxPoints}</span>
                    <span className="text-xs text-(--text-quaternary)">(AI: {q.aiScore})</span>
                    <div className="flex-1" />
                    {q.overridden && (
                      <Button variant="ghost" size="sm" onClick={() => resetToAI(q.id)}>
                        <Bot className="mr-1 h-3 w-3" />
                        Reset to AI
                      </Button>
                    )}
                  </div>

                  {/* Feedback */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-(--text-tertiary)">Feedback</label>
                    <textarea
                      rows={3}
                      value={currentFeedback}
                      onChange={(e) => updateFeedback(q.id, e.target.value)}
                      className={cn(
                        'w-full resize-none rounded-lg border p-3 text-sm leading-relaxed text-(--text-secondary) outline-none',
                        'transition-colors focus:border-(--border-hover)',
                        q.overridden
                          ? 'border-(--warning) bg-(--warning-subtle)'
                          : 'border-(--border) bg-(--surface)',
                      )}
                    />
                  </div>
                </Card>
              );
            })}

            {/* Annotations */}
            <Card padding="none">
              <button
                onClick={() => setAnnotationsOpen(!annotationsOpen)}
                className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-(--surface-hover)"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-(--warning)" />
                  <span className="text-sm font-semibold text-(--text-primary)">
                    AI-Detected Issues ({MOCK_ANNOTATIONS.length})
                  </span>
                </div>
                <ChevronRight className={cn('h-4 w-4 text-(--text-quaternary) transition-transform', annotationsOpen && 'rotate-90')} />
              </button>
              {annotationsOpen && (
                <div className="border-t border-(--border-light) px-5 py-3 space-y-2">
                  {MOCK_ANNOTATIONS.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-start gap-3 rounded-lg bg-(--surface-secondary) p-3"
                    >
                      <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--error)" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-(--text-secondary)">{a.text}</p>
                        <p className="mt-0.5 text-xs text-(--text-quaternary)">{a.location}</p>
                      </div>
                      <Badge variant={severityVariant(a.severity)} size="sm">{a.severity}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <div className="h-4" />
          </div>
        </div>
      </div>
    </div>
  );
}
