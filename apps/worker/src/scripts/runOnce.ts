import path from 'path';
import dotenv from 'dotenv';
import { ensureJobDirs } from '@hg/local-job-store';
import { processNextPendingJob } from '../lib/processNextPendingJob';

// Load .env from repo root (not from current working directory)
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
console.log('[env] Has GEMINI_API_KEY:', Boolean(process.env.GEMINI_API_KEY));

async function main() {
  await ensureJobDirs();

  const result = await processNextPendingJob();

  if (!result.processed) {
    console.log('No pending jobs');
    process.exit(0);
  }

  // Job was processed (successfully or failed)
  process.exit(0);
}

main().catch((error) => {
  console.error('Error processing job:', error);
  process.exit(1);
});

