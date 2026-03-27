'use client';

import { useState, useEffect } from 'react';
import { RubricSpec } from '@hg/shared-schemas';
import { listExams, ExamSummary } from '../../../lib/examsClient';
import { listRubricQuestionIds } from '../../../lib/rubricsClient';
import { Alert, AlertDescription, AlertTitle } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { EmptyState } from '../../../components/ui/empty-state';
import { Input } from '../../../components/ui/input';
import { ImmersiveShell } from '../../../components/layout/ImmersiveShell';
import { Panel, PanelContent, PanelHeader, PanelTitle } from '../../../components/ui/panel';
import { StatusBadge } from '../../../components/ui/status-badge';
import { Textarea } from '../../../components/ui/textarea';
import { CardSkeleton } from '../../../components/ui/skeleton';
import { cn } from '../../../lib/utils';

type Criterion = {
  id: string;
  label: string;
  kind: 'points' | 'binary';
  maxPoints: number;
  guidance: string;
};

function generateCriterionId(): string {
  return `criterion-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export default function RubricsPage() {
  const [examId, setExamId] = useState('');
  const [questionId, setQuestionId] = useState('');
  const [title, setTitle] = useState('');
  const [generalGuidance, setGeneralGuidance] = useState('');
  const [criteria, setCriteria] = useState<Criterion[]>([
    { id: generateCriterionId(), label: '', kind: 'points', maxPoints: 10, guidance: '' },
  ]);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [availableExams, setAvailableExams] = useState<ExamSummary[]>([]);
  const [isLoadingExams, setIsLoadingExams] = useState(false);
  const [availableQuestionIds, setAvailableQuestionIds] = useState<string[]>([]);
  const [isLoadingQuestionIds, setIsLoadingQuestionIds] = useState(false);
  const [noRubricMessage, setNoRubricMessage] = useState<string | null>(null);

  const getCriterionErrors = (criterion: Criterion): string[] => {
    const errors: string[] = [];
    if (!criterion.label.trim()) {
      errors.push('Label is required');
    }
    if (!criterion.maxPoints || criterion.maxPoints <= 0 || !Number.isInteger(criterion.maxPoints)) {
      errors.push('Max Points must be a positive integer');
    }
    return errors;
  };

  const allCriteriaValid = criteria.every((c) => getCriterionErrors(c).length === 0);
  const totalMaxPoints = criteria.reduce((sum, c) => sum + (c.maxPoints || 0), 0);
  const canSave = allCriteriaValid && examId.trim() && questionId.trim();
  const hasTargetSelection = Boolean(examId.trim() && questionId.trim());

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

  useEffect(() => {
    if (!examId.trim()) {
      setAvailableQuestionIds([]);
      setQuestionId('');
      return;
    }

    const loadQuestionIds = async () => {
      setIsLoadingQuestionIds(true);
      const result = await listRubricQuestionIds(examId.trim());
      setIsLoadingQuestionIds(false);
      if (result.ok) {
        setAvailableQuestionIds(result.questionIds);
      } else {
        setAvailableQuestionIds([]);
      }
    };

    loadQuestionIds();
  }, [examId]);

  useEffect(() => {
    if (!examId.trim() || !questionId.trim()) {
      setNoRubricMessage(null);
      return;
    }

    const autoLoadRubric = async () => {
      setIsLoading(true);
      setNoRubricMessage(null);
      try {
        const response = await fetch(`/api/rubrics/${examId.trim()}/${questionId.trim()}`);

        if (response.status === 404) {
          setNoRubricMessage('No rubric yet for this question. Create and Save.');
          setTitle('');
          setGeneralGuidance('');
          setCriteria([{ id: generateCriterionId(), label: '', kind: 'points', maxPoints: 10, guidance: '' }]);
          setIsLoading(false);
          return;
        }

        if (!response.ok) {
          setIsLoading(false);
          return;
        }

        const rubric: RubricSpec = await response.json();
        setTitle(rubric.title || '');
        setGeneralGuidance(rubric.generalGuidance || '');
        setCriteria(
          rubric.criteria.map((c) => ({
            id: c.id,
            label: c.label,
            kind: c.kind,
            maxPoints: c.maxPoints,
            guidance: c.guidance || '',
          }))
        );
        setNoRubricMessage(null);
      } catch {
        // Silently fail on auto-load errors
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(autoLoadRubric, 300);
    return () => clearTimeout(timeoutId);
  }, [examId, questionId]);

  const handleAddCriterion = () => {
    setCriteria([...criteria, { id: generateCriterionId(), label: '', kind: 'points', maxPoints: 10, guidance: '' }]);
  };

  const handleRemoveCriterion = (id: string) => {
    if (criteria.length > 1) {
      setCriteria(criteria.filter((c) => c.id !== id));
    }
  };

  const handleCriterionChange = (id: string, field: keyof Criterion, value: string | number) => {
    setCriteria(criteria.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  };

  const handleLoad = async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/rubrics/${examId}/${questionId}`);

      if (response.status === 404) {
        setMessage({ type: 'error', text: 'Rubric not found' });
        setIsLoading(false);
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load rubric');
      }

      const rubric: RubricSpec = await response.json();
      setTitle(rubric.title || '');
      setGeneralGuidance(rubric.generalGuidance || '');
      setCriteria(
        rubric.criteria.map((c) => ({
          id: c.id,
          label: c.label,
          kind: c.kind,
          maxPoints: c.maxPoints,
          guidance: c.guidance || '',
        }))
      );
      setMessage({ type: 'success', text: 'Rubric loaded successfully' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to load rubric',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!canSave) {
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const rubric: RubricSpec = {
        examId: examId.trim(),
        questionId: questionId.trim(),
        title: title.trim() || undefined,
        generalGuidance: generalGuidance.trim() || undefined,
        criteria: criteria.map((c) => ({
          id: c.id,
          label: c.label.trim(),
          kind: c.kind,
          maxPoints: c.maxPoints,
          guidance: c.guidance.trim() || undefined,
        })),
      };

      const response = await fetch('/api/rubrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rubric),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save rubric');
      }

      setMessage({ type: 'success', text: 'Saved' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save rubric',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const editorStatus = isSaving ? 'saving' : message?.type === 'success' ? 'saved' : canSave ? 'ready' : 'incomplete';

  return (
    <ImmersiveShell>
      <div className="mx-auto w-full max-w-6xl space-y-8">
      <section className="flex w-full flex-col items-center gap-4 text-center">
        <h1 className="font-heading text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">Rubrics</h1>
        <p className="mx-auto max-w-2xl text-base text-slate-700 md:text-xl">
          Define consistent grading criteria and guidance per question.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <StatusBadge status={hasTargetSelection ? 'DONE' : 'PENDING'} label={hasTargetSelection ? 'Target selected' : 'Select target'} />
          <StatusBadge
            status={editorStatus === 'saving' ? 'RUNNING' : editorStatus === 'saved' ? 'DONE' : 'PENDING'}
            label={editorStatus === 'saving' ? 'Saving' : editorStatus === 'saved' ? 'Saved' : editorStatus === 'ready' ? 'Ready' : 'Incomplete'}
            className={editorStatus === 'ready' ? 'bg-amber-100 text-amber-900' : undefined}
          />
        </div>
      </section>

      {message ? (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'} className={message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : undefined}>
          <AlertTitle>{message.type === 'success' ? 'Success' : 'Error'}</AlertTitle>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      ) : null}

      {noRubricMessage ? (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
          <AlertTitle>No rubric found</AlertTitle>
          <AlertDescription>{noRubricMessage}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Panel className="rounded-[2rem] border border-slate-200 bg-white/90 shadow-xl shadow-slate-200/40">
          <PanelHeader>
            <PanelTitle>Rubric target</PanelTitle>
          </PanelHeader>
          <PanelContent className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="examId" className="text-sm font-medium text-slate-800">
                Exam
              </label>
              {isLoadingExams ? (
                <CardSkeleton lines={2} className="rounded-xl p-4 shadow-none" />
              ) : (
                <select
                  id="examId"
                  value={examId}
                  onChange={(e) => setExamId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
                >
                  <option value="">Select an exam...</option>
                  {availableExams.map((exam) => (
                    <option key={exam.examId} value={exam.examId}>
                      {exam.title} ({exam.examId})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="questionId" className="text-sm font-medium text-slate-800">
                Question ID
              </label>
              <Input
                id="questionId"
                type="text"
                value={questionId}
                onChange={(e) => setQuestionId(e.target.value)}
                list="questionIdOptions"
                placeholder={isLoadingQuestionIds ? 'Loading...' : 'Type or select question ID'}
              />
              {availableQuestionIds.length > 0 ? (
                <datalist id="questionIdOptions">
                  {availableQuestionIds.map((qId) => (
                    <option key={qId} value={qId} />
                  ))}
                </datalist>
              ) : null}
              {isLoadingQuestionIds && examId ? <p className="text-xs text-slate-500">Loading existing question IDs...</p> : null}
            </div>

            <div className="space-y-2">
              <label htmlFor="title" className="text-sm font-medium text-slate-800">
                Title (optional)
              </label>
              <Input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Rubric title"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="generalGuidance" className="text-sm font-medium text-slate-800">
                General guidance (optional)
              </label>
              <Textarea
                id="generalGuidance"
                value={generalGuidance}
                onChange={(e) => setGeneralGuidance(e.target.value)}
                placeholder="General guidance for graders"
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button onClick={handleLoad} disabled={isLoading || isSaving} variant="outline">
                {isLoading ? 'Loading...' : 'Load'}
              </Button>
              <Button onClick={handleSave} disabled={!canSave || isSaving || isLoading}>
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </div>

            {!canSave ? (
              <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                <AlertTitle>Cannot save yet</AlertTitle>
                <AlertDescription>Pick exam + question and resolve criterion validation errors before saving.</AlertDescription>
              </Alert>
            ) : null}
          </PanelContent>
        </Panel>

        <Panel className="rounded-[2rem] border border-slate-200 bg-white/90 shadow-xl shadow-slate-200/40">
          <PanelHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <PanelTitle>Criteria</PanelTitle>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status="DONE" label={`Total ${totalMaxPoints} pts`} className="bg-slate-800 text-white" />
              <Button onClick={handleAddCriterion} size="sm">
                Add criterion
              </Button>
            </div>
          </PanelHeader>

          <PanelContent>
            {isLoading ? (
              <div className="space-y-3">
                <CardSkeleton lines={3} />
                <CardSkeleton lines={3} />
              </div>
            ) : (
              <div className="space-y-4">
                {!hasTargetSelection ? (
                  <EmptyState
                    title="Select exam and question"
                    className="py-6"
                  />
                ) : null}

                {noRubricMessage ? (
                  <EmptyState
                    title="No rubric exists yet"
                    className="py-6"
                  />
                ) : null}

                {criteria.map((criterion, index) => {
                  const errors = getCriterionErrors(criterion);
                  return (
                    <article
                      key={criterion.id}
                      className={cn(
                        'rounded-xl border bg-white p-4 shadow-sm transition-colors hover:border-slate-300',
                        errors.length > 0 ? 'border-red-200 bg-red-50/40' : 'border-slate-200'
                      )}
                    >
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <h3 className="font-heading text-sm font-semibold text-slate-900">Criterion {index + 1}</h3>
                        <Button
                          onClick={() => handleRemoveCriterion(criterion.id)}
                          disabled={criteria.length === 1}
                          variant="outline"
                          size="sm"
                        >
                          Remove
                        </Button>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-[2fr_1fr_1fr]">
                        <div className="space-y-2">
                          <label className="text-xs font-semibold tracking-wide text-slate-600 uppercase">Label *</label>
                          <Input
                            type="text"
                            value={criterion.label}
                            onChange={(e) => handleCriterionChange(criterion.id, 'label', e.target.value)}
                            placeholder="Criterion label"
                            className={errors.some((e) => e.includes('Label')) ? 'border-red-300 focus-visible:ring-red-500' : undefined}
                          />
                          {errors.some((e) => e.includes('Label')) ? (
                            <p className="text-xs text-red-700">Label is required.</p>
                          ) : null}
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-semibold tracking-wide text-slate-600 uppercase">Kind</label>
                          <select
                            value={criterion.kind}
                            onChange={(e) => handleCriterionChange(criterion.id, 'kind', e.target.value as 'points' | 'binary')}
                            className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
                          >
                            <option value="points">points</option>
                            <option value="binary">binary</option>
                          </select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-semibold tracking-wide text-slate-600 uppercase">Max points *</label>
                          <Input
                            type="number"
                            value={criterion.maxPoints || ''}
                            onChange={(e) => {
                              const value = parseInt(e.target.value, 10);
                              handleCriterionChange(criterion.id, 'maxPoints', Number.isNaN(value) ? 0 : value);
                            }}
                            min="1"
                            step="1"
                            className={errors.some((e) => e.includes('Max Points')) ? 'border-red-300 focus-visible:ring-red-500' : undefined}
                          />
                          {errors.some((e) => e.includes('Max Points')) ? (
                            <p className="text-xs text-red-700">Must be a positive integer.</p>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-4 space-y-2">
                        <label className="text-xs font-semibold tracking-wide text-slate-600 uppercase">Guidance</label>
                        <Input
                          type="text"
                          value={criterion.guidance}
                          onChange={(e) => handleCriterionChange(criterion.id, 'guidance', e.target.value)}
                          placeholder="Optional guidance"
                        />
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </PanelContent>
        </Panel>
      </div>
      </div>
    </ImmersiveShell>
  );
}
