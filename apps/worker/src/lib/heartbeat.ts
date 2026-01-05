import * as fs from 'fs/promises';
import * as path from 'path';

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
export async function writeHeartbeat(): Promise<void> {
  try {
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

