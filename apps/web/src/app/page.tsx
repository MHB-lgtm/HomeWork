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

    if (!examId.trim() || !questionId.trim()) {
      setError('Please provide examId and questionId');
      setIsSubmitting(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append('examId', examId.trim());
      formData.append('questionId', questionId.trim());
      formData.append('submission', submissionFile);
      formData.append('submissionMode', submissionMode);
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

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h1 className="text-3xl font-bold">Homework Grader MVP</h1>
          <div className="flex gap-4">
            <Link href="/exams" className="text-blue-600 hover:text-blue-800 font-medium">
              Manage Exams →
            </Link>
            <Link href="/rubrics" className="text-blue-600 hover:text-blue-800 font-medium">
              Edit Rubrics →
            </Link>
          </div>
        </div>

        {/* Worker Health Alert */}
        {showWorkerWarning && (
          <Alert variant="default" className="mb-6 border-yellow-300 bg-yellow-50">
            <AlertTitle>⚠️ Worker Status</AlertTitle>
            <AlertDescription>
              Worker is not running (jobs will stay pending).
            </AlertDescription>
          </Alert>
        )}

        {/* Two-panel layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel: Create Grading Job */}
          <Card>
            <CardHeader>
              <CardTitle>Create Grading Job</CardTitle>
            </CardHeader>
            <CardContent>
              {!jobId ? (
                <form onSubmit={handleSubmit} className="space-y-4">
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
                      </label>
                      <Input
                        id="questionId"
                        type="text"
                        value={questionId}
                        onChange={(e) => setQuestionId(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Submission Type: <span className="text-red-600">*</span>
                    </label>
                    <div className="flex gap-2">
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
                    <p className="text-xs text-gray-500">
                      Optional: The exam file will be used as the primary source. This image can help disambiguate if needed.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="notes" className="text-sm font-medium">
                      Notes (optional):
                    </label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={4}
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
                <div className="text-center py-8 text-gray-500">
                  Job created. Check the status panel on the right.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right Panel: Job Status & Results */}
          {jobId && (
            <div className="space-y-6">
              {/* Job Status Card */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Job Status</CardTitle>
                    {status && (
                      <Badge variant={getStatusBadgeVariant(status)}>
                        {status}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600">Job ID:</p>
                    <p className="font-mono text-sm">{jobId}</p>
                  </div>

                  {/* Open Review Link */}
                  <div>
                    <Link href={`/reviews/${jobId}`}>
                      <Button
                        variant={status === 'DONE' ? 'default' : 'secondary'}
                        size={status === 'DONE' ? 'md' : 'sm'}
                        className="w-full"
                      >
                        {status === 'DONE' ? '📋 Open Review' : 'Open Review →'}
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
                <Card>
                  <CardHeader>
                    <CardTitle>Rubric Evaluation</CardTitle>
                    <p className="text-2xl font-bold mt-2">
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
                      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <strong className="text-blue-900">Overall Feedback:</strong>
                        <p className="mt-2 text-blue-800">{rubricEvaluation.overallFeedback}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Results Card - Legacy Format */}
              {status === 'DONE' && result && !rubricEvaluation && (
                <Card>
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
                                  <small className="text-xs text-gray-600">Evidence: {criterion.evidence}</small>
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
