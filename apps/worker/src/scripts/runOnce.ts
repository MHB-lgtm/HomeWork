import { ensureJobDirs, claimNextPendingJob, completeJob, failJob } from '../storage/fileJobStore';
import { validateEvaluationResult } from '@hg/shared-schemas';

async function main() {
  await ensureJobDirs();

  const job = await claimNextPendingJob();

  if (!job) {
    console.log('No pending jobs');
    process.exit(0);
  }

  try {
    // Create a mock EvaluationResult
    const mockResult = {
      score_total: 85,
      confidence: 0.9,
      summary_feedback: 'Good work overall. The solution demonstrates understanding of the problem.',
      flags: [],
      criteria: [
        {
          id: 'criterion-1',
          title: 'Problem Solving',
          max_score: 30,
          score: 25,
          comment: 'Demonstrated good understanding of the problem',
          evidence: 'Solution shows correct approach',
        },
      ],
    };

    // Validate the mock result
    const validatedResult = validateEvaluationResult(mockResult);

    // Complete the job
    await completeJob(job.id, validatedResult);

    console.log(`Completed job ${job.id}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await failJob(job.id, errorMessage);
    console.error(`Failed job ${job.id}: ${errorMessage}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Error processing job:', error);
  process.exit(1);
});

