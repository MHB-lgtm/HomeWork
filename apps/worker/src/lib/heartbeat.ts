import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { getWorkerRuntimePersistence } from './runtimePersistence';

// Get data directory from environment variable
const getDataDir = (): string => {
  const dataDir = process.env.HG_DATA_DIR;
  if (!dataDir) {
    throw new Error('HG_DATA_DIR is not set in environment variables');
  }
  return path.resolve(dataDir);
};

const getHeartbeatPath = (): string => {
  const dataDir = getDataDir();
  return path.join(dataDir, 'worker', 'heartbeat.json');
};

/**
 * Write heartbeat file with current timestamp and process ID
 */
export async function writeHeartbeat(args?: {
  workerId?: string;
  startedAt?: string;
}): Promise<void> {
  try {
    if (process.env.DATABASE_URL) {
      const persistence = getWorkerRuntimePersistence();
      await persistence.workerHeartbeats.touchHeartbeat({
        workerId: args?.workerId ?? `${os.hostname()}:${process.pid}`,
        pid: process.pid,
        hostname: os.hostname(),
        startedAt: args?.startedAt ?? new Date().toISOString(),
      });
      return;
    }

    const heartbeatPath = getHeartbeatPath();
    const heartbeatDir = path.dirname(heartbeatPath);

    // Ensure directory exists
    await fs.mkdir(heartbeatDir, { recursive: true });

    // Write heartbeat
    const heartbeat = {
      ts: new Date().toISOString(),
      pid: process.pid,
    };

    await fs.writeFile(heartbeatPath, JSON.stringify(heartbeat, null, 2), 'utf-8');
  } catch (error) {
    // Don't throw - heartbeat failure shouldn't stop the worker
    // Just log silently to avoid spam
  }
}

