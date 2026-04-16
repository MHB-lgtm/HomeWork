/**
 * Get a job by ID
 */
export async function getJob(jobId: string): Promise<
  | { ok: true; status: string; resultJson?: any; errorMessage?: string; submissionMimeType?: string }
  | { ok: false; error: string; status?: number }
> {
  try {
    const response = await fetch(`/api/jobs/${jobId}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Failed to fetch job' }));
      return {
        ok: false,
        error: errorData.error || 'Failed to fetch job',
        status: response.status,
      };
    }

    const data = await response.json();
    return {
      ok: true,
      status: data.status,
      resultJson: data.resultJson,
      errorMessage: data.errorMessage,
      submissionMimeType: data.submissionMimeType,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to fetch job',
    };
  }
}

