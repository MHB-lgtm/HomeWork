'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { getJob } from '../../../../lib/jobsClient';
import {
  getReview,
  ReviewRecordV1,
  publishReview,
  ReviewPublicationV1,
} from '../../../../lib/reviewsClient';
import {
  RubricEvaluationResult,
  Annotation,
  GeneralEvaluation,
  QuestionMapping,
  QuestionEvaluation,
  StudyPointerV1,
} from '@hg/shared-schemas';
import { Badge } from '../../../../components/ui/badge';
import { Button } from '../../../../components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '../../../../components/ui/alert';
import { StatusBadge } from '../../../../components/ui/status-badge';
import { Input } from '../../../../components/ui/input';
import { Textarea } from '../../../../components/ui/textarea';
import { cn } from '../../../../lib/utils';
import { PDFViewer } from '../../../../components/review/pdf/PDFViewer';
import { StudyPointersPanel } from '../../../../components/review/StudyPointersPanel';
import { ReviewScoreSummary } from '../../../../components/review/ReviewScoreSummary';
import { QuestionReviewCard } from '../../../../components/review/QuestionReviewCard';
import { FlagManager, type ReviewFlag } from '../../../../components/review/FlagManager';
import { AuditTimeline, type AuditEntry } from '../../../../components/review/AuditTimeline';
import { PublishConfirmationModal } from '../../../../components/review/PublishConfirmationModal';
import { saveReview } from '../../../../lib/reviewsClient';
import { ChevronLeft, Check, Eye, Save, Send, Bot, User, Clock, Edit3, Flag, FileText } from 'lucide-react';

const MAX_RIGHT_PANEL_TITLE_CHARS = 90;
const MAX_RIGHT_PANEL_TEXT_CHARS = 180;
const MAX_RIGHT_PANEL_SUGGESTION_CHARS = 140;

