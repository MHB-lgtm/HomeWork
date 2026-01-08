'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getJob } from '../../../lib/jobsClient';
import { getReview, ReviewRecordV1 } from '../../../lib/reviewsClient';
import { RubricEvaluationResult } from '@hg/shared-schemas';

export default function ReviewPage({ params }: { params: Promise<{ jobId: string }> }) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [resultJson, setResultJson] = useState<any>(null);
  const [review, setReview] = useState<ReviewRecordV1 | null>(null);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      const resolvedParams = await params;
      const id = resolvedParams.jobId;
      setJobId(id);

      // Fetch job and review in parallel
      const [jobResult, reviewResult] = await Promise.all([
        getJob(id),
        getReview(id),
      ]);

      if (!jobResult.ok) {
        setError(`Failed to load job: ${jobResult.error}`);
        setLoading(false);
        return;
      }

      setJobStatus(jobResult.status);
      setResultJson(jobResult.resultJson);

      if (reviewResult.ok) {
        setReview(reviewResult.review);
      } else {
        // Review not found is OK - just means no annotations yet
        if (reviewResult.status !== 404) {
          setError(`Failed to load review: ${reviewResult.error}`);
        }
      }

      setLoading(false);
    }

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Get rubric evaluation if available
  const rubricEvaluation: RubricEvaluationResult | null =
    resultJson?.rubricEvaluation || null;

  // Get criterion label by ID
  const getCriterionLabel = (criterionId: string): string => {
    if (!rubricEvaluation) return criterionId;
    const criterion = rubricEvaluation.criteria.find((c) => c.criterionId === criterionId);
    return criterion?.label || criterionId;
  };

  // Filter annotations for pageIndex === 0 (PNG/JPG)
  const pageAnnotations = review?.annotations.filter((ann) => ann.pageIndex === 0) || [];

  if (loading) {
    return (
      <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        <p>Loading...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ padding: '1rem', backgroundColor: '#fee', borderRadius: '4px', marginBottom: '1rem' }}>
          <strong>Error:</strong> {error}
        </div>
        <Link href="/" style={{ color: '#0066cc' }}>
          ← Back to Home
        </Link>
      </main>
    );
  }

  return (
    <main style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1>Review: {jobId}</h1>
        <div style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>
          <Link href="/" style={{ color: '#0066cc', textDecoration: 'none' }}>
            ← Back to Home
          </Link>
        </div>
        {jobStatus !== 'DONE' && (
          <div style={{ padding: '0.75rem', backgroundColor: '#fff3cd', borderRadius: '4px', marginBottom: '1rem' }}>
            <strong>Note:</strong> Job status is {jobStatus}. Annotations may not be available yet.
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        {/* Image with overlay */}
        <div style={{ flex: '1', minWidth: '400px' }}>
          <h2 style={{ marginBottom: '1rem' }}>Submission Image</h2>
          <div
            style={{
              position: 'relative',
              display: 'inline-block',
              width: '100%',
              maxWidth: '100%',
            }}
          >
            <img
              src={`/api/jobs/${jobId}/submission`}
              alt="Student submission"
              style={{
                width: '100%',
                height: 'auto',
                display: 'block',
                border: '1px solid #ddd',
                borderRadius: '4px',
              }}
            />
            {/* Overlay bounding boxes */}
            {pageAnnotations.map((ann) => {
              const bbox = ann.bboxNorm;
              const isSelected = selectedAnnotationId === ann.id;
              return (
                <div
                  key={ann.id}
                  onClick={() => setSelectedAnnotationId(ann.id)}
                  style={{
                    position: 'absolute',
                    left: `${bbox.x * 100}%`,
                    top: `${bbox.y * 100}%`,
                    width: `${bbox.w * 100}%`,
                    height: `${bbox.h * 100}%`,
                    border: isSelected ? '3px solid #ff0000' : '2px solid #0066cc',
                    backgroundColor: isSelected ? 'rgba(255, 0, 0, 0.2)' : 'rgba(0, 102, 204, 0.1)',
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                  }}
                  title={ann.label || ann.criterionId}
                />
              );
            })}
          </div>
        </div>

        {/* Side panel */}
        <div style={{ flex: '0 0 300px' }}>
          <h2 style={{ marginBottom: '1rem' }}>Annotations</h2>
          {pageAnnotations.length === 0 ? (
            <p style={{ color: '#666' }}>No annotations available for this submission.</p>
          ) : (
            <div>
              {pageAnnotations.map((ann) => {
                const isSelected = selectedAnnotationId === ann.id;
                return (
                  <div
                    key={ann.id}
                    onClick={() => setSelectedAnnotationId(ann.id)}
                    style={{
                      padding: '0.75rem',
                      marginBottom: '0.5rem',
                      border: isSelected ? '2px solid #ff0000' : '1px solid #ddd',
                      borderRadius: '4px',
                      backgroundColor: isSelected ? '#fff3f3' : '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
                      {ann.label || getCriterionLabel(ann.criterionId)}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.25rem' }}>
                      Criterion: {ann.criterionId}
                    </div>
                    {ann.confidence !== undefined && (
                      <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.25rem' }}>
                        Confidence: {(ann.confidence * 100).toFixed(1)}%
                      </div>
                    )}
                    {isSelected && ann.comment && (
                      <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #eee' }}>
                        <strong>Comment:</strong>
                        <div style={{ marginTop: '0.25rem' }}>{ann.comment}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

