'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
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
  const [activePageIndex, setActivePageIndex] = useState<number | null>(null);
  const [showStrengths, setShowStrengths] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const programmaticScrollRef = useRef<{ lockUntilMs: number; targetPageIndex: number | null }>({
    lockUntilMs: 0,
    targetPageIndex: null,
  });
  const sidebarContainerRef = useRef<HTMLDivElement | null>(null);
  
  const LOCK_MS = 800; // Lock duration in milliseconds
  
  // Helper to check if scroll is locked
  const isLocked = (): boolean => {
    return Date.now() < programmaticScrollRef.current.lockUntilMs;
  };

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

  // Precompute filtered findings per question based on "showStrengths" toggle
  const filteredQuestionEvaluations = useMemo(() => {
    return questionEvaluations.map((qEval) => {
      const visibleFindings = showStrengths
        ? qEval.findings
        : qEval.findings.filter((finding) => finding.kind !== 'strength');
      return { ...qEval, visibleFindings };
    });
  }, [questionEvaluations, showStrengths]);

  const hasVisibleFindings = useMemo(
    () => filteredQuestionEvaluations.some((qEval) => qEval.visibleFindings.length > 0),
    [filteredQuestionEvaluations]
  );

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
      const targetAnnotation = sorted[0];
      setSelectedAnnotationId(targetAnnotation.id);
      
      // Set programmatic scroll lock with target page
      programmaticScrollRef.current = {
        lockUntilMs: Date.now() + LOCK_MS,
        targetPageIndex: targetAnnotation.pageIndex,
      };
    }
  };

  // Handle page change from PDF viewer
  const handlePageChange = (pageIndex: number) => {
    const lock = programmaticScrollRef.current;
    
    // If locked and this is NOT the target page, ignore update (prevents scroll fighting)
    if (isLocked() && lock.targetPageIndex !== null && pageIndex !== lock.targetPageIndex) {
      return;
    }
    
    // If we reached the target page, release lock early
    if (lock.targetPageIndex !== null && pageIndex === lock.targetPageIndex) {
      // Release after a small delay to avoid immediate re-entrancy
      requestAnimationFrame(() => {
        programmaticScrollRef.current.lockUntilMs = 0;
        programmaticScrollRef.current.targetPageIndex = null;
      });
    }
    
    setActivePageIndex(pageIndex);
  };

  // Helper to scroll sidebar to a specific element
  const scrollSidebarToElement = (targetElement: HTMLElement) => {
    if (!targetElement || !sidebarContainerRef.current) {
      return;
    }
    
    const container = sidebarContainerRef.current;
    
    // Calculate scroll position using offsetTop (more reliable than getBoundingClientRect)
    // Find the offset relative to the container
    let offsetTop = 0;
    let current: HTMLElement | null = targetElement;
    while (current && current !== container) {
      offsetTop += current.offsetTop;
      current = current.offsetParent as HTMLElement | null;
    }
    
    const padding = 8; // Small padding from top
    
    container.scrollTo({
      top: offsetTop - padding,
      behavior: 'smooth',
    });
  };

  // Scroll sidebar to active page findings (when scrolling PDF)
  useEffect(() => {
    if (activePageIndex === null || isLocked() || !sidebarContainerRef.current) {
      return;
    }

    // Find the first finding/annotation for this page
    let targetElement: HTMLElement | null = null;

    if (resultMode === 'GENERAL') {
      // For General mode: find first finding that has annotations on this page
      for (const qEval of questionEvaluations) {
        for (const finding of qEval.findings) {
          const matchingAnnotations = findingsToAnnotations.get(finding.findingId) || [];
          const hasAnnotationOnPage = matchingAnnotations.some((ann) => ann.pageIndex === activePageIndex);
          if (hasAnnotationOnPage) {
            targetElement = document.getElementById(`sidebar-finding-${finding.findingId}`);
            if (targetElement) break;
          }
        }
        if (targetElement) break;
      }
    } else {
      // For Rubric mode: find first annotation on this page
      const annotationOnPage = pageAnnotations.find((ann) => ann.pageIndex === activePageIndex);
      if (annotationOnPage) {
        targetElement = document.getElementById(`sidebar-annotation-${annotationOnPage.id}`);
      }
    }

    if (targetElement) {
      scrollSidebarToElement(targetElement);
    }
  }, [activePageIndex, resultMode, questionEvaluations, findingsToAnnotations, pageAnnotations]);

  // Scroll sidebar to selected annotation (when clicking on bbox)
  useEffect(() => {
    if (!selectedAnnotationId || !sidebarContainerRef.current) {
      return;
    }

    // Find the corresponding sidebar element
    let targetElement: HTMLElement | null = null;

    if (resultMode === 'GENERAL') {
      // For General mode: find the finding that contains this annotation
      for (const qEval of questionEvaluations) {
        for (const finding of qEval.findings) {
          const matchingAnnotations = findingsToAnnotations.get(finding.findingId) || [];
          if (matchingAnnotations.some((ann) => ann.id === selectedAnnotationId)) {
            targetElement = document.getElementById(`sidebar-finding-${finding.findingId}`);
            break;
          }
        }
        if (targetElement) break;
      }
    } else {
      // For Rubric mode: use annotation id directly
      targetElement = document.getElementById(`sidebar-annotation-${selectedAnnotationId}`);
    }

    if (targetElement) {
      scrollSidebarToElement(targetElement);
    }
  }, [selectedAnnotationId, resultMode, questionEvaluations, findingsToAnnotations]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <p className="text-slate-600">Loading...</p>
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
    <main className="h-screen review-page-bg flex flex-col overflow-hidden text-slate-900">
      {/* Header - Fixed height */}
      <div className="shrink-0 p-4 md:p-8 border-b border-slate-200/80 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70 shadow-sm">
        <div className="max-w-[1600px] mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="inline-flex items-center text-sm text-slate-600 hover:text-blue-700 transition-colors"
              >
                Back to Home
              </Link>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Review Job: {jobId}</h1>
            </div>
            {jobStatus && (
              <Badge variant={jobStatus === 'completed' ? 'default' : jobStatus === 'failed' ? 'destructive' : 'outline'}>
                {jobStatus}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Main Content - Takes remaining height */}
      <div className="flex-1 overflow-hidden p-4 md:p-8">
        <div className="max-w-[1600px] mx-auto h-full">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
          {/* PDF/Image Area - Left Column with own scrollbar */}
          <div className="lg:col-span-2 h-full flex flex-col overflow-hidden">
            {/* Panel Chrome: PDF Viewer */}
            <div className="h-full flex flex-col rounded-3xl border border-slate-200/80 bg-white/90 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur-sm overflow-hidden">
              {/* Panel Header */}
              <div className="shrink-0 border-b border-blue-100/80 px-4 py-3 bg-gradient-to-r from-blue-50/80 to-indigo-50/60 review-header-padding">
                <h2 className="text-sm font-semibold text-slate-900">
                  Submission {submissionMimeType === 'application/pdf' ? 'PDF' : 'Image'}
                </h2>
              </div>
              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-4 review-scrollbar review-scroll-padding">
                {submissionMimeType === 'application/pdf' ? (
                  <div className="space-y-4">
                    <PDFViewer
                      pdfUrl={`/api/jobs/${jobId}/submission-raw`}
                      annotations={allAnnotations}
                      selectedAnnotationId={selectedAnnotationId}
                      hoveredAnnotationId={hoveredAnnotationId}
                      onAnnotationClick={(annotationId) => {
                        setSelectedAnnotationId(annotationId);
                        // Set programmatic scroll lock to prevent sidebar from jumping during PDF scroll
                        const annotation = allAnnotations.find((ann) => ann.id === annotationId);
                        if (annotation) {
                          programmaticScrollRef.current = {
                            lockUntilMs: Date.now() + LOCK_MS,
                            targetPageIndex: annotation.pageIndex,
                          };
                        }
                      }}
                      onAnnotationHover={setHoveredAnnotationId}
                      getCriterionLabel={getCriterionLabel}
                      onPageChange={submissionMimeType === 'application/pdf' ? handlePageChange : undefined}
                    />
                  </div>
                ) : (
                  <div className="relative inline-block w-full max-w-full">
                    <img
                      src={`/api/jobs/${jobId}/submission`}
                      alt="Student submission"
                      className="w-full h-auto block border border-slate-200 rounded-lg"
                    />
                    {/* Overlay bounding boxes */}
                    {pageAnnotations.map((ann) => {
                      const bbox = ann.bboxNorm;
                      const isSelected = selectedAnnotationId === ann.id;
                      const isHovered = hoveredAnnotationId === ann.id;
                      
                      return (
                        <div
                          key={ann.id}
                          onClick={() => {
                            setSelectedAnnotationId(ann.id);
                            // Set programmatic scroll lock
                            programmaticScrollRef.current = {
                              lockUntilMs: Date.now() + LOCK_MS,
                              targetPageIndex: ann.pageIndex,
                            };
                          }}
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
              </div>
            </div>
          </div>

          {/* Sidebar - Right Column with own scrollbar */}
          <div className="h-full flex flex-col items-start overflow-hidden">
            {resultMode === 'GENERAL' ? (
              <div className="h-[85%] w-full flex flex-col rounded-3xl border border-slate-200/80 bg-white/90 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur-sm overflow-hidden">
                {/* Panel Header */}
                <div className="shrink-0 border-b border-blue-100/80 px-4 py-3 bg-gradient-to-r from-blue-50/80 to-indigo-50/60 review-header-padding">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-sm font-semibold text-slate-900">Findings</h2>
                    <label className="flex items-center gap-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-blue-600"
                        checked={showStrengths}
                        onChange={(e) => setShowStrengths(e.target.checked)}
                      />
                      Show strengths
                    </label>
                  </div>
                </div>
                {/* Scrollable Content */}
                <div
                  ref={(el) => {
                    sidebarContainerRef.current = el;
                  }}
                  className="flex-1 overflow-y-auto p-4 review-scrollbar review-scroll-padding"
                >
                  {hasVisibleFindings ? (
                    <>
                      {/* Overall summary (outside of gap container) */}
                      {generalEvaluation && 'overallSummary' in generalEvaluation && generalEvaluation.overallSummary && (
                        <Alert variant="default" className="mb-6">
                          <AlertTitle className="text-slate-900">Overall Summary</AlertTitle>
                          <AlertDescription className="text-slate-700">{generalEvaluation.overallSummary}</AlertDescription>
                        </Alert>
                      )}
                      
                      {/* Question Groups Container - CRITICAL: flex-col with gap-8 ensures spacing */}
                      <div className="flex flex-col gap-8">
                        {filteredQuestionEvaluations
                          .filter((qEval) => qEval.visibleFindings.length > 0)
                          .map((qEval) => {
                          const questionTitle = qEval.displayLabel || `Question ${qEval.questionId}`;
                          return (
                            <div 
                              key={qEval.questionId} 
                              className="bg-gradient-to-br from-white to-sky-50/40 border border-slate-200/80 rounded-xl p-5 shadow-[0_12px_35px_rgba(15,23,42,0.05)]"
                            >
                            {/* Question Header */}
                            <div className="mb-4 pb-3 border-b border-slate-200/70">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1">
                                  <h3 className="font-bold text-base text-slate-900 mb-1">
                                    {questionTitle}
                                  </h3>
                                  {qEval.pageIndices && (
                                    <p className="text-xs text-slate-500">
                                      Pages: {qEval.pageIndices.join(', ')}
                                    </p>
                                  )}
                                </div>
                                <Badge variant="secondary" className="text-xs shrink-0">
                                  {qEval.findings.length} finding{qEval.findings.length !== 1 ? 's' : ''}
                                </Badge>
                              </div>
                            </div>

                            {/* Question Summary (if exists) */}
                            {qEval.overallSummary && (
                              <div className="mb-4 p-3 bg-blue-50/70 border border-blue-100 rounded-lg">
                                <p className="text-xs font-semibold text-blue-900 mb-1">Summary</p>
                                <p className="text-sm text-slate-700">{qEval.overallSummary}</p>
                              </div>
                            )}

                            {/* Findings List with spacing */}
                            <div className="flex flex-col gap-3">
                              {qEval.visibleFindings.map((finding) => {
                                const matchingAnnotations = findingsToAnnotations.get(finding.findingId) || [];
                                const hasBoxes = matchingAnnotations.length > 0;
                                const isSelected = matchingAnnotations.some((ann) => ann.id === selectedAnnotationId);
                                const isStrength = finding.kind === 'strength';
                                // Check if this finding is on the active page
                                const isOnActivePage = activePageIndex !== null && matchingAnnotations.some((ann) => ann.pageIndex === activePageIndex);
                                
                                return (
                                  <div
                                    key={finding.findingId}
                                    id={`sidebar-finding-${finding.findingId}`}
                                    onClick={() => handleFindingClick(finding.findingId)}
                                    className={cn(
                                      'p-3 rounded-lg border transition-all cursor-pointer shadow-sm',
                                      isSelected
                                        ? 'border-red-500 bg-red-50 shadow-md'
                                        : isOnActivePage
                                        ? 'border-l-4 border-l-blue-500 bg-blue-50/50'
                                        : hasBoxes
                                        ? 'border-slate-300 bg-white/90 hover:bg-blue-50/80 hover:border-blue-400'
                                        : 'border-slate-200 bg-white/70 hover:bg-slate-50/80'
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
                                    <div className="text-sm text-slate-700 mb-2">
                                      {finding.description}
                                    </div>
                                    {finding.suggestion && (
                                      <div className="mt-2 pt-2 border-t border-slate-200">
                                        <div className="text-xs font-medium text-slate-700 mb-1">Suggestion:</div>
                                        <div className="text-sm text-slate-600">{finding.suggestion}</div>
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
                    </>
                  ) : (
                    <div className="text-center py-8 text-slate-700">
                      <div className="text-slate-400 mb-2">
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
                      <p className="text-slate-700 font-medium">No findings were identified.</p>
                      <p className="text-sm text-slate-500 mt-2">
                        {generalEvaluation?.overallSummary || 'The submission appears to be correct.'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-[85%] w-full flex flex-col rounded-3xl border border-slate-200/80 bg-white/90 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur-sm overflow-hidden">
                {/* Panel Header */}
                <div className="shrink-0 border-b border-blue-100/80 px-4 py-3 bg-gradient-to-r from-blue-50/80 to-indigo-50/60 review-header-padding">
                  <h2 className="text-sm font-semibold text-slate-900">Annotations</h2>
                </div>
                {/* Scrollable Content */}
                <div
                  ref={(el) => {
                    sidebarContainerRef.current = el;
                  }}
                  className="flex-1 overflow-y-auto p-4 review-scrollbar review-scroll-padding"
                >
                  {pageAnnotations.length === 0 ? (
                    <div className="text-center py-8 text-slate-700">
                      <div className="text-slate-400 mb-2">
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
                      <p className="text-slate-700 font-medium">No annotations were generated for this job.</p>
                      <p className="text-sm text-slate-500 mt-2">
                        The AI did not identify any mistakes in this submission.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {pageAnnotations.map((ann) => {
                        const isSelected = selectedAnnotationId === ann.id;
                        const isHovered = hoveredAnnotationId === ann.id;
                        const isOnActivePage = activePageIndex !== null && ann.pageIndex === activePageIndex;
                        
                        return (
                          <div
                            key={ann.id}
                            id={`sidebar-annotation-${ann.id}`}
                            onClick={() => {
                              setSelectedAnnotationId(ann.id);
                              // Set programmatic scroll lock with target page
                              programmaticScrollRef.current = {
                                lockUntilMs: Date.now() + LOCK_MS,
                                targetPageIndex: ann.pageIndex,
                              };
                            }}
                            onMouseEnter={() => setHoveredAnnotationId(ann.id)}
                            onMouseLeave={() => setHoveredAnnotationId(null)}
                            className={cn(
                              'p-3 rounded-lg border cursor-pointer transition-all shadow-sm',
                              // Selected state (highest priority)
                              isSelected && 'border-red-500 bg-red-50 shadow-md',
                              // Active page highlight (when not selected)
                              !isSelected && isOnActivePage && 'border-l-4 border-l-blue-500 bg-blue-50/40',
                              // Hover state (not selected, not active page)
                              !isSelected && !isOnActivePage && isHovered && 'border-blue-400 bg-blue-50/80',
                              // Default state
                              !isSelected && !isOnActivePage && !isHovered && 'border-slate-200 bg-white/90 hover:border-blue-300 hover:bg-blue-50/60'
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
                              <span className="text-xs text-slate-500">{ann.criterionId}</span>
                            </div>
                            {isSelected && ann.comment && (
                              <div className="mt-3 pt-3 border-t border-slate-200">
                                <div className="text-xs font-medium text-slate-700 mb-1">Comment:</div>
                                <div className="text-sm text-slate-600">{ann.comment}</div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          </div>
        </div>
      </div>
    </main>
  );
}
