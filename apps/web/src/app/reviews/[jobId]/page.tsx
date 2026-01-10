'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { getJob } from '../../../lib/jobsClient';
import { getReview, ReviewRecordV1 } from '../../../lib/reviewsClient';
import { RubricEvaluationResult, Annotation, GeneralEvaluation, QuestionMapping, QuestionEvaluation } from '@hg/shared-schemas';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert';
import { cn } from '../../../lib/utils';
import { PDFViewer } from '../../../components/review/pdf/PDFViewer';

export default function ReviewPage({ params }: { params: Promise<{ jobId: string }> }) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [resultJson, setResultJson] = useState<any>(null);
  const [submissionMimeType, setSubmissionMimeType] = useState<string | undefined>(undefined);
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
      setSubmissionMimeType(jobResult.submissionMimeType);

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

  // Get evaluation based on mode
  const resultMode = resultJson?.mode;
  const rubricEvaluation: RubricEvaluationResult | null =
    resultMode !== 'GENERAL' ? (resultJson?.rubricEvaluation || null) : null;
  const generalEvaluation: GeneralEvaluation | null =
    resultMode === 'GENERAL' ? (resultJson?.generalEvaluation || null) : null;
  const generalQuestionMap: QuestionMapping | null =
    resultMode === 'GENERAL' ? (resultJson?.generalQuestionMap || null) : null;
  const generalQuestionMapError: string | null =
    resultMode === 'GENERAL' ? (resultJson?.generalQuestionMapError || null) : null;

  // Normalize GeneralEvaluation to per-question format (backward compatibility)
  const questionEvaluations: QuestionEvaluation[] = useMemo(() => {
    if (!generalEvaluation) return [];
    // New format: has questions array
    if ('questions' in generalEvaluation && Array.isArray(generalEvaluation.questions)) {
      return generalEvaluation.questions;
    }
    // Legacy format: top-level findings - normalize to single question
    if ('findings' in generalEvaluation && Array.isArray(generalEvaluation.findings)) {
      const scope = generalEvaluation.scope;
      const questionId = scope.type === 'QUESTION' ? scope.questionId : 'DOCUMENT';
      return [
        {
          questionId,
          findings: generalEvaluation.findings,
          overallSummary: generalEvaluation.overallSummary,
        },
      ];
    }
    return [];
  }, [generalEvaluation]);

  // Get criterion label by ID (for Rubric mode)
  const getCriterionLabel = (criterionId: string): string => {
    if (!rubricEvaluation) return criterionId;
    const criterion = rubricEvaluation.criteria.find((c) => c.criterionId === criterionId);
    return criterion?.label || criterionId;
  };

  // Get severity badge variant
  const getSeverityVariant = (severity: 'critical' | 'major' | 'minor'): 'default' | 'secondary' | 'destructive' => {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'major':
        return 'default';
      case 'minor':
        return 'secondary';
    }
  };

  // Get all annotations, sorted by confidence desc (undefined last)
  // For images, filter to pageIndex === 0; for PDFs, include all pageIndex values
  const allAnnotations = useMemo(() => {
    if (!review) return [];
    const filtered = submissionMimeType === 'application/pdf' 
      ? review.annotations 
      : review.annotations.filter((ann) => ann.pageIndex === 0);
    // Sort by confidence desc (undefined last)
    return [...filtered].sort((a, b) => {
      if (a.confidence === undefined && b.confidence === undefined) return 0;
      if (a.confidence === undefined) return 1;
      if (b.confidence === undefined) return -1;
      return b.confidence - a.confidence;
    });
  }, [review, submissionMimeType]);

  // For image review, use pageAnnotations (pageIndex === 0)
  const pageAnnotations = useMemo(() => {
    if (submissionMimeType === 'application/pdf') {
      return allAnnotations;
    }
    return allAnnotations.filter((ann) => ann.pageIndex === 0);
  }, [allAnnotations, submissionMimeType]);

  // Get selected annotation details
  const selectedAnnotation = pageAnnotations.find((ann) => ann.id === selectedAnnotationId);

  // For General mode: map findings to annotations
  const findingsToAnnotations = useMemo(() => {
    if (resultMode !== 'GENERAL' || !review || questionEvaluations.length === 0) {
      return new Map<string, Annotation[]>();
    }
    const map = new Map<string, Annotation[]>();
    questionEvaluations.forEach((qEval) => {
      qEval.findings.forEach((finding) => {
        const matchingAnnotations = review.annotations.filter(
          (ann) => ann.criterionId === finding.findingId
        );
        if (matchingAnnotations.length > 0) {
          map.set(finding.findingId, matchingAnnotations);
        }
      });
    });
    return map;
  }, [resultMode, review, questionEvaluations]);

  // Handle finding click: select first matching annotation
  const handleFindingClick = (findingId: string) => {
    const matchingAnnotations = findingsToAnnotations.get(findingId);
    if (matchingAnnotations && matchingAnnotations.length > 0) {
      // Select the first annotation (sorted by confidence desc)
      const sorted = [...matchingAnnotations].sort((a, b) => {
        if (a.confidence === undefined && b.confidence === undefined) return 0;
        if (a.confidence === undefined) return 1;
        if (b.confidence === undefined) return -1;
        return b.confidence - a.confidence;
      });
      setSelectedAnnotationId(sorted[0].id);
    }
  };

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
                <CardTitle>Submission {submissionMimeType === 'application/pdf' ? 'PDF' : 'Image'}</CardTitle>
              </CardHeader>
              <CardContent>
                {submissionMimeType === 'application/pdf' ? (
                  <div className="space-y-4">
                    <PDFViewer
                      pdfUrl={`/api/jobs/${jobId}/submission-raw`}
                      annotations={allAnnotations}
                      selectedAnnotationId={selectedAnnotationId}
                      hoveredAnnotationId={hoveredAnnotationId}
                      onAnnotationClick={setSelectedAnnotationId}
                      onAnnotationHover={setHoveredAnnotationId}
                      getCriterionLabel={getCriterionLabel}
                    />
                  </div>
                ) : (
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
                )}
              </CardContent>
            </Card>
          </div>

          {/* Side panel */}
          <div>
            {resultMode === 'GENERAL' ? (
              <Card>
                <CardHeader>
                  <CardTitle>Findings</CardTitle>
                </CardHeader>
                <CardContent>
                  {questionEvaluations.length > 0 ? (
                    <div className="space-y-4">
                      {/* Overall summary */}
                      {generalEvaluation && 'overallSummary' in generalEvaluation && generalEvaluation.overallSummary && (
                        <Alert variant="default" className="mb-4">
                          <AlertTitle>Overall Summary</AlertTitle>
                          <AlertDescription>{generalEvaluation.overallSummary}</AlertDescription>
                        </Alert>
                      )}
                      {/* Note about bbox */}
                      <Alert variant="default" className="mb-4 border-blue-300 bg-blue-50">
                        <AlertTitle>Note</AlertTitle>
                        <AlertDescription>
                          Evidence boxes (bbox) will be added in the next PR.
                        </AlertDescription>
                      </Alert>
                      {/* Per-question findings */}
                      {questionEvaluations.map((qEval) => {
                        const questionTitle = qEval.displayLabel || `Question ${qEval.questionId}`;
                        return (
                          <div key={qEval.questionId} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="font-semibold text-base">
                                {questionTitle}
                                {qEval.pageIndices && (
                                  <span className="text-sm text-gray-600 ml-2">
                                    (pages: {qEval.pageIndices.join(', ')})
                                  </span>
                                )}
                              </h3>
                              <Badge variant="secondary" className="text-xs">
                                {qEval.findings.length} finding{qEval.findings.length !== 1 ? 's' : ''}
                              </Badge>
                            </div>
                            {qEval.overallSummary && (
                              <div className="mb-3 text-sm text-gray-700 bg-white p-2 rounded border border-gray-200">
                                <strong>Summary:</strong> {qEval.overallSummary}
                              </div>
                            )}
                            <div className="space-y-2">
                              {qEval.findings.map((finding) => {
                                const matchingAnnotations = findingsToAnnotations.get(finding.findingId) || [];
                                const hasBoxes = matchingAnnotations.length > 0;
                                const isSelected = matchingAnnotations.some((ann) => ann.id === selectedAnnotationId);
                                const isStrength = finding.kind === 'strength';
                                
                                return (
                                  <div
                                    key={finding.findingId}
                                    onClick={() => handleFindingClick(finding.findingId)}
                                    className={cn(
                                      'p-3 rounded-lg border bg-white transition-all cursor-pointer',
                                      isSelected
                                        ? 'border-red-500 bg-red-50 shadow-md'
                                        : hasBoxes
                                        ? 'border-blue-300 hover:border-blue-500 hover:shadow-sm'
                                        : 'border-gray-200 hover:border-gray-300'
                                    )}
                                  >
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                      <div className="font-semibold text-sm flex-1">
                                        {finding.findingId}: {finding.title}
                                      </div>
                                      <div className="flex gap-1 shrink-0">
                                        {isStrength ? (
                                          <Badge variant="default" className="text-xs bg-green-500">
                                            Strength
                                          </Badge>
                                        ) : (
                                          finding.severity && (
                                            <Badge variant={getSeverityVariant(finding.severity)} className="text-xs">
                                              {finding.severity}
                                            </Badge>
                                          )
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 mt-2 mb-2">
                                      <Badge variant="secondary" className="text-xs">
                                        {(finding.confidence * 100).toFixed(0)}% confidence
                                      </Badge>
                                      {hasBoxes && (
                                        <Badge variant="outline" className="text-xs">
                                          {matchingAnnotations.length} box{matchingAnnotations.length !== 1 ? 'es' : ''}
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="text-sm text-gray-700 mb-2">
                                      {finding.description}
                                    </div>
                                    {finding.suggestion && (
                                      <div className="mt-2 pt-2 border-t border-gray-200">
                                        <div className="text-xs font-medium text-gray-700 mb-1">Suggestion:</div>
                                        <div className="text-sm text-gray-600">{finding.suggestion}</div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
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
                      <p className="text-gray-600 font-medium">No findings were identified.</p>
                      <p className="text-sm text-gray-500 mt-2">
                        {generalEvaluation?.overallSummary || 'The submission appears to be correct.'}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
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
                              {submissionMimeType === 'application/pdf' && (
                                <Badge variant="outline" className="text-xs">
                                  Page {ann.pageIndex + 1}
                                </Badge>
                              )}
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
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
