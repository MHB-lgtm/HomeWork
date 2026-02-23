'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Inter } from 'next/font/google';
import { EvaluationResult, RubricEvaluationResult } from '@hg/shared-schemas';
import { RubricCriterionRow } from '../components/RubricCriterionRow';
import { listExams, ExamSummary } from '../lib/examsClient';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { cn } from '../lib/utils';

interface HealthStatus {
  ok: boolean;
  dataDir: string;
  workerAlive: boolean;
  heartbeatAgeMs: number | null;
}

const DEFAULT_GRADING_MODE: 'GENERAL' = 'GENERAL';
const DEFAULT_GRADING_SCOPE: 'DOCUMENT' = 'DOCUMENT';
const DEFAULT_SUBMISSION_MODE: 'pdf' = 'pdf';
const inter = Inter({ subsets: ['latin'], display: 'swap' });

function getStatusBadgeVariant(status: string | null): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (status) {
    case 'DONE':
      return 'default';
    case 'FAILED':
      return 'destructive';
    case 'PENDING':
    case 'RUNNING':
      return 'secondary';
    default:
      return 'outline';
  }
}

export default function Home() {
  const [examId, setExamId] = useState('');
  const [questionId, setQuestionId] = useState('');
  const [questionFile, setQuestionFile] = useState<File | null>(null);
  const [submissionFile, setSubmissionFile] = useState<File | null>(null);
  const [submissionMode, setSubmissionMode] = useState<'image' | 'pdf'>(DEFAULT_SUBMISSION_MODE);
  const [gradingMode, setGradingMode] = useState<'RUBRIC' | 'GENERAL'>(DEFAULT_GRADING_MODE);
  const [gradingScope, setGradingScope] = useState<'QUESTION' | 'DOCUMENT'>(DEFAULT_GRADING_SCOPE);
  const [notes, setNotes] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [rubricEvaluation, setRubricEvaluation] = useState<RubricEvaluationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [workerAlive, setWorkerAlive] = useState<boolean | null>(null);
  const [availableExams, setAvailableExams] = useState<ExamSummary[]>([]);
  const [isLoadingExams, setIsLoadingExams] = useState(false);
  const [copiedJobId, setCopiedJobId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    if (!submissionFile) {
      setError('Submission file is required.');
      setIsSubmitting(false);
      return;
    }

    // Validation based on grading mode and scope
    if (!examId.trim()) {
      setError('Please select an exam');
      setIsSubmitting(false);
      return;
    }

    // Question ID required for Rubric mode or General + Question scope
    if (gradingMode === 'RUBRIC' || (gradingMode === 'GENERAL' && gradingScope === 'QUESTION')) {
      if (!questionId.trim()) {
        setError('Please provide a question');
        setIsSubmitting(false);
        return;
      }
    }

    try {
      const formData = new FormData();
      formData.append('examId', examId.trim());
      formData.append('questionId', questionId.trim());
      formData.append('submission', submissionFile);
      formData.append('submissionMode', submissionMode);
      formData.append('gradingMode', gradingMode);
      formData.append('gradingScope', gradingScope);
      if (questionFile && questionFile.size > 0) {
        formData.append('question', questionFile);
      }
      if (notes) {
        formData.append('notes', notes);
      }

      const response = await fetch('/api/jobs', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error || 'Failed to create job';
        
        // User-friendly error messages
        if (response.status === 404 && errorMessage.includes('Rubric not found')) {
          throw new Error('Rubric not found. Please create it at /rubrics first.');
        }
        if (response.status === 400) {
          throw new Error(errorMessage);
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setJobId(data.jobId);
      setStatus('PENDING');
      startPolling(data.jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsSubmitting(false);
    }
  };

  // Poll health status every 7 seconds
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch('/api/health');
        if (response.ok) {
          const health: HealthStatus = await response.json();
          setWorkerAlive(health.workerAlive);
        }
      } catch (err) {
        // Silently fail - don't spam logs
        setWorkerAlive(false);
      }
    };

    // Check immediately
    checkHealth();

    // Then check every 7 seconds
    const healthInterval = setInterval(checkHealth, 7000);

    return () => clearInterval(healthInterval);
  }, []);

  // Load exams on mount
  useEffect(() => {
    const loadExams = async () => {
      setIsLoadingExams(true);
      const result = await listExams();
      setIsLoadingExams(false);
      if (result.ok) {
        setAvailableExams(result.data);
      }
    };
    loadExams();
  }, []);

  const startPolling = (id: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/jobs/${id}`);
        if (!response.ok) {
          throw new Error('Failed to fetch job status');
        }

        const data = await response.json();
        setStatus(data.status);

        if (data.status === 'DONE') {
          clearInterval(pollInterval);
          setIsSubmitting(false);
          if (data.resultJson) {
            // Check if rubricEvaluation exists
            if (data.resultJson.rubricEvaluation) {
              setRubricEvaluation(data.resultJson.rubricEvaluation as RubricEvaluationResult);
              setResult(null);
            } else {
              // Legacy format
              setResult(data.resultJson as EvaluationResult);
              setRubricEvaluation(null);
            }
          }
        } else if (data.status === 'FAILED') {
          clearInterval(pollInterval);
          setIsSubmitting(false);
          setError(data.errorMessage || 'Job failed');
        }
      } catch (err) {
        clearInterval(pollInterval);
        setIsSubmitting(false);
        setError(err instanceof Error ? err.message : 'Polling error');
      }
    }, 2000); // Poll every 2 seconds
  };

  const showWorkerWarning = workerAlive === false;
  const hasFailure = status === 'FAILED';

  const copyJobId = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedJobId(value);
      window.setTimeout(() => {
        setCopiedJobId((prev) => (prev === value ? null : prev));
      }, 1200);
    } catch {
      setCopiedJobId(null);
    }
  };

  const setSimpleDefaults = () => {
    setGradingMode(DEFAULT_GRADING_MODE);
    setGradingScope(DEFAULT_GRADING_SCOPE);
    setSubmissionMode(DEFAULT_SUBMISSION_MODE);
    setQuestionId('');
    setQuestionFile(null);
    setNotes('');
  };

  const handleAdvancedToggle = (enabled: boolean) => {
    setShowAdvanced(enabled);
    if (!enabled) {
      setSimpleDefaults();
    }
  };

  const statusSteps = [
    {
      key: 'created',
      label: 'Created',
      complete: !!jobId,
      active: !!jobId && !status,
      description: jobId ? 'Job is registered' : 'Waiting for a job to start',
    },
    {
      key: 'processing',
      label: hasFailure ? 'Processing failed' : 'Processing',
      complete: status === 'RUNNING' || status === 'DONE' || hasFailure,
      active: status === 'RUNNING',
      description: hasFailure ? 'Check error details' : 'The worker is grading now',
    },
    {
      key: 'results',
      label: hasFailure ? 'Needs attention' : 'Results ready',
      complete: status === 'DONE',
      active: status === 'DONE',
      description: hasFailure ? 'Re-run or adjust inputs' : 'Open the review to inspect feedback',
    },
  ];

  const homeFontStyle = {
    '--font-body': inter.style.fontFamily,
    '--font-heading': inter.style.fontFamily,
    fontFamily: inter.style.fontFamily,
  } as React.CSSProperties;

  return (
    <main
      className={`${inter.className} min-h-screen text-slate-900 bg-[radial-gradient(1200px_520px_at_50%_-8%,rgba(255,255,255,0.98),rgba(255,255,255,0)_62%),radial-gradient(900px_520px_at_12%_38%,rgba(59,130,246,0.44),rgba(59,130,246,0)_70%),radial-gradient(900px_520px_at_88%_38%,rgba(56,189,248,0.38),rgba(56,189,248,0)_70%),radial-gradient(1000px_540px_at_50%_100%,rgba(244,114,182,0.42),rgba(244,114,182,0)_76%),linear-gradient(180deg,#f8fbff_0%,#eef4ff_48%,#ffe8f4_100%)]`}
      style={homeFontStyle}
    >
      <div className="mx-auto flex min-h-screen w-full flex-col px-4 pb-8 pt-20 md:px-6 md:pb-10 md:pt-24">
        <div className="flex w-full justify-center">
          <header className="w-[88vw] max-w-[1180px] rounded-full border border-slate-200/80 bg-white/95 px-5 py-2.5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-md md:w-[84vw] md:px-7">
          <div className="flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 via-cyan-500 to-indigo-500 text-sm font-bold text-white shadow-sm">
                HG
              </span>
              <span className="font-heading text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">Homework Grader</span>
            </Link>

            <nav className="hidden items-center gap-8 text-base font-medium text-slate-900 md:flex">
              <Link href="/exams" className="transition-colors hover:text-slate-700">
                Exams
              </Link>
              <Link href="/rubrics" className="transition-colors hover:text-slate-700">
                Rubrics
              </Link>
              <Link href="/reviews" className="transition-colors hover:text-slate-700">
                Reviews
              </Link>
              <Link href="/courses" className="transition-colors hover:text-slate-700">
                Courses
              </Link>
            </nav>
          </div>
          </header>
        </div>

        <section className="mx-auto mt-16 flex w-full max-w-3xl flex-col items-center space-y-4 text-center md:mt-20">
          <h1 className="font-heading text-5xl font-bold tracking-tight text-slate-900 md:text-6xl">
            Grade Exams With Clarity
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-slate-700 md:text-2xl">
            Upload one student sheet, review focused feedback, and keep your workflow simple.
          </p>
          {showWorkerWarning && (
            <Alert variant="default" className="mx-auto max-w-2xl border-amber-200 bg-amber-50/85 text-amber-900 text-left">
              <AlertTitle>Worker is not running</AlertTitle>
              <AlertDescription>Jobs will stay pending until the worker is up.</AlertDescription>
            </Alert>
          )}
        </section>

        <div className="mt-1 flex w-full flex-col items-center gap-6 md:mt-2">
          {/* Left Panel: Create Grading Job */}
          <Card
            id="create-review"
            className="mx-auto w-full max-w-3xl rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/40"
          >
            <CardContent className="space-y-8 pt-6">
              {!jobId ? (
                <form onSubmit={handleSubmit} className="space-y-8">
                  <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-6">
                    <div className="space-y-2">
                      <label htmlFor="examId" className="sr-only text-slate-900">
                        Exam
                      </label>
                      <div className="space-y-2">
                        {availableExams.length > 0 ? (
                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                setExamId(e.target.value);
                              }
                            }}
                            value={examId}
                            className="flex h-11 w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                          >
                            <option value="">Choose exam...</option>
                            {availableExams.map((exam) => (
                              <option key={exam.examId} value={exam.examId}>
                                {exam.title}
                              </option>
                            ))}
                          </select>
                        ) : null}
                        <details className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-600">
                          <summary className="cursor-pointer font-medium text-slate-700">Use exam ID instead</summary>
                          <Input
                            id="examId"
                            type="text"
                            value={examId}
                            onChange={(e) => setExamId(e.target.value)}
                            required
                            placeholder={isLoadingExams ? 'Loading exams...' : 'Enter exam ID'}
                            className="mt-2 h-9 flex-1 border-slate-200 font-mono text-xs text-slate-900 focus-visible:border-slate-900 focus-visible:ring-1 focus-visible:ring-slate-900 focus-visible:ring-offset-0"
                          />
                        </details>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-6 space-y-4">
                    <p className="text-sm font-medium text-slate-900">Student sheet</p>
                    <input
                      type="file"
                      id="submission"
                      accept={submissionMode === 'pdf' ? '.pdf,application/pdf' : 'image/*'}
                      onChange={(e) => setSubmissionFile(e.target.files?.[0] || null)}
                      required
                      className="sr-only"
                    />
                    <label
                      htmlFor="submission"
                      className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-8 text-center transition-colors hover:border-slate-400 hover:bg-slate-50"
                    >
                      <span className="text-base font-medium text-slate-900">
                        {submissionMode === 'pdf' ? 'Click to upload a PDF sheet' : 'Click to upload an image'}
                      </span>
                      <span className="mt-2 text-sm text-slate-600">
                        {submissionFile ? submissionFile.name : 'No file selected'}
                      </span>
                    </label>
                  </div>

                  <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-6 space-y-4">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-900">
                      <input
                        type="checkbox"
                        checked={showAdvanced}
                        onChange={(e) => handleAdvancedToggle(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900"
                      />
                      Advanced options
                    </label>
                    {!showAdvanced ? (
                      <p className="text-sm text-slate-500">
                        Default setup is already selected.
                      </p>
                    ) : null}

                    {showAdvanced ? (
                      <div className="space-y-5 border-t border-slate-200 pt-5">
                        <div className="space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Mode</p>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant={gradingMode === 'RUBRIC' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setGradingMode('RUBRIC')}
                            >
                              Rubric
                            </Button>
                            <Button
                              type="button"
                              variant={gradingMode === 'GENERAL' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setGradingMode('GENERAL')}
                            >
                              General
                            </Button>
                          </div>
                        </div>

                        {gradingMode === 'GENERAL' ? (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Scope</p>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant={gradingScope === 'QUESTION' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setGradingScope('QUESTION')}
                              >
                                Question
                              </Button>
                              <Button
                                type="button"
                                variant={gradingScope === 'DOCUMENT' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setGradingScope('DOCUMENT')}
                              >
                                Document
                              </Button>
                            </div>
                          </div>
                        ) : null}

                        <div className="space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">File type</p>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant={submissionMode === 'image' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => {
                                setSubmissionMode('image');
                                setSubmissionFile(null);
                              }}
                            >
                              Image
                            </Button>
                            <Button
                              type="button"
                              variant={submissionMode === 'pdf' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => {
                                setSubmissionMode('pdf');
                                setSubmissionFile(null);
                              }}
                            >
                              PDF
                            </Button>
                          </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <label htmlFor="questionId" className="text-sm font-medium text-slate-900">
                              Question ID
                              {(gradingMode === 'RUBRIC' || (gradingMode === 'GENERAL' && gradingScope === 'QUESTION')) && (
                                <span className="text-red-600"> *</span>
                              )}
                            </label>
                            <Input
                              id="questionId"
                              type="text"
                              value={questionId}
                              onChange={(e) => setQuestionId(e.target.value)}
                              required={gradingMode === 'RUBRIC' || (gradingMode === 'GENERAL' && gradingScope === 'QUESTION')}
                              disabled={gradingMode === 'GENERAL' && gradingScope === 'DOCUMENT'}
                              placeholder={gradingMode === 'GENERAL' && gradingScope === 'DOCUMENT' ? 'Optional in Document scope' : ''}
                              className="border-slate-200 text-slate-900 focus-visible:border-slate-900 focus-visible:ring-1 focus-visible:ring-slate-900 focus-visible:ring-offset-0"
                            />
                          </div>

                          <div className="space-y-2">
                            <label htmlFor="question" className="text-sm font-medium text-slate-900">
                              Question file
                            </label>
                            <Input
                              type="file"
                              id="question"
                              accept="image/*,.pdf"
                              onChange={(e) => setQuestionFile(e.target.files?.[0] || null)}
                              className="border-slate-200 text-slate-900 focus-visible:border-slate-900 focus-visible:ring-1 focus-visible:ring-slate-900 focus-visible:ring-offset-0"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label htmlFor="notes" className="text-sm font-medium text-slate-900">
                            Additional context
                          </label>
                          <Textarea
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                            placeholder="Optional notes"
                            className="border-slate-200 text-slate-900 focus-visible:border-slate-900 focus-visible:ring-1 focus-visible:ring-slate-900 focus-visible:ring-offset-0"
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {error && !jobId && (
                    <Alert variant="destructive">
                      <AlertTitle>Error</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="h-12 w-full rounded-xl bg-slate-900 text-lg font-semibold text-white shadow-sm transition-colors hover:bg-slate-800"
                  >
                    {isSubmitting ? 'Checking...' : 'Check Exam'}
                  </Button>
                </form>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  Review created successfully. Check progress below.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Review Status & Results */}
          {jobId && (
            <div className="w-full max-w-4xl space-y-6">
              {/* Job Status Card */}
              <Card className="rounded-3xl border-slate-200/80 bg-white/90 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold text-slate-900">Review Status</CardTitle>
                    {status && (
                      <Badge variant={getStatusBadgeVariant(status)}>
                        {status}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <details className="rounded-2xl border border-slate-200/80 bg-slate-50/70 px-4 py-3 text-xs text-slate-600">
                    <summary className="cursor-pointer font-medium text-slate-700">Technical details</summary>
                    {jobId && (
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="font-mono">Job ID: {jobId}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => copyJobId(jobId)}
                        >
                          {copiedJobId === jobId ? 'Copied' : 'Copy'}
                        </Button>
                      </div>
                    )}
                  </details>

                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-slate-900">Progress</p>
                    <div className="relative space-y-3">
                      {statusSteps.map((step, index) => {
                        const isLast = index === statusSteps.length - 1;
                        const tone = cn(
                          'flex h-10 w-10 items-center justify-center rounded-2xl border text-sm font-semibold',
                          step.complete
                            ? 'bg-blue-600 text-white border-blue-600'
                            : hasFailure && step.key === 'processing'
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : step.active
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-slate-50 text-slate-500 border-slate-200'
                        );

                        return (
                          <div key={step.key} className="flex gap-3">
                            <div className="flex flex-col items-center">
                              <div className={tone}>
                                {step.complete ? 'OK' : hasFailure && step.key === 'processing' ? '!' : step.active ? '...' : step.label[0]}
                              </div>
                              {!isLast && <div className="h-6 w-px bg-slate-200" />}
                            </div>
                            <div className="flex-1 rounded-2xl border border-slate-200/80 bg-white px-3 py-2">
                              <p className="text-sm font-semibold text-slate-900">{step.label}</p>
                              <p className="text-xs text-slate-600">{step.description}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Open Review Link */}
                  <div>
                    <Link href={`/reviews/${jobId}`}>
                      <Button
                        variant={status === 'DONE' ? 'default' : 'secondary'}
                        size={status === 'DONE' ? 'md' : 'sm'}
                        className="w-full"
                      >
                        {status === 'DONE' ? 'Open Review' : 'Open Review'}
                      </Button>
                    </Link>
                  </div>

                  {/* Error Alert */}
                  {error && (
                    <Alert variant="destructive">
                      <AlertTitle>Error</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  {/* Start New Grading Button */}
                  <Button
                    variant="outline"
                    onClick={() => {
                      setJobId(null);
                      setStatus(null);
                      setResult(null);
                      setRubricEvaluation(null);
                      setError(null);
                      setExamId('');
                      setQuestionId('');
                      setQuestionFile(null);
                      setSubmissionFile(null);
                      setSubmissionMode(DEFAULT_SUBMISSION_MODE);
                      setGradingMode(DEFAULT_GRADING_MODE);
                      setGradingScope(DEFAULT_GRADING_SCOPE);
                      setNotes('');
                      setShowAdvanced(false);
                    }}
                    className="w-full"
                  >
                    Check Another Exam
                  </Button>
                </CardContent>
              </Card>

              {/* Results Card - Rubric Evaluation */}
              {status === 'DONE' && rubricEvaluation && (
                <Card className="rounded-3xl border-slate-200/80 bg-white/90 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle>Rubric Evaluation</CardTitle>
                    <p className="text-2xl font-bold mt-2 text-slate-900">
                      Section score: {rubricEvaluation.sectionScore} / {rubricEvaluation.sectionMaxPoints}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Criterion</TableHead>
                          <TableHead className="text-center">Kind</TableHead>
                          <TableHead className="text-center">Max Points</TableHead>
                          <TableHead className="text-center">Score</TableHead>
                          <TableHead>Feedback</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rubricEvaluation.criteria.map((criterion) => (
                          <RubricCriterionRow key={criterion.criterionId} criterion={criterion} />
                        ))}
                      </TableBody>
                    </Table>

                    {rubricEvaluation.overallFeedback && (
                      <div className="mt-6 p-4 bg-blue-50/80 rounded-lg border border-blue-200">
                        <strong className="text-blue-900">Overall Feedback:</strong>
                        <p className="mt-2 text-blue-800">{rubricEvaluation.overallFeedback}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Results Card - Legacy Format */}
              {status === 'DONE' && result && !rubricEvaluation && (
                <Card className="rounded-3xl border-slate-200/80 bg-white/90 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle>Grading Results</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p>
                      <strong>Score:</strong> {result.score_total != null ? `${result.score_total}/100` : 'N/A'}
                    </p>
                    <p>
                      <strong>Confidence:</strong> {result.confidence != null ? `${(result.confidence * 100).toFixed(1)}%` : 'N/A'}
                    </p>
                    <p>
                      <strong>Summary:</strong> {result.summary_feedback || 'N/A'}
                    </p>

                    {result.flags && result.flags.length > 0 && (
                      <div className="mt-4">
                        <strong>Flags:</strong>
                        <ul className="list-disc list-inside mt-1">
                          {result.flags.map((flag, idx) => (
                            <li key={idx}>{flag}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {result.criteria && result.criteria.length > 0 && (
                      <div className="mt-4">
                        <strong>Criteria:</strong>
                        <ul className="list-disc list-inside mt-1 space-y-2">
                          {result.criteria.map((criterion) => (
                            <li key={criterion.id}>
                              <strong>{criterion.title}:</strong> {criterion.score}/{criterion.max_score}
                              <br />
                              <em className="text-sm">{criterion.comment}</em>
                              {criterion.evidence && (
                                <>
                                  <br />
                                  <small className="text-xs text-slate-600">Evidence: {criterion.evidence}</small>
                                </>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
