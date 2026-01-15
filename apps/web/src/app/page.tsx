'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
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
  const [examId, setExamId] = useState('exam-001');
  const [questionId, setQuestionId] = useState('q1');
  const [questionFile, setQuestionFile] = useState<File | null>(null);
  const [submissionFile, setSubmissionFile] = useState<File | null>(null);
  const [submissionMode, setSubmissionMode] = useState<'image' | 'pdf'>('image');
  const [gradingMode, setGradingMode] = useState<'RUBRIC' | 'GENERAL'>('RUBRIC');
  const [gradingScope, setGradingScope] = useState<'QUESTION' | 'DOCUMENT'>('QUESTION');
  const [notes, setNotes] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [rubricEvaluation, setRubricEvaluation] = useState<RubricEvaluationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [workerAlive, setWorkerAlive] = useState<boolean | null>(null);
  const [availableExams, setAvailableExams] = useState<ExamSummary[]>([]);
  const [isLoadingExams, setIsLoadingExams] = useState(false);

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
      setError('Please provide examId');
      setIsSubmitting(false);
      return;
    }

    // Question ID required for Rubric mode or General + Question scope
    if (gradingMode === 'RUBRIC' || (gradingMode === 'GENERAL' && gradingScope === 'QUESTION')) {
      if (!questionId.trim()) {
        setError('Please provide questionId');
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
  const examCount = availableExams.length;
  const hasFailure = status === 'FAILED';
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

  return (
    <main className="min-h-screen review-page-bg text-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-12">
        {/* Hero Header */}
        <div className="mb-8 rounded-3xl border border-slate-200/80 bg-white/90 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 md:p-8">
            <div className="space-y-3">
              <p className="text-xs font-semibold tracking-[0.24em] text-slate-500 uppercase">
                Dashboard
              </p>
              <div className="flex items-center flex-wrap gap-3">
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Homework Grader</h1>
                <Badge variant={showWorkerWarning ? 'destructive' : 'secondary'}>
                  {showWorkerWarning ? 'Worker offline' : 'Worker healthy'}
                </Badge>
              </div>
              <p className="text-slate-600 max-w-2xl">
                Create grading jobs, monitor status, and jump into reviews in one place.
              </p>
              {showWorkerWarning && (
                <Alert variant="default" className="max-w-2xl border-amber-200 bg-amber-50/80 text-amber-900">
                  <AlertTitle>Worker is not running</AlertTitle>
                  <AlertDescription>Jobs will stay pending until the worker is up.</AlertDescription>
                </Alert>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/exams">
                <Button variant="outline" size="sm">
                  Manage Exams
                </Button>
              </Link>
              <Link href="/courses">
                <Button variant="outline" size="sm">
                  Manage Courses
                </Button>
              </Link>
              <Link href="/rubrics">
                <Button variant="outline" size="sm">
                  Edit Rubrics
                </Button>
              </Link>
              <Link href="/reviews">
                <Button variant="outline" size="sm">
                  All Reviews
                </Button>
              </Link>
            </div>
          </div>

          <div className="border-t border-slate-200/70 px-6 md:px-8 py-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">System</p>
                  <p className="text-sm font-semibold text-slate-900">Worker</p>
                </div>
                <Badge variant={showWorkerWarning ? 'destructive' : 'default'}>
                  {showWorkerWarning ? 'Offline' : 'Ready'}
                </Badge>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Library</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {examCount > 0 ? `${examCount} exams available` : 'No exams loaded'}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {isLoadingExams ? 'Loading' : 'Sync\u2009ready'}
                </Badge>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Current setup</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {gradingMode === 'RUBRIC' ? 'Rubric' : 'General'} / {gradingScope.toLowerCase()}
                  </p>
                </div>
                <Badge variant="secondary" className="text-xs capitalize">
                  {submissionMode === 'pdf' ? 'PDF' : 'Image'}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Centered single-column layout */}
        <div className="flex flex-col items-center gap-6">
          {/* Left Panel: Create Grading Job */}
          <Card className="w-full max-w-4xl rounded-3xl border-slate-200/80 bg-white/90 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl font-semibold text-slate-900">Create Grading Job</CardTitle>
              <p className="text-sm text-slate-600">Pick an exam, choose how to grade, and upload the submission.</p>
            </CardHeader>
            <CardContent className="space-y-5">
              {!jobId ? (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Exam selection</p>
                        <p className="text-xs text-slate-500">Pick an exam and the question you want graded.</p>
                      </div>
                      <Badge variant="outline" className="text-xs">Required</Badge>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label htmlFor="examId" className="text-sm font-medium">
                          Exam ID:
                        </label>
                        <div className="flex gap-2">
                          {availableExams.length > 0 && (
                            <select
                              onChange={(e) => {
                                if (e.target.value) {
                                  setExamId(e.target.value);
                                }
                              }}
                              value=""
                              className="flex h-10 rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm cursor-pointer"
                            >
                              <option value="">Select exam...</option>
                              {availableExams.map((exam) => (
                                <option key={exam.examId} value={exam.examId}>
                                  {exam.title} ({exam.examId})
                                </option>
                              ))}
                            </select>
                          )}
                          <Input
                            id="examId"
                            type="text"
                            value={examId}
                            onChange={(e) => setExamId(e.target.value)}
                            required
                            placeholder={isLoadingExams ? 'Loading exams...' : 'Enter exam ID'}
                            className="flex-1"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="questionId" className="text-sm font-medium">
                          Question ID:
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
                          placeholder={gradingMode === 'GENERAL' && gradingScope === 'DOCUMENT' ? 'Optional for Document scope' : ''}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200/80 bg-white p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">Grading options</p>
                      <Badge variant="secondary" className="text-xs capitalize">{gradingMode.toLowerCase()}</Badge>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Grading Mode: <span className="text-red-600">*</span>
                      </label>
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

                    {gradingMode === 'GENERAL' && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          Scope: <span className="text-red-600">*</span>
                        </label>
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
                        <p className="text-xs text-slate-500">
                          Document scope lets you grade an entire submission without specifying a question.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-200/80 bg-white p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">Upload</p>
                      <Badge variant="outline" className="text-xs capitalize">{submissionMode}</Badge>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Submission Type: <span className="text-red-600">*</span>
                      </label>
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
                          Upload Image (existing)
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
                          Upload Sheet (PDF)
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="submission" className="text-sm font-medium">
                        Submission File: <span className="text-red-600">*</span>
                      </label>
                      <Input
                        type="file"
                        id="submission"
                        accept={submissionMode === 'pdf' ? '.pdf,application/pdf' : 'image/*'}
                        onChange={(e) => setSubmissionFile(e.target.files?.[0] || null)}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="question" className="text-sm font-medium">
                        Optional Question Image (fallback):
                      </label>
                      <Input
                        type="file"
                        id="question"
                        accept="image/*,.pdf"
                        onChange={(e) => setQuestionFile(e.target.files?.[0] || null)}
                      />
                      <p className="text-xs text-slate-500">
                        The exam file is the primary source. Add this only if the question image helps clarify.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200/80 bg-white p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">Notes</p>
                      <Badge variant="outline" className="text-xs">Optional</Badge>
                    </div>
                    <label htmlFor="notes" className="text-sm font-medium text-slate-700">
                      Additional context for the grader
                    </label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      placeholder="Share anything the reviewer should know (language, formatting, edge cases)."
                    />
                  </div>

                  {error && !jobId && (
                    <Alert variant="destructive">
                      <AlertTitle>Error</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <Button type="submit" disabled={isSubmitting} className="w-full">
                    {isSubmitting ? 'Submitting...' : 'Submit for Grading'}
                  </Button>
                </form>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  Job created. Check the status panel below.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Guidance + Snapshot stacked under the form */}
          <div className="w-full max-w-4xl space-y-6">
            <Card className="rounded-3xl border-slate-200/80 bg-white/90 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold text-slate-900">How grading works</CardTitle>
                <p className="text-sm text-slate-600">Quick refresher before starting a new job.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 h-8 w-8 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center font-semibold">1</div>
                  <div>
                    <p className="font-semibold text-slate-900">Set exam and question</p>
                    <p className="text-sm text-slate-600">Use the selector or type the exam and question IDs you want to grade.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 h-8 w-8 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center font-semibold">2</div>
                  <div>
                    <p className="font-semibold text-slate-900">Choose grading style</p>
                    <p className="text-sm text-slate-600">Rubric uses structured criteria. General lets you grade a question or the whole document.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 h-8 w-8 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center font-semibold">3</div>
                  <div>
                    <p className="font-semibold text-slate-900">Upload and submit</p>
                    <p className="text-sm text-slate-600">Drop a PDF or images. You can add notes for context; results will open in Reviews.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-slate-200/80 bg-white/90 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold text-slate-900">System snapshot</CardTitle>
                  <Badge variant={showWorkerWarning ? 'destructive' : 'secondary'}>
                    {showWorkerWarning ? 'Worker offline' : 'Worker healthy'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">Exams</p>
                  <p className="text-sm text-slate-600">
                    {examCount > 0 ? `${examCount} exams detected` : 'No exams detected yet'}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">Default submission</p>
                  <p className="text-sm text-slate-600 capitalize">{submissionMode}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href="/exams">
                    <Button variant="outline" size="sm">Go to Exams</Button>
                  </Link>
                  <Link href="/rubrics">
                    <Button variant="outline" size="sm">Go to Rubrics</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Job Status & Results stacked below */}
          {jobId && (
            <div className="w-full max-w-4xl space-y-6">
              {/* Job Status Card */}
              <Card className="rounded-3xl border-slate-200/80 bg-white/90 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold text-slate-900">Job Status</CardTitle>
                    {status && (
                      <Badge variant={getStatusBadgeVariant(status)}>
                        {status}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-slate-600">Job ID:</p>
                    <p className="font-mono text-sm">{jobId}</p>
                  </div>

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
                      setExamId('exam-001');
                      setQuestionId('q1');
                      setQuestionFile(null);
                      setSubmissionFile(null);
                      setSubmissionMode('image');
                      setNotes('');
                    }}
                    className="w-full"
                  >
                    Start New Grading
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
