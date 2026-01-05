'use client';

import { useState, useEffect } from 'react';
import { EvaluationResult } from '@hg/shared-schemas';

interface HealthStatus {
  ok: boolean;
  dataDir: string;
  workerAlive: boolean;
  heartbeatAgeMs: number | null;
}

export default function Home() {
  const [questionFile, setQuestionFile] = useState<File | null>(null);
  const [submissionFile, setSubmissionFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [workerAlive, setWorkerAlive] = useState<boolean | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    if (!questionFile || !submissionFile) {
      setError('Please select both question and submission files');
      setIsSubmitting(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append('question', questionFile);
      formData.append('submission', submissionFile);
      if (notes) {
        formData.append('notes', notes);
      }

      const response = await fetch('/api/jobs', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create job');
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
            setResult(data.resultJson as EvaluationResult);
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
      <h1>Homework Grader MVP</h1>

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
          <div>
            <label htmlFor="question" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Question File:
            </label>
            <input
              type="file"
              id="question"
              accept="image/*,.pdf"
              onChange={(e) => setQuestionFile(e.target.files?.[0] || null)}
              required
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </div>

          <div>
            <label htmlFor="submission" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Submission File:
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

          {result && (
            <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
              <h3>Grading Results</h3>
              <p><strong>Score:</strong> {result.score_total}/100</p>
              <p><strong>Confidence:</strong> {(result.confidence * 100).toFixed(1)}%</p>
              <p><strong>Summary:</strong> {result.summary_feedback}</p>

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
              setError(null);
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
