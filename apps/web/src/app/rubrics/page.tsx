'use client';

import { useState, useEffect } from 'react';
import { RubricSpec } from '@hg/shared-schemas';
import Link from 'next/link';
import { listExams, ExamSummary } from '../../lib/examsClient';
import { listRubricQuestionIds } from '../../lib/rubricsClient';

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
  
  // Exam and question selection state
  const [availableExams, setAvailableExams] = useState<ExamSummary[]>([]);
  const [isLoadingExams, setIsLoadingExams] = useState(false);
  const [availableQuestionIds, setAvailableQuestionIds] = useState<string[]>([]);
  const [isLoadingQuestionIds, setIsLoadingQuestionIds] = useState(false);
  const [noRubricMessage, setNoRubricMessage] = useState<string | null>(null);

  // Validation
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

  // Load questionIds when examId changes
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

  // Auto-load rubric when examId + questionId are set
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
      } catch (error) {
        // Silently fail on auto-load errors
      } finally {
        setIsLoading(false);
      }
    };

    // Debounce auto-load slightly
    const timeoutId = setTimeout(autoLoadRubric, 300);
    return () => clearTimeout(timeoutId);
  }, [examId, questionId]);

  const handleAddCriterion = () => {
    setCriteria([
      ...criteria,
      { id: generateCriterionId(), label: '', kind: 'points', maxPoints: 10, guidance: '' },
    ]);
  };

  const handleRemoveCriterion = (id: string) => {
    if (criteria.length > 1) {
      setCriteria(criteria.filter((c) => c.id !== id));
    }
  };

  const handleCriterionChange = (id: string, field: keyof Criterion, value: string | number) => {
    setCriteria(
      criteria.map((c) =>
        c.id === id ? { ...c, [field]: value } : c
      )
    );
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
    if (!canSave) return;

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

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <Link href="/" style={{ color: '#0070f3', textDecoration: 'none' }}>
          ← Back to Home
        </Link>
        <span style={{ color: '#666' }}>|</span>
        <Link href="/exams" style={{ color: '#0070f3', textDecoration: 'none' }}>
          Manage Exams
        </Link>
      </div>

      <h1>Rubric Editor</h1>

      {message && (
        <div
          style={{
            marginTop: '1rem',
            padding: '1rem',
            backgroundColor: message.type === 'success' ? '#d4edda' : '#f8d7da',
            border: `1px solid ${message.type === 'success' ? '#c3e6cb' : '#f5c6cb'}`,
            borderRadius: '4px',
            color: message.type === 'success' ? '#155724' : '#721c24',
          }}
        >
          {message.text}
        </div>
      )}

      {noRubricMessage && (
        <div
          style={{
            marginTop: '1rem',
            padding: '1rem',
            backgroundColor: '#fff3cd',
            border: '1px solid #ffeaa7',
            borderRadius: '4px',
            color: '#856404',
          }}
        >
          {noRubricMessage}
        </div>
      )}

      <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label htmlFor="examId" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Exam:
            </label>
            {isLoadingExams ? (
              <div style={{ padding: '0.5rem', color: '#666' }}>Loading exams...</div>
            ) : (
              <select
                id="examId"
                value={examId}
                onChange={(e) => setExamId(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
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

          <div>
            <label htmlFor="questionId" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Question ID:
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="questionId"
                type="text"
                value={questionId}
                onChange={(e) => setQuestionId(e.target.value)}
                list="questionIdOptions"
                placeholder={isLoadingQuestionIds ? 'Loading...' : 'Type or select question ID'}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
              />
              {availableQuestionIds.length > 0 && (
                <datalist id="questionIdOptions">
                  {availableQuestionIds.map((qId) => (
                    <option key={qId} value={qId} />
                  ))}
                </datalist>
              )}
            </div>
            {isLoadingQuestionIds && examId && (
              <small style={{ color: '#666', fontSize: '0.85em' }}>Loading existing questions...</small>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="title" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Title (optional):
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Rubric title"
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
          />
        </div>

        <div>
          <label htmlFor="generalGuidance" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            General Guidance (optional):
          </label>
          <textarea
            id="generalGuidance"
            value={generalGuidance}
            onChange={(e) => setGeneralGuidance(e.target.value)}
            placeholder="General guidance for graders"
            rows={3}
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', fontFamily: 'inherit' }}
          />
        </div>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2>Criteria</h2>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <span style={{ fontWeight: 'bold' }}>Total Max Points: {totalMaxPoints}</span>
            <button
              onClick={handleAddCriterion}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Add Criterion
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {criteria.map((criterion, index) => {
            const errors = getCriterionErrors(criterion);
            return (
              <div
                key={criterion.id}
                style={{
                  padding: '1rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  backgroundColor: errors.length > 0 ? '#fff5f5' : '#fff',
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '1rem', alignItems: 'start' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9em', fontWeight: 'bold' }}>
                      Label *
                    </label>
                    <input
                      type="text"
                      value={criterion.label}
                      onChange={(e) => handleCriterionChange(criterion.id, 'label', e.target.value)}
                      placeholder="Criterion label"
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: errors.some((e) => e.includes('Label')) ? '2px solid #dc3545' : '1px solid #ccc',
                        borderRadius: '4px',
                      }}
                    />
                    {errors.some((e) => e.includes('Label')) && (
                      <div style={{ color: '#dc3545', fontSize: '0.85em', marginTop: '0.25rem' }}>
                        Label is required
                      </div>
                    )}
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9em', fontWeight: 'bold' }}>
                      Kind
                    </label>
                    <select
                      value={criterion.kind}
                      onChange={(e) => handleCriterionChange(criterion.id, 'kind', e.target.value as 'points' | 'binary')}
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
                    >
                      <option value="points">points</option>
                      <option value="binary">binary</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9em', fontWeight: 'bold' }}>
                      Max Points *
                    </label>
                    <input
                      type="number"
                      value={criterion.maxPoints || ''}
                      onChange={(e) => {
                        const value = parseInt(e.target.value, 10);
                        handleCriterionChange(criterion.id, 'maxPoints', isNaN(value) ? 0 : value);
                      }}
                      min="1"
                      step="1"
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: errors.some((e) => e.includes('Max Points')) ? '2px solid #dc3545' : '1px solid #ccc',
                        borderRadius: '4px',
                      }}
                    />
                    {errors.some((e) => e.includes('Max Points')) && (
                      <div style={{ color: '#dc3545', fontSize: '0.85em', marginTop: '0.25rem' }}>
                        Must be a positive integer
                      </div>
                    )}
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9em', fontWeight: 'bold' }}>
                      Guidance
                    </label>
                    <input
                      type="text"
                      value={criterion.guidance}
                      onChange={(e) => handleCriterionChange(criterion.id, 'guidance', e.target.value)}
                      placeholder="Optional guidance"
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
                    />
                  </div>

                  <div style={{ paddingTop: '1.5rem' }}>
                    <button
                      onClick={() => handleRemoveCriterion(criterion.id)}
                      disabled={criteria.length === 1}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: criteria.length === 1 ? '#ccc' : '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: criteria.length === 1 ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
        <button
          onClick={handleLoad}
          disabled={isLoading || isSaving}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: isLoading ? '#ccc' : '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isLoading || isSaving ? 'not-allowed' : 'pointer',
            fontSize: '1rem',
          }}
        >
          {isLoading ? 'Loading...' : 'Load'}
        </button>

        <button
          onClick={handleSave}
          disabled={!canSave || isSaving || isLoading}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: !canSave ? '#ccc' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: !canSave || isSaving || isLoading ? 'not-allowed' : 'pointer',
            fontSize: '1rem',
          }}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {!canSave && (
        <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#fff3cd', borderRadius: '4px', color: '#856404' }}>
          Please fix validation errors before saving.
        </div>
      )}
    </main>
  );
}

