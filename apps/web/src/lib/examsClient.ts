export type ExamSummary = {
  examId: string;
  title: string;
  createdAt: string;
  updatedAt?: string;
  examFilePath?: string;
};

/**
 * List all exams
 */
export async function listExams(): Promise<
  | { ok: true; data: ExamSummary[] }
  | { ok: false; error: string }
> {
  try {
    const response = await fetch('/api/exams');
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to fetch exams' }));
      return { ok: false, error: errorData.error || 'Failed to fetch exams' };
    }

    const data = await response.json();
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to fetch exams',
    };
  }
}

/**
 * Create a new exam
 */
export async function createExam(formData: FormData): Promise<
  | { ok: true; examId: string }
  | { ok: false; error: string }
> {
  try {
    const response = await fetch('/api/exams', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to create exam' }));
      return { ok: false, error: errorData.error || 'Failed to create exam' };
    }

    const data = await response.json();
    return { ok: true, examId: data.examId };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to create exam',
    };
  }
}

