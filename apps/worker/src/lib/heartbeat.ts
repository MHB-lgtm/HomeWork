import * as os from 'os';
import { getWorkerRuntimePersistence } from './runtimePersistence';

/**
 * Touch the DB-backed worker heartbeat row.
 */
export async function writeHeartbeat(args?: {
  workerId?: string;
  startedAt?: string;
}): Promise<void> {
  const persistence = getWorkerRuntimePersistence();
  await persistence.workerHeartbeats.touchHeartbeat({
    workerId: args?.workerId ?? `${os.hostname()}:${process.pid}`,
    pid: process.pid,
    hostname: os.hostname(),
    startedAt: args?.startedAt ?? new Date().toISOString(),
  });
}