function toShortText(value: string, maxChars: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxChars) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxChars - 1)).trimEnd()}...`;
}

export default function ReviewPage({ params }: { params: Promise<{ jobId: string }> }) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [reviewSource, setReviewSource] = useState<'postgres' | null>(null);
  const [publication, setPublication] = useState<ReviewPublicationV1 | null>(null);
  const [resultJson, setResultJson] = useState<any>(null);
  const [submissionMimeType, setSubmissionMimeType] = useState<string | undefined>(undefined);
  const [review, setReview] = useState<ReviewRecordV1 | null>(null);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [hoveredAnnotationId, setHoveredAnnotationId] = useState<string | null>(null);
  const [activePageIndex, setActivePageIndex] = useState<number | null>(null);
  const [showStrengths, setShowStrengths] = useState(true);
  const [copiedTechnicalValue, setCopiedTechnicalValue] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);

  // ── Workspace editing state ──
  const [lecturerScores, setLecturerScores] = useState<Record<string, number>>({});
  const [lecturerFeedbacks, setLecturerFeedbacks] = useState<Record<string, string>>({});
  const [overallFeedback, setOverallFeedback] = useState('');
  const [overallFeedbackInitialized, setOverallFeedbackInitialized] = useState(false);
  const [flags, setFlags] = useState<ReviewFlag[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [activeTab, setActiveTab] = useState<'findings' | 'workspace' | 'audit'>('findings');

  // ── Audit trail ──
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);

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

  const loadReviewData = async (id: string, options?: { keepLoading?: boolean }) => {
    if (options?.keepLoading !== false) {
      setLoading(true);
    }

    const reviewResult = await getReview(id);

    if (!reviewResult.ok) {
      setError(
        reviewResult.status === 404
          ? 'Review not found'
          : `Failed to load review: ${reviewResult.error}`
      );
      if (options?.keepLoading !== false) {
        setLoading(false);
      }
      return false;
    }

    setError(null);
    setReview(reviewResult.review);
    setJobStatus(reviewResult.context?.status ?? null);
    setReviewSource(reviewResult.context?.source ?? null);
    setPublication(reviewResult.context?.publication ?? null);
    setResultJson(reviewResult.context?.resultJson ?? null);
    setSubmissionMimeType(reviewResult.context?.submissionMimeType ?? undefined);

    if (options?.keepLoading !== false) {
      setLoading(false);
    }

    return true;
  };

  useEffect(() => {
    async function loadData() {
      const resolvedParams = await params;
      const id = resolvedParams.jobId;
      setJobId(id);
      await loadReviewData(id);
    }

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Initialize workspace state from loaded data ──
  useEffect(() => {
    if (!resultJson || overallFeedbackInitialized) return;

    const mode = resultJson.mode;

    // Initialize scores and feedback from rubric evaluation
    if (mode === 'RUBRIC' && resultJson.rubricEvaluation) {
      const rubric = resultJson.rubricEvaluation;
      const scores: Record<string, number> = {};
      const feedbacks: Record<string, string> = {};
      rubric.criteria.forEach((c: any) => {
        scores[c.criterionId] = c.score;
        feedbacks[c.criterionId] = c.feedback || '';
      });
      setLecturerScores(scores);
      setLecturerFeedbacks(feedbacks);
      setOverallFeedback(rubric.overallFeedback || '');
    }

    // Initialize from general evaluation
    if (mode === 'GENERAL' && resultJson.generalEvaluation) {
      setOverallFeedback(resultJson.generalEvaluation.overallSummary || '');
    }

    // Build initial audit trail
    const entries: AuditEntry[] = [];
    if (review?.createdAt) {
      entries.push({
        id: 'ai-created',
        timestamp: review.createdAt,
        actor: 'ai',
        action: 'AI generated initial review',
        detail: `${review.annotations.length} annotations created`,
      });
    }
    if (publication?.isPublished && publication.publishedAt) {
      entries.push({
        id: 'published',
        timestamp: publication.publishedAt,
        actor: 'system',
        action: 'Review published',
        detail: publication.score != null ? `Score: ${publication.score}/${publication.maxScore}` : undefined,
      });
    }
    setAuditEntries(entries);
    setOverallFeedbackInitialized(true);
  }, [resultJson, review, publication, overallFeedbackInitialized]);

  // ── Track unsaved changes ──
  const markChanged = () => {
    setHasUnsavedChanges(true);
    setSaveStatus('idle');
  };

  const handleScoreChange = (questionId: string, score: number) => {
    setLecturerScores((prev) => ({ ...prev, [questionId]: score }));
    markChanged();
  };

  const handleFeedbackChange = (questionId: string, feedback: string) => {
    setLecturerFeedbacks((prev) => ({ ...prev, [questionId]: feedback }));
    markChanged();
  };

  const handleOverallFeedbackChange = (feedback: string) => {
    setOverallFeedback(feedback);
    markChanged();
  };

  const handleAddFlag = (flag: Omit<ReviewFlag, 'id'>) => {
    const id = `flag-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setFlags((prev) => [...prev, { ...flag, id }]);
    setAuditEntries((prev) => [{
      id: `audit-flag-${id}`,
      timestamp: new Date().toISOString(),
      actor: 'lecturer',
      action: `Added flag: ${flag.summary}`,
      detail: `Severity: ${flag.severity}`,
    }, ...prev]);
    markChanged();
  };

  const handleRemoveFlag = (flagId: string) => {
    setFlags((prev) => prev.filter((f) => f.id !== flagId));
    markChanged();
  };

  const handleResolveFlag = (flagId: string) => {
    setFlags((prev) => prev.map((f) => f.id === flagId ? { ...f, status: 'resolved' as const } : f));
    markChanged();
  };

  // ── Save draft ──
  const handleSaveDraft = async () => {
    if (!jobId || !review) return;
    setSaveStatus('saving');

    const result = await saveReview(jobId, review);
    if (result.ok) {
      setSaveStatus('saved');
      setHasUnsavedChanges(false);
      setAuditEntries((prev) => [{
        id: `audit-save-${Date.now()}`,
        timestamp: new Date().toISOString(),
        actor: 'lecturer',
        action: 'Saved draft',
      }, ...prev]);
    } else {
      setSaveStatus('error');
    }
  };

  // ── Publish ──
  const handlePublishConfirm = async () => {
    if (!jobId || reviewSource !== 'postgres' || isPublishing) return;
    setIsPublishing(true);
    setPublishError(null);

    const result = await publishReview(jobId);
    if (!result.ok) {
      setPublishError(result.error);
      setIsPublishing(false);
      setShowPublishModal(false);
      return;
    }

    setPublication(result.data);
    setAuditEntries((prev) => [{
      id: `audit-publish-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actor: 'lecturer',
      action: 'Published review',
      detail: result.data.score != null ? `Score: ${result.data.score}/${result.data.maxScore}` : undefined,
    }, ...prev]);
    await loadReviewData(jobId, { keepLoading: false });
    setIsPublishing(false);
    setShowPublishModal(false);
    setHasUnsavedChanges(false);
  };

  // ── Warn before leaving with unsaved changes ──
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);

  // ── Computed workspace values ──
  const isProcessing = jobStatus === 'PENDING' || jobStatus === 'RUNNING';
  const isReadyForReview = jobStatus === 'DONE' && !publication?.isPublished;
  const isPublished = publication?.isPublished === true;
  const canEdit = isReadyForReview;

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

  useEffect(() => {
    if (resultMode !== 'GENERAL' && selectedFindingId) {
      setSelectedFindingId(null);
    }
  }, [resultMode, selectedFindingId]);

  const pointersByTarget = useMemo(() => {
    const raw = resultJson?.studyPointers?.pointersByTarget;
    if (!Array.isArray(raw)) return [];
    return raw.filter((entry) => Array.isArray(entry?.pointers));
  }, [resultJson]);

  const findingQuestionMap = useMemo(() => {
    const map = new Map<string, string>();
    questionEvaluations.forEach((qEval) => {
      qEval.findings.forEach((finding) => {
        if (!map.has(finding.findingId)) {
          map.set(finding.findingId, qEval.questionId);
        }
      });
    });
    return map;
  }, [questionEvaluations]);

  const getPointersForSelection = (args: {
    mode: string | undefined;
    selectedAnnotation?: Annotation;
    selectedFindingId?: string | null;
    pointersByTarget: Array<{
      targetType: 'criterion' | 'finding';
      targetId: string;
      questionId?: string;
      pointers: StudyPointerV1[];
    }>;
    findingQuestionMap: Map<string, string>;
  }): StudyPointerV1[] => {
    const { mode, selectedAnnotation, selectedFindingId: findingIdOverride, pointersByTarget, findingQuestionMap } = args;
    if (!pointersByTarget.length) return [];

    if (mode === 'GENERAL') {
      const findingId = findingIdOverride || selectedAnnotation?.criterionId;
      if (!findingId) return [];
      const questionId = findingQuestionMap.get(findingId);
      const match = pointersByTarget.find(
        (entry) =>
          entry.targetType === 'finding' &&
          entry.targetId === findingId &&
          (entry.questionId == null || entry.questionId === questionId)
      );
      return match?.pointers ?? [];
    }

    const criterionId = selectedAnnotation?.criterionId;
    if (!criterionId) return [];
    const match = pointersByTarget.find(
      (entry) => entry.targetType === 'criterion' && entry.targetId === criterionId
    );
    return match?.pointers ?? [];
  };

  const hasPointersForTarget = (args: {
    targetType: 'criterion' | 'finding';
    targetId: string;
    questionId?: string;
  }): boolean => {
    return pointersByTarget.some(
      (entry) =>
        entry.targetType === args.targetType &&
        entry.targetId === args.targetId &&
        entry.pointers?.length > 0 &&
        (entry.questionId == null || entry.questionId === args.questionId)
    );
  };

  // Get criterion label by ID (for Rubric mode)
  const getCriterionLabel = (criterionId: string): string => {
    if (!rubricEvaluation) return 'Criterion';
    const criterion = rubricEvaluation.criteria.find((c) => c.criterionId === criterionId);
    return criterion?.label || 'Criterion';
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

  const getJobStatusBadgeVariant = (
    status: string
  ): 'default' | 'secondary' | 'outline' | 'destructive' => {
    if (status === 'DONE') return 'default';
    if (status === 'FAILED') return 'destructive';
    if (status === 'PENDING' || status === 'RUNNING') return 'secondary';
    return 'outline';
  };

  const copyTechnicalValue = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedTechnicalValue(value);
      window.setTimeout(() => {
        setCopiedTechnicalValue((prev) => (prev === value ? null : prev));
      }, 1200);
    } catch {
      setCopiedTechnicalValue(null);
    }
  };

  // Compute workspace score totals
  const aiTotalScore = rubricEvaluation
    ? rubricEvaluation.sectionScore
    : (publication?.score ?? null);
  const aiMaxScore = rubricEvaluation
    ? rubricEvaluation.sectionMaxPoints
    : (publication?.maxScore ?? null);
  const lecturerTotalScore = rubricEvaluation
    ? Object.values(lecturerScores).reduce((sum, s) => sum + s, 0)
    : aiTotalScore;
  const editedQuestionCount = rubricEvaluation
    ? rubricEvaluation.criteria.filter((c: any) => lecturerScores[c.criterionId] !== c.score || lecturerFeedbacks[c.criterionId] !== (c.feedback || '')).length
    : 0;
  const openFlagCount = flags.filter((f) => f.status === 'open').length;

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

  const activePointers = useMemo(() => {
    return getPointersForSelection({
      mode: resultMode,
      selectedAnnotation,
      selectedFindingId,
      pointersByTarget,
      findingQuestionMap,
    });
  }, [resultMode, selectedAnnotation, selectedFindingId, pointersByTarget, findingQuestionMap]);

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
    setSelectedFindingId(findingId);
    const matchingAnnotations = findingsToAnnotations.get(findingId);
    if (!matchingAnnotations || matchingAnnotations.length === 0) {
      setSelectedAnnotationId(null);
      return;
    }
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

    // Center the target element in the sidebar viewport and clamp to scroll bounds.
    const targetHeight = targetElement.offsetHeight;
    const containerHeight = container.clientHeight;
    const desiredTop = offsetTop - (containerHeight - targetHeight) / 2;
    const maxScrollTop = Math.max(0, container.scrollHeight - containerHeight);
    const clampedTop = Math.min(Math.max(0, desiredTop), maxScrollTop);

    container.scrollTo({
      top: clampedTop,
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

  const reviewTitle = review?.displayName?.trim() || 'Review details';
  const totalFindings = questionEvaluations.reduce((sum, q) => sum + q.findings.length, 0);
  const strengthCount = questionEvaluations.reduce((sum, q) => sum + q.findings.filter(f => f.kind === 'strength').length, 0);
  const issueCount = totalFindings - strengthCount;

  if (loading) {
    return (
      <div className="-mx-5 -my-12 flex h-[calc(100vh-var(--topbar-height))] flex-col sm:-mx-7 sm:-my-14 lg:-mx-10 lg:-my-16">
        <div className="shrink-0 border-b border-(--border) bg-(--surface) px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="skeleton-line h-9 w-9 rounded-lg" />
            <div className="space-y-2">
              <div className="skeleton-line h-5 w-48" />
              <div className="skeleton-line h-3 w-32" />
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-hidden p-5 md:p-6">
          <div className="grid h-full grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 rounded-lg border border-(--border) bg-(--surface) p-6">
              <div className="skeleton-line h-full w-full rounded-lg" />
            </div>
            <div className="rounded-lg border border-(--border) bg-(--surface) p-4 space-y-4">
              <div className="skeleton-line h-5 w-24" />
              <div className="skeleton-line h-24 w-full rounded-lg" />
              <div className="skeleton-line h-24 w-full rounded-lg" />
              <div className="skeleton-line h-24 w-full rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4 py-8">
        <Alert variant="error">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Link href="/reviews" className="inline-flex items-center gap-1.5 text-sm font-medium text-(--brand) hover:text-(--brand-hover) transition-colors">
          <ChevronLeft size={16} /> Back to Reviews
        </Link>
      </div>
    );
  }

  return (
    <div className="-mx-5 -my-12 flex h-[calc(100vh-var(--topbar-height))] flex-col sm:-mx-7 sm:-my-14 lg:-mx-10 lg:-my-16">
      {/* ─── Sticky Toolbar ─── */}
      <div className="shrink-0 border-b border-(--border) bg-(--surface)/90 backdrop-blur-md">
        <div className="px-5 py-4 md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Left: Back + Title */}
            <div className="flex items-center gap-3 min-w-0">
              <Link
                href="/reviews"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-(--border) text-(--text-tertiary) transition-all duration-200 hover:bg-(--surface-hover) hover:text-(--text-primary) hover:border-(--border-hover)"
              >
                <ChevronLeft size={15} />
              </Link>
              <div className="min-w-0">
                <h1 className="truncate text-base font-bold tracking-tight text-(--text-primary)">{reviewTitle}</h1>
              </div>
            </div>

            {/* Center: Quick stats */}
            <div className="hidden md:flex items-center gap-3">
              {resultMode === 'GENERAL' && totalFindings > 0 && (
                <>
                  <div className="flex items-center gap-1.5 rounded-full bg-(--surface-secondary) px-3 py-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-(--error)" />
                    <span className="text-[11px] font-semibold text-(--text-secondary)">{issueCount} issue{issueCount !== 1 ? 's' : ''}</span>
                  </div>
                  {strengthCount > 0 && (
                    <div className="flex items-center gap-1.5 rounded-full bg-(--success-subtle) px-3 py-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-(--success)" />
                      <span className="text-[11px] font-semibold text-(--success)">{strengthCount} strength{strengthCount !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                </>
              )}
              {pageAnnotations.length > 0 && resultMode !== 'GENERAL' && (
                <div className="flex items-center gap-1.5 rounded-full bg-(--surface-secondary) px-3 py-1">
                  <span className="text-[11px] font-semibold text-(--text-secondary)">{pageAnnotations.length} annotation{pageAnnotations.length !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>

            {/* Right: Status + Actions */}
            <div className="flex flex-wrap items-center gap-2">
              {jobStatus && <StatusBadge status={jobStatus} />}
              {isPublished && (
                <div className="flex items-center gap-1.5 rounded-lg border border-(--success)/20 bg-(--success-subtle) px-3 py-1.5">
                  <Check size={12} className="text-(--success)" />
                  <span className="text-xs font-semibold text-(--success)">
                    Published
                    {publication!.score != null && publication!.maxScore != null && ` ${publication!.score}/${publication!.maxScore}`}
                  </span>
                </div>
              )}
              {hasUnsavedChanges && (
                <span className="text-[10px] font-semibold text-(--warning)">Unsaved</span>
              )}
              {canEdit && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Save size={13} />}
                  onClick={handleSaveDraft}
                  loading={saveStatus === 'saving'}
                  disabled={!hasUnsavedChanges}
                >
                  {saveStatus === 'saved' ? 'Saved' : saveStatus === 'error' ? 'Retry' : 'Save'}
                </Button>
              )}
              {reviewSource === 'postgres' && (
                <Button
                  onClick={() => setShowPublishModal(true)}
                  size="sm"
                  icon={<Send size={13} />}
                  className="shadow-(--shadow-brand)"
                  disabled={isProcessing}
                >
                  {isPublished ? 'Republish' : 'Publish'}
                </Button>
              )}
            </div>
          </div>
        </div>
        {publishError && (
          <div className="border-t border-(--error)/10 bg-(--error-subtle) px-6 py-2">
            <p className="text-xs font-medium text-(--error)">{publishError}</p>
          </div>
        )}
      </div>

      {/* ─── Score Summary ─── */}
      {(rubricEvaluation || publication) && (
        <div className="shrink-0 px-4 pt-4 md:px-6 md:pt-5">
          <ReviewScoreSummary
            aiScore={aiTotalScore}
            lecturerScore={lecturerTotalScore}
            maxScore={aiMaxScore}
            editedQuestionCount={editedQuestionCount}
            totalQuestionCount={rubricEvaluation ? rubricEvaluation.criteria.length : questionEvaluations.length}
            flagCount={openFlagCount}
            isPublished={isPublished}
          />
        </div>
      )}

      {/* ─── Processing Banner ─── */}
      {isProcessing && (
        <div className="mx-4 mt-4 flex shrink-0 items-center gap-3 rounded-lg border border-(--info)/20 bg-(--info-subtle) px-4 py-3 md:mx-6 md:mt-5">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-(--info) border-t-transparent" />
          <div>
            <p className="text-sm font-medium text-(--text-primary)">Review is being processed</p>
            <p className="text-xs text-(--text-tertiary)">AI grading is in progress. The workspace will become editable once complete.</p>
          </div>
        </div>
      )}

      {/* ─── Split Content ─── */}
      <div className="flex-1 overflow-hidden p-4 md:p-6">
        <div className="grid h-full grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
          {/* ─── Left: Submission Viewer ─── */}
          <div className="lg:col-span-2 h-full flex flex-col overflow-hidden rounded-xl border border-(--border) bg-(--surface) shadow-(--shadow-sm)">
            <div className="shrink-0 border-b border-(--border-light) px-4 py-2.5 bg-linear-to-r from-(--surface-secondary)/60 to-(--surface)">
              <div className="flex items-center justify-between">
                <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-(--text-tertiary)">
                  Submission {submissionMimeType === 'application/pdf' ? 'PDF' : 'Image'}
                </h2>
                <Badge variant="outline" size="sm">{submissionMimeType === 'application/pdf' ? 'PDF' : 'IMG'}</Badge>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto bg-(--surface-secondary)/20 p-5">
                {submissionMimeType === 'application/pdf' ? (
                  <div className="space-y-4">
                    <PDFViewer
                      pdfUrl={`/api/reviews/${jobId}/submission-raw`}
                      annotations={allAnnotations}
                      selectedAnnotationId={selectedAnnotationId}
                      hoveredAnnotationId={hoveredAnnotationId}
                      onAnnotationClick={(annotationId) => {
                        setSelectedAnnotationId(annotationId);
                        const annotation = allAnnotations.find((ann) => ann.id === annotationId);
                        if (resultMode === 'GENERAL') {
                          if (annotation) {
                            setSelectedFindingId(annotation.criterionId);
                          }
                        }
                        // Set programmatic scroll lock to prevent sidebar from jumping during PDF scroll
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
                      src={`/api/reviews/${jobId}/submission`}
                      alt="Student submission"
                      className="w-full h-auto block border border-(--border) rounded-lg"
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
                            if (resultMode === 'GENERAL') {
                              setSelectedFindingId(ann.criterionId);
                            }
                            // Set programmatic scroll lock
                            programmaticScrollRef.current = {
                              lockUntilMs: Date.now() + LOCK_MS,
                              targetPageIndex: ann.pageIndex,
                            };
                          }}
                          onMouseEnter={() => setHoveredAnnotationId(ann.id)}
                          onMouseLeave={() => setHoveredAnnotationId(null)}
                          className={cn(
                            'absolute cursor-pointer rounded transition-all duration-200 box-border',
                            !isSelected && !isHovered && 'border border-(--brand)/40 bg-(--brand)/5',
                            !isSelected && isHovered && 'border-2 border-(--brand)/70 bg-(--brand)/12',
                            isSelected && 'border-2 border-(--brand) bg-(--brand)/15 shadow-lg shadow-(--brand)/20 ring-2 ring-(--brand)/10'
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

          {/* ─── Right: Analysis Panel ─── */}
          <div className="h-full flex flex-col overflow-hidden rounded-xl border border-(--border) bg-(--surface) shadow-(--shadow-sm)">
            {/* Tab navigation */}
            <div className="shrink-0 border-b border-(--border-light) bg-linear-to-r from-(--surface-secondary)/40 to-(--surface)">
              <div className="flex">
                {[
                  { key: 'findings' as const, label: resultMode === 'GENERAL' ? 'Findings' : 'Annotations', icon: <FileText size={12} /> },
                  { key: 'workspace' as const, label: 'Workspace', icon: <Edit3 size={12} /> },
                  { key: 'audit' as const, label: 'Audit', icon: <Clock size={12} /> },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-semibold transition-all duration-200 border-b-2',
                      activeTab === tab.key
                        ? 'border-(--brand) text-(--brand)'
                        : 'border-transparent text-(--text-tertiary) hover:text-(--text-secondary)'
                    )}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab content */}
            {activeTab === 'findings' && resultMode === 'GENERAL' ? (
              <>
                <div className="shrink-0 border-b border-(--border-light) px-4 py-2 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-(--text-quaternary)">{totalFindings} findings</span>
                    <button
                      onClick={() => setShowStrengths(!showStrengths)}
                      className={cn(
                        'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold transition-all duration-200',
                        showStrengths
                          ? 'bg-(--success-subtle) text-(--success) border border-(--success)/15'
                          : 'bg-(--surface-secondary) text-(--text-tertiary) border border-(--border-light)'
                      )}
                    >
                      <Eye size={10} />
                      Strengths
                    </button>
                </div>
                <div
                  ref={(el) => { sidebarContainerRef.current = el; }}
                  className="flex-1 overflow-y-auto p-3"
                >
                  {hasVisibleFindings ? (
                    <div className="space-y-4">
                      {/* Overall summary */}
                      {generalEvaluation && 'overallSummary' in generalEvaluation && generalEvaluation.overallSummary && (
                        <div className="rounded-lg bg-linear-to-br from-(--info-subtle) to-white border border-(--info)/10 px-3.5 py-3">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-(--info) mb-1">Summary</p>
                          <p className="text-[13px] leading-relaxed text-(--text-secondary)">{generalEvaluation.overallSummary}</p>
                        </div>
                      )}

                      {/* Question groups */}
                      {filteredQuestionEvaluations
                        .filter((qEval) => qEval.visibleFindings.length > 0)
                        .map((qEval) => {
                        const questionTitle = qEval.displayLabel || `Question ${qEval.questionId}`;
                        return (
                          <div key={qEval.questionId} className="rounded-lg border border-(--border) overflow-hidden">
                            {/* Question header */}
                            <div className="border-b border-(--border-light) bg-(--surface-secondary)/50 px-3.5 py-2.5">
                              <div className="flex items-center justify-between gap-2">
                                <h3 className="text-[13px] font-bold text-(--text-primary)">{questionTitle}</h3>
                                <Badge variant="default" size="sm">{qEval.visibleFindings.length}</Badge>
                              </div>
                              {qEval.overallSummary && (
                                <p className="mt-1 text-[11px] leading-relaxed text-(--text-tertiary)">{toShortText(qEval.overallSummary, 120)}</p>
                              )}
                            </div>

                            {/* Findings */}
                            <div className="p-1.5 space-y-1">
                              {qEval.visibleFindings.map((finding) => {
                                const matchingAnnotations = findingsToAnnotations.get(finding.findingId) || [];
                                const hasBoxes = matchingAnnotations.length > 0;
                                const isSelected = selectedFindingId === finding.findingId || matchingAnnotations.some((ann) => ann.id === selectedAnnotationId);
                                const isStrength = finding.kind === 'strength';
                                const isOnActivePage = activePageIndex !== null && matchingAnnotations.some((ann) => ann.pageIndex === activePageIndex);
                                const hasPointers = hasPointersForTarget({ targetType: 'finding', targetId: finding.findingId, questionId: qEval.questionId });

                                return (
                                  <div
                                    key={finding.findingId}
                                    id={`sidebar-finding-${finding.findingId}`}
                                    onClick={() => handleFindingClick(finding.findingId)}
                                    className={cn(
                                      'group/finding rounded-lg border p-3 cursor-pointer transition-all duration-200',
                                      isSelected
                                        ? 'border-(--brand) bg-(--brand-subtle)/50 shadow-(--shadow-sm) ring-1 ring-(--brand)/20'
                                        : isOnActivePage
                                        ? 'border-l-[3px] border-l-(--brand) border-(--border-light) bg-(--brand-subtle)/20'
                                        : 'border-(--border-light) hover:border-(--border-hover) hover:bg-(--surface-hover)'
                                    )}
                                  >
                                    <div className="flex items-start justify-between gap-2 mb-1.5">
                                      <p className="text-[13px] font-semibold text-(--text-primary) flex-1 leading-snug">
                                        {toShortText(finding.title, MAX_RIGHT_PANEL_TITLE_CHARS)}
                                      </p>
                                      <div className="flex gap-1 shrink-0">
                                        {isStrength ? (
                                          <Badge variant="success" size="sm">Strength</Badge>
                                        ) : finding.severity ? (
                                          <Badge variant={finding.severity === 'critical' ? 'error' : finding.severity === 'major' ? 'warning' : 'default'} size="sm">
                                            {finding.severity}
                                          </Badge>
                                        ) : null}
                                      </div>
                                    </div>

                                    <div className="flex flex-wrap gap-1 mb-2">
                                      <Badge variant="outline" size="sm">{(finding.confidence * 100).toFixed(0)}%</Badge>
                                      {hasBoxes && <Badge variant="outline" size="sm">{matchingAnnotations.length} box{matchingAnnotations.length !== 1 ? 'es' : ''}</Badge>}
                                      {hasPointers && <Badge variant="brand" size="sm">Refs</Badge>}
                                    </div>

                                    <p className="text-[12px] leading-relaxed text-(--text-secondary)">
                                      {toShortText(finding.description, MAX_RIGHT_PANEL_TEXT_CHARS)}
                                    </p>

                                    {finding.suggestion && isSelected && (
                                      <div className="mt-2.5 pt-2.5 border-t border-(--border-light)">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-(--text-tertiary) mb-1">Suggestion</p>
                                        <p className="text-[12px] text-(--text-secondary)">{toShortText(finding.suggestion, MAX_RIGHT_PANEL_SUGGESTION_CHARS)}</p>
                                      </div>
                                    )}
                                    {isSelected && <StudyPointersPanel pointers={activePointers} />}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-(--success-subtle) shadow-inner">
                        <Check size={20} className="text-(--success)" />
                      </div>
                      <p className="text-sm font-semibold text-(--text-primary)">No findings identified</p>
                      <p className="mt-1.5 text-xs text-(--text-tertiary) max-w-[200px] leading-relaxed">
                        {generalEvaluation?.overallSummary || 'The submission appears to be correct.'}
                      </p>
                    </div>
                  )}
                </div>
              </>
            ) : activeTab === 'findings' && resultMode !== 'GENERAL' ? (
              <>
                <div className="shrink-0 border-b border-(--border-light) px-4 py-2.5">
                  <h2 className="text-[10px] font-bold uppercase tracking-widest text-(--text-quaternary)">Annotations</h2>
                </div>
                <div
                  ref={(el) => { sidebarContainerRef.current = el; }}
                  className="flex-1 overflow-y-auto p-3"
                >
                  {pageAnnotations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-(--success-subtle) shadow-inner">
                        <Check size={20} className="text-(--success)" />
                      </div>
                      <p className="text-sm font-semibold text-(--text-primary)">No annotations generated</p>
                      <p className="mt-1.5 text-xs text-(--text-tertiary) max-w-[200px] leading-relaxed">The AI did not identify any issues.</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {pageAnnotations.map((ann) => {
                        const isSelected = selectedAnnotationId === ann.id;
                        const isHovered = hoveredAnnotationId === ann.id;
                        const isOnActivePage = activePageIndex !== null && ann.pageIndex === activePageIndex;
                        const hasPointers = hasPointersForTarget({ targetType: 'criterion', targetId: ann.criterionId });

                        return (
                          <div
                            key={ann.id}
                            id={`sidebar-annotation-${ann.id}`}
                            onClick={() => {
                              setSelectedAnnotationId(ann.id);
                              programmaticScrollRef.current = { lockUntilMs: Date.now() + LOCK_MS, targetPageIndex: ann.pageIndex };
                            }}
                            onMouseEnter={() => setHoveredAnnotationId(ann.id)}
                            onMouseLeave={() => setHoveredAnnotationId(null)}
                            className={cn(
                              'rounded-lg border p-3 cursor-pointer transition-all duration-200',
                              isSelected
                                ? 'border-(--brand) bg-(--brand-subtle)/50 shadow-(--shadow-sm) ring-1 ring-(--brand)/20'
                                : isOnActivePage
                                ? 'border-l-[3px] border-l-(--brand) border-(--border-light) bg-(--brand-subtle)/20'
                                : isHovered
                                ? 'border-(--border-hover) bg-(--surface-hover)'
                                : 'border-(--border-light) hover:border-(--border-hover) hover:bg-(--surface-hover)'
                            )}
                          >
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                              <p className="text-[13px] font-semibold text-(--text-primary) flex-1 leading-snug">
                                {toShortText(ann.label || getCriterionLabel(ann.criterionId), MAX_RIGHT_PANEL_TITLE_CHARS)}
                              </p>
                              {ann.confidence !== undefined && (
                                <Badge variant="outline" size="sm">{(ann.confidence * 100).toFixed(0)}%</Badge>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              <StatusBadge status={ann.status === 'confirmed' ? 'done' : ann.status === 'rejected' ? 'error' : 'pending'} label={ann.status} size="sm" />
                              {submissionMimeType === 'application/pdf' && <Badge variant="outline" size="sm">Page {ann.pageIndex + 1}</Badge>}
                              {hasPointers && <Badge variant="brand" size="sm">Refs</Badge>}
                            </div>
                            {isSelected && ann.comment && (
                              <div className="mt-2.5 pt-2.5 border-t border-(--border-light)">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-(--text-tertiary) mb-1">Comment</p>
                                <p className="text-[12px] text-(--text-secondary)">{toShortText(ann.comment, MAX_RIGHT_PANEL_TEXT_CHARS)}</p>
                              </div>
                            )}
                            {isSelected && <StudyPointersPanel pointers={activePointers} />}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : activeTab === 'workspace' ? (
              <div className="flex-1 overflow-y-auto p-3 space-y-4">
                {/* Overall Feedback */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Edit3 size={12} className="text-(--brand)" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-(--brand)">Overall Feedback</p>
                  </div>
                  {resultJson?.generalEvaluation?.overallSummary && (
                    <div className="rounded-lg bg-(--surface-secondary)/70 border border-(--border-light) p-2.5">
                      <div className="flex items-center gap-1 mb-1">
                        <Bot size={10} className="text-(--text-tertiary)" />
                        <span className="text-[9px] font-bold uppercase tracking-widest text-(--text-quaternary)">AI suggestion</span>
                      </div>
                      <p className="text-[12px] text-(--text-tertiary) leading-relaxed">{resultJson.generalEvaluation.overallSummary}</p>
                    </div>
                  )}
                  <Textarea
                    value={overallFeedback}
                    onChange={(e) => handleOverallFeedbackChange(e.target.value)}
                    placeholder="Final published feedback..."
                    rows={3}
                    disabled={!canEdit}
                  />
                </div>

                {/* Per-question editors (Rubric mode) */}
                {rubricEvaluation && rubricEvaluation.criteria.map((criterion: any) => (
                  <QuestionReviewCard
                    key={criterion.criterionId}
                    questionId={criterion.criterionId}
                    questionLabel={criterion.label}
                    maxScore={criterion.maxPoints}
                    aiScore={criterion.score}
                    lecturerScore={lecturerScores[criterion.criterionId] ?? criterion.score}
                    onScoreChange={(s) => handleScoreChange(criterion.criterionId, s)}
                    aiFeedback={criterion.feedback || ''}
                    lecturerFeedback={lecturerFeedbacks[criterion.criterionId] ?? criterion.feedback ?? ''}
                    onFeedbackChange={(f) => handleFeedbackChange(criterion.criterionId, f)}
                    findings={[]}
                    isEdited={
                      lecturerScores[criterion.criterionId] !== criterion.score ||
                      lecturerFeedbacks[criterion.criterionId] !== (criterion.feedback || '')
                    }
                  />
                ))}

                {/* Per-question editors (General mode) */}
                {resultMode === 'GENERAL' && questionEvaluations.map((qEval) => (
                  <QuestionReviewCard
                    key={qEval.questionId}
                    questionId={qEval.questionId}
                    questionLabel={qEval.displayLabel || `Question ${qEval.questionId}`}
                    maxScore={100}
                    aiScore={0}
                    lecturerScore={lecturerScores[qEval.questionId] ?? 0}
                    onScoreChange={(s) => handleScoreChange(qEval.questionId, s)}
                    aiFeedback={qEval.overallSummary || ''}
                    lecturerFeedback={lecturerFeedbacks[qEval.questionId] ?? ''}
                    onFeedbackChange={(f) => handleFeedbackChange(qEval.questionId, f)}
                    findings={qEval.findings}
                    isEdited={lecturerScores[qEval.questionId] !== undefined || lecturerFeedbacks[qEval.questionId] !== undefined}
                    onFindingClick={handleFindingClick}
                    selectedFindingId={selectedFindingId}
                  />
                ))}

                {/* Flags */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Flag size={12} className="text-(--warning)" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-(--warning)">Flags</p>
                  </div>
                  <FlagManager
                    flags={flags}
                    onAddFlag={handleAddFlag}
                    onRemoveFlag={handleRemoveFlag}
                    onResolveFlag={handleResolveFlag}
                  />
                </div>
              </div>
            ) : activeTab === 'audit' ? (
              <div className="flex-1 overflow-y-auto p-3">
                <div className="mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-(--text-quaternary)">Review History</p>
                </div>
                <AuditTimeline entries={auditEntries} />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* ─── Publish Confirmation Modal ─── */}
      <PublishConfirmationModal
        open={showPublishModal}
        onClose={() => setShowPublishModal(false)}
        onConfirm={handlePublishConfirm}
        publishing={isPublishing}
        reviewName={reviewTitle}
        finalScore={lecturerTotalScore}
        maxScore={aiMaxScore}
        editedQuestionCount={editedQuestionCount}
        flagCount={openFlagCount}
      />
    </div>
  );
}
