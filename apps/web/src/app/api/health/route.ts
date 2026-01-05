import { NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';

export const runtime = 'nodejs';

interface HeartbeatData {
  ts: string;
  pid: number;
}

export async function GET() {
  try {
    const dataDir = process.env.HG_DATA_DIR;
    if (!dataDir) {
      return NextResponse.json(
        { error: 'HG_DATA_DIR is not set in environment' },
        { status: 500 }
      );
    }

    const DATA_DIR = path.resolve(dataDir);
    const heartbeatPath = path.join(DATA_DIR, 'worker', 'heartbeat.json');

    let workerAlive = false;
    let heartbeatAgeMs: number | null = null;

    if (existsSync(heartbeatPath)) {
      try {
        const content = await fs.readFile(heartbeatPath, 'utf-8');
        const heartbeat: HeartbeatData = JSON.parse(content);
        const heartbeatTime = new Date(heartbeat.ts).getTime();
        const now = Date.now();
        heartbeatAgeMs = now - heartbeatTime;
        // Consider worker alive if heartbeat is less than 10 seconds old
        workerAlive = heartbeatAgeMs < 10000;
      } catch (error) {
        // File exists but couldn't read/parse it
        workerAlive = false;
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

