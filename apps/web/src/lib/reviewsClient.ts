export type ReviewRecordV1 = {
  version: string;
  jobId: string;
  createdAt: string;
  updatedAt: string;
  annotations: any[];
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

