'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { EvaluationResult, RubricEvaluationResult } from '@hg/shared-schemas';
import { RubricCriterionRow } from '../components/RubricCriterionRow';
import { listExams, ExamSummary } from '../lib/examsClient';

interface HealthStatus {
  ok: boolean;
  dataDir: string;
  workerAlive: boolean;
  heartbeatAgeMs: number | null;
}

export default function Home() {
  const [examId, setExamId] = useState('exam-001');
  const [questionId, setQuestionId] = useState('q1');
  const [questionFile, setQuestionFile] = useState<File | null>(null);
  const [submissionFile, setSubmissionFile] = useState<File | null>(null);
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
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>Homework Grader MVP</h1>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <Link href="/exams" style={{ color: '#0070f3', textDecoration: 'none' }}>
            Manage Exams →
          </Link>
          <Link href="/rubrics" style={{ color: '#0070f3', textDecoration: 'none' }}>
            Edit Rubrics →
          </Link>
        </div>
      </div>

      {showWorkerWarning && (
        <div
          style={{
            marginTop: '1rem',
            padding: '1rem',
            backgroundColor: '#fff3cd',
            border: '2px solid #ffc107',
            borderRadius: '4px',
            color: '#856404',
            fontWeight: 'bold',
          }}
        >
          ⚠️ Worker is not running (jobs will stay pending).
        </div>
      )}

      {!jobId ? (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '2rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label htmlFor="examId" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Exam ID:
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {availableExams.length > 0 && (
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        setExamId(e.target.value);
                      }
                    }}
                    value=""
                    style={{
                      padding: '0.5rem',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      backgroundColor: '#f8f9fa',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="">Select exam...</option>
                    {availableExams.map((exam) => (
                      <option key={exam.examId} value={exam.examId}>
                        {exam.title} ({exam.examId})
                      </option>
                    ))}
                  </select>
                )}
                <input
                  id="examId"
                  type="text"
                  value={examId}
                  onChange={(e) => setExamId(e.target.value)}
                  required
                  placeholder={isLoadingExams ? 'Loading exams...' : 'Enter exam ID'}
                  style={{ flex: 1, padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
                />
              </div>
            </div>

            <div>
              <label htmlFor="questionId" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Question ID:
              </label>
              <input
                id="questionId"
                type="text"
                value={questionId}
                onChange={(e) => setQuestionId(e.target.value)}
                required
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
              />
            </div>
          </div>

          <div>
            <label htmlFor="submission" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Submission File: *
            </label>
            <input
              type="file"
              id="submission"
              accept="image/*,.pdf"
              onChange={(e) => setSubmissionFile(e.target.files?.[0] || null)}
              required
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </div>

          <div>
            <label htmlFor="question" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Optional Question Image (fallback):
            </label>
            <input
              type="file"
              id="question"
              accept="image/*,.pdf"
              onChange={(e) => setQuestionFile(e.target.files?.[0] || null)}
              style={{ width: '100%', padding: '0.5rem' }}
            />
            <small style={{ color: '#666', fontSize: '0.9em' }}>
              Optional: The exam file will be used as the primary source. This image can help disambiguate if needed.
            </small>
          </div>

          <div>
            <label htmlFor="notes" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Notes (optional):
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              style={{ width: '100%', padding: '0.5rem', fontFamily: 'inherit' }}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: isSubmitting ? '#ccc' : '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
            }}
          >
            {isSubmitting ? 'Submitting...' : 'Submit for Grading'}
          </button>
        </form>
      ) : (
        <div style={{ marginTop: '2rem' }}>
          <h2>Job Status</h2>
          <p><strong>Job ID:</strong> {jobId}</p>
          <p><strong>Status:</strong> {status}</p>

          {error && (
            <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#fee', border: '1px solid #fcc', borderRadius: '4px' }}>
              <strong>Error:</strong> {error}
            </div>
          )}

          {status === 'DONE' && rubricEvaluation && (
            <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
              <h3>Rubric Evaluation</h3>
              <p style={{ fontSize: '1.2em', fontWeight: 'bold', marginBottom: '1rem' }}>
                Section score: {rubricEvaluation.sectionScore} / {rubricEvaluation.sectionMaxPoints}
              </p>

              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#ddd', borderBottom: '2px solid #999' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ccc' }}>Label</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #ccc' }}>Kind</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #ccc' }}>Max Points</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #ccc' }}>Score</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ccc' }}>Feedback</th>
                  </tr>
                </thead>
                <tbody>
                  {rubricEvaluation.criteria.map((criterion) => (
                    <RubricCriterionRow key={criterion.criterionId} criterion={criterion} />
                  ))}
                </tbody>
              </table>

              {rubricEvaluation.overallFeedback && (
                <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: '#e8f4f8', borderRadius: '4px' }}>
                  <strong>Overall Feedback:</strong>
                  <p style={{ marginTop: '0.5rem', marginBottom: 0 }}>{rubricEvaluation.overallFeedback}</p>
                </div>
              )}
            </div>
          )}

          {status === 'DONE' && result && !rubricEvaluation && (
            <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
              <h3>Grading Results</h3>
              <p><strong>Score:</strong> {result.score_total != null ? `${result.score_total}/100` : 'N/A'}</p>
              <p><strong>Confidence:</strong> {result.confidence != null ? `${(result.confidence * 100).toFixed(1)}%` : 'N/A'}</p>
              <p><strong>Summary:</strong> {result.summary_feedback || 'N/A'}</p>

              {result.flags && result.flags.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <strong>Flags:</strong>
                  <ul>
                    {result.flags.map((flag, idx) => (
                      <li key={idx}>{flag}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.criteria && result.criteria.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <strong>Criteria:</strong>
                  <ul>
                    {result.criteria.map((criterion) => (
                      <li key={criterion.id}>
                        <strong>{criterion.title}:</strong> {criterion.score}/{criterion.max_score}
                        <br />
                        <em>{criterion.comment}</em>
                        {criterion.evidence && (
                          <>
                            <br />
                            <small>Evidence: {criterion.evidence}</small>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <button
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
              setNotes('');
            }}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              backgroundColor: '#666',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Start New Grading
          </button>
        </div>
      )}
    </main>
  );
}
