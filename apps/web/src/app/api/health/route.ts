import { NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';
import { getServerPersistence } from '@/lib/server/persistence';

export const runtime = 'nodejs';

interface HeartbeatData {
  ts: string;
  pid: number;
}

export async function GET() {
  try {
    const dataDir = process.env.HG_DATA_DIR;
    const persistence = getServerPersistence();

    if (!dataDir && !persistence) {
      return NextResponse.json(
        { error: 'HG_DATA_DIR is not set in environment' },
        { status: 500 }
      );
    }

    const DATA_DIR = dataDir ? path.resolve(dataDir) : '';
    let workerAlive = false;
    let heartbeatAgeMs: number | null = null;

    if (persistence) {
      const heartbeat = await persistence.workerHeartbeats.getLatestHeartbeat();
      if (heartbeat) {
        const heartbeatTime = new Date(heartbeat.lastSeenAt).getTime();
        const now = Date.now();
        heartbeatAgeMs = now - heartbeatTime;
        workerAlive = heartbeatAgeMs < 10000;
      }
    }

    if (heartbeatAgeMs === null && dataDir) {
      const heartbeatPath = path.join(DATA_DIR, 'worker', 'heartbeat.json');
      if (existsSync(heartbeatPath)) {
        try {
          const content = await fs.readFile(heartbeatPath, 'utf-8');
          const heartbeat: HeartbeatData = JSON.parse(content);
          const heartbeatTime = new Date(heartbeat.ts).getTime();
          const now = Date.now();
          heartbeatAgeMs = now - heartbeatTime;
          workerAlive = heartbeatAgeMs < 10000;
        } catch {
          workerAlive = false;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      dataDir: DATA_DIR,
      workerAlive,
      heartbeatAgeMs,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Failed to check health: ${errorMessage}` },
      { status: 500 }
    );
  }
}

