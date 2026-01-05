import path from 'path';
import dotenv from 'dotenv';
import { ensureJobDirs } from '@hg/local-job-store';
import { processNextPendingJob } from '../lib/processNextPendingJob';
import { writeHeartbeat } from '../lib/heartbeat';

// Load .env from repo root (not from current working directory)
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
console.log('[env] Has GEMINI_API_KEY:', Boolean(process.env.GEMINI_API_KEY));

let running = true;
let lastHeartbeat = 0;
const HEARTBEAT_INTERVAL = 2000; // 2 seconds

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[worker] Received SIGINT, shutting down gracefully...');
  running = false;
});

process.on('SIGTERM', () => {
  console.log('\n[worker] Received SIGTERM, shutting down gracefully...');
  running = false;
});

async function main() {
  await ensureJobDirs();
  console.log('[worker] Starting worker loop...');

  // Write initial heartbeat
  await writeHeartbeat();
  lastHeartbeat = Date.now();

  while (running) {
    try {
      // Update heartbeat if enough time has passed
      const now = Date.now();
      if (now - lastHeartbeat >= HEARTBEAT_INTERVAL) {
        await writeHeartbeat();
        lastHeartbeat = now;
      }

      const result = await processNextPendingJob();

      if (result.processed) {
        // Job was processed, try again immediately
        continue;
      } else {
        // No jobs available, sleep for 1 second
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      // Log error but continue running
      console.error('[worker] Error in loop:', error);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.log('[worker] Worker loop stopped');
  process.exit(0);
}

main().catch((error) => {
  console.error('[worker] Fatal error:', error);
  process.exit(1);
});

