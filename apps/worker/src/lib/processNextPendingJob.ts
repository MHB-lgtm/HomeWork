import { claimNextJob, completeJob, failJob, getOrCreateReview, saveReview } from '@hg/local-job-store';
import { gradeSubmission } from '../core/gradeSubmission';
import { localizeMistakes } from '../core/localizeMistakes';

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

    // Run localization pass to generate annotations
    const localizationResult = await localizeMistakes({
      jobId,
      questionId: job.inputs.questionId,
      submissionFilePath: job.inputs.submissionFilePath,
      rubricEvaluation: gradeResult.result,
    });

    // Ensure ReviewRecord exists and save annotations
    const review = await getOrCreateReview(jobId);
    if (localizationResult.ok) {
      review.annotations = localizationResult.annotations;
      review.updatedAt = new Date().toISOString();
      await saveReview(review);
      console.log(`[job:${jobId}] annotations generated: ${localizationResult.annotations.length}`);
    } else {
      // Localization failed - save review with empty annotations
      review.annotations = [];
      review.updatedAt = new Date().toISOString();
      await saveReview(review);
      console.warn(`[job:${jobId}] annotations generation failed: ${localizationResult.error}`);
    }

    // Complete the job (regardless of localization success/failure)
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

