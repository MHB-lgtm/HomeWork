import { NextResponse } from 'next/server';
import * as path from 'path';
import { getServerPersistence } from '@/lib/server/persistence';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const dataDir = process.env.HG_DATA_DIR;
    const persistence = getServerPersistence();

    if (!persistence) {
      return NextResponse.json(
        { error: 'DATABASE_URL is not set in environment' },
        { status: 500 }
      );
    }

    const DATA_DIR = dataDir ? path.resolve(dataDir) : '';
    let workerAlive = false;
    let heartbeatAgeMs: number | null = null;

    const heartbeat = await persistence.workerHeartbeats.getLatestHeartbeat();
    if (heartbeat) {
      const heartbeatTime = new Date(heartbeat.lastSeenAt).getTime();
      const now = Date.now();
      heartbeatAgeMs = now - heartbeatTime;
      workerAlive = heartbeatAgeMs < 10000;
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

