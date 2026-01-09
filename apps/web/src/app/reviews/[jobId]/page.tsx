'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { getJob } from '../../../lib/jobsClient';
import { getReview, ReviewRecordV1 } from '../../../lib/reviewsClient';
import { RubricEvaluationResult } from '@hg/shared-schemas';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert';
import { cn } from '../../../lib/utils';

export default function ReviewPage({ params }: { params: Promise<{ jobId: string }> }) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [resultJson, setResultJson] = useState<any>(null);
  const [review, setReview] = useState<ReviewRecordV1 | null>(null);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [hoveredAnnotationId, setHoveredAnnotationId] = useState<string | null>(null);
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

  // Filter annotations for pageIndex === 0 (PNG/JPG) and sort by confidence desc
  const pageAnnotations = useMemo(() => {
    const filtered = review?.annotations.filter((ann) => ann.pageIndex === 0) || [];
    // Sort by confidence desc (undefined last)
    return [...filtered].sort((a, b) => {
      if (a.confidence === undefined && b.confidence === undefined) return 0;
      if (a.confidence === undefined) return 1;
      if (b.confidence === undefined) return -1;
      return b.confidence - a.confidence;
    });
  }, [review]);

  // Get selected annotation details
  const selectedAnnotation = pageAnnotations.find((ann) => ann.id === selectedAnnotationId);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <p className="text-gray-600">Loading...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Link href="/" className="text-blue-600 hover:text-blue-800 font-medium">
            ← Back to Home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Review: {jobId}</h1>
          <div className="mb-4">
            <Link href="/" className="text-blue-600 hover:text-blue-800 font-medium">
              ← Back to Home
            </Link>
          </div>
          {jobStatus !== 'DONE' && (
            <Alert variant="default" className="mb-4 border-yellow-300 bg-yellow-50">
              <AlertTitle>Note</AlertTitle>
              <AlertDescription>
                Job status is {jobStatus}. Annotations may not be available yet.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Image with overlay */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Submission Image</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative inline-block w-full max-w-full">
                  <img
                    src={`/api/jobs/${jobId}/submission`}
                    alt="Student submission"
                    className="w-full h-auto block border border-gray-200 rounded-lg"
                  />
                  {/* Overlay bounding boxes */}
                  {pageAnnotations.map((ann) => {
                    const bbox = ann.bboxNorm;
                    const isSelected = selectedAnnotationId === ann.id;
                    const isHovered = hoveredAnnotationId === ann.id;
                    
                    return (
                      <div
                        key={ann.id}
                        onClick={() => setSelectedAnnotationId(ann.id)}
                        onMouseEnter={() => setHoveredAnnotationId(ann.id)}
                        onMouseLeave={() => setHoveredAnnotationId(null)}
                        className={cn(
                          'absolute cursor-pointer rounded transition-all',
                          'box-border',
                          // Default state
                          !isSelected && !isHovered && 'border border-blue-400 bg-blue-400/10',
                          // Hover state (not selected)
                          !isSelected && isHovered && 'border-2 border-blue-600 bg-blue-400/20',
                          // Selected state
                          isSelected && 'border-[3px] border-red-600 bg-red-400/20 shadow-lg shadow-red-500/30'
                        )}
                        style={{
                          left: `${bbox.x * 100}%`,
                          top: `${bbox.y * 100}%`,
                          width: `${bbox.w * 100}%`,
                          height: `${bbox.h * 100}%`,
                        }}
                        title={ann.label || getCriterionLabel(ann.criterionId)}
                      />
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Side panel */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Annotations</CardTitle>
              </CardHeader>
              <CardContent>
                {pageAnnotations.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-gray-400 mb-2">
                      <svg
                        className="mx-auto h-12 w-12"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>
                    <p className="text-gray-600 font-medium">No annotations were generated for this job.</p>
                    <p className="text-sm text-gray-500 mt-2">
                      The AI did not identify any mistakes in this submission.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pageAnnotations.map((ann) => {
                      const isSelected = selectedAnnotationId === ann.id;
                      const isHovered = hoveredAnnotationId === ann.id;
                      
                      return (
                        <div
                          key={ann.id}
                          onClick={() => setSelectedAnnotationId(ann.id)}
                          onMouseEnter={() => setHoveredAnnotationId(ann.id)}
                          onMouseLeave={() => setHoveredAnnotationId(null)}
                          className={cn(
                            'p-3 rounded-lg border cursor-pointer transition-all',
                            // Default state
                            !isSelected && !isHovered && 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50',
                            // Hover state (not selected)
                            !isSelected && isHovered && 'border-blue-400 bg-blue-50',
                            // Selected state
                            isSelected && 'border-red-500 bg-red-50 shadow-sm'
                          )}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="font-semibold text-sm flex-1">
                              {ann.label || getCriterionLabel(ann.criterionId)}
                            </div>
                            {ann.confidence !== undefined && (
                              <Badge variant="secondary" className="text-xs shrink-0">
                                {(ann.confidence * 100).toFixed(0)}%
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge
                              variant={ann.status === 'confirmed' ? 'default' : ann.status === 'rejected' ? 'destructive' : 'outline'}
                              className="text-xs"
                            >
                              {ann.status}
                            </Badge>
                            <span className="text-xs text-gray-500">{ann.criterionId}</span>
                          </div>
                          {isSelected && ann.comment && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <div className="text-xs font-medium text-gray-700 mb-1">Comment:</div>
                              <div className="text-sm text-gray-600">{ann.comment}</div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
