import path from 'path';
import dotenv from 'dotenv';
import { ensureJobDirs, claimNextPendingJob, completeJob, failJob } from '../storage/fileJobStore';
import { gradeSubmission } from '../core/gradeSubmission';

// Load .env from repo root (not from current working directory)
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
console.log('[env] Has GEMINI_API_KEY:', Boolean(process.env.GEMINI_API_KEY));

async function main() {
  await ensureJobDirs();

  const job = await claimNextPendingJob();

  if (!job) {
    console.log('No pending jobs');
    process.exit(0);
  }

  try {
    // Grade the submission using Gemini
    const result = await gradeSubmission(job);

    // Complete the job
    await completeJob(job.id, result);

    console.log(`Completed job ${job.id}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await failJob(job.id, errorMessage);
    console.error('Job failed:', job.id, errorMessage);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Error processing job:', error);
  process.exit(1);
});

