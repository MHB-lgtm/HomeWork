import { claimNextJob, completeJob, failJob } from '@hg/local-job-store';
import { gradeSubmission } from '../core/gradeSubmission';

export interface ProcessResult {
  processed: boolean;
  jobId?: string;
}

/**
 * Process the next pending job if available
 * @returns { processed: false } if no job found, { processed: true, jobId } if processed
 */
export async function processNextPendingJob(): Promise<ProcessResult> {
  const job = await claimNextJob();

  if (!job) {
    return { processed: false };
  }

  const jobId = job.id;
  console.log(`[worker] Processing job ${jobId}`);

  try {
    // Grade the submission using Gemini
    const gradeResult = await gradeSubmission(job);

    // Prepare result JSON
    const resultJson = {
      rubricEvaluation: gradeResult.result,
    };

    // Complete the job
    await completeJob(jobId, resultJson);

    console.log(`[worker] Completed job ${jobId}`);
    return { processed: true, jobId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await failJob(jobId, errorMessage);
    console.error(`[worker] Job ${jobId} failed: ${errorMessage}`);
    return { processed: true, jobId };
  }
}

