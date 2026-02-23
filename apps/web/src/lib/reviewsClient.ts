export type ReviewRecordV1 = {
  version: string;
  jobId: string;
  displayName?: string;
  createdAt: string;
  updatedAt: string;
  annotations: any[];
};

export type ReviewSummary = {
  jobId: string;
  displayName?: string | null;
  status: string;
  examId?: string;
  questionId?: string;
  gradingMode?: 'RUBRIC' | 'GENERAL';
  gradingScope?: 'QUESTION' | 'DOCUMENT';
  createdAt?: string | null;
  updatedAt?: string | null;
  annotationCount: number;
  hasResult: boolean;
};

/**
 * Get a review record by jobId
 */
export async function getReview(jobId: string): Promise<
  | { ok: true; review: ReviewRecordV1 }
  | { ok: false; error: string; status?: number }
> {
  try {
    const response = await fetch(`/api/reviews/${jobId}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to fetch review' }));
      return {
        ok: false,
        error: errorData.error || 'Failed to fetch review',
        status: response.status,
      };
    }

    const data = await response.json();
    if (data.ok && data.data) {
      return {
        ok: true,
        review: data.data,
      };
    }

    return {
      ok: false,
      error: 'Invalid response format',
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to fetch review',
    };
  }
}

/**
 * List all reviews (summaries)
 */
export async function listReviews(): Promise<
  | { ok: true; data: ReviewSummary[] }
  | { ok: false; error: string; status?: number }
> {
  try {
    const response = await fetch('/api/reviews');

    const data = await response.json().catch(() => ({
      ok: false,
      error: 'Failed to parse response',
    }));

    if (!response.ok || !data.ok) {
      return {
        ok: false,
        error: data.error || 'Failed to fetch reviews',
        status: response.status,
      };
    }

    return { ok: true, data: data.data as ReviewSummary[] };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to fetch reviews',
    };
  }
}

/**
 * Update display name for a review
 */
export async function updateReviewDisplayName(
  jobId: string,
  displayName: string | null
): Promise<
  | { ok: true; review: ReviewRecordV1 }
  | { ok: false; error: string; status?: number }
> {
  try {
    const response = await fetch(`/api/reviews/${jobId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ displayName }),
    });

    const data = await response.json().catch(() => ({
      ok: false,
      error: 'Failed to parse response',
    }));

    if (!response.ok || !data.ok) {
      return {
        ok: false,
        error: data.error || 'Failed to update review name',
        status: response.status,
      };
    }

    return { ok: true, review: data.data as ReviewRecordV1 };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to update review name',
    };
  }
}

