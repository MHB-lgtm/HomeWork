/**
 * List questionIds that have rubrics for a given exam
 */
export async function listRubricQuestionIds(examId: string): Promise<
  | { ok: true; questionIds: string[] }
  | { ok: false; error: string }
> {
  try {
    const response = await fetch(`/api/rubrics?examId=${encodeURIComponent(examId)}`);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to fetch questionIds' }));
      return { ok: false, error: errorData.error || errorData.message || 'Failed to fetch questionIds' };
    }

    const data = await response.json();
    if (data.ok && data.data && Array.isArray(data.data.questionIds)) {
      return { ok: true, questionIds: data.data.questionIds };
    }
    
    return { ok: false, error: 'Invalid response format' };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to fetch questionIds',
    };
  }
}

