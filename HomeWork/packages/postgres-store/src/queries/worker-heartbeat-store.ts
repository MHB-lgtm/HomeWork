import type { PrismaClient } from '@prisma/client';
import type { RuntimeWorkerHeartbeatRecord } from '../types';
import { toIsoString } from '../mappers/domain';

type HeartbeatPrisma = Pick<PrismaClient, 'workerHeartbeat'>;

const mapHeartbeat = (row: {
  workerId: string;
  pid: number;
  hostname: string;
  startedAt: Date;
  lastSeenAt: Date;
}): RuntimeWorkerHeartbeatRecord => ({
  workerId: row.workerId,
  pid: row.pid,
  hostname: row.hostname,
  startedAt: toIsoString(row.startedAt),
  lastSeenAt: toIsoString(row.lastSeenAt),
});

export class PrismaWorkerHeartbeatStore {
  constructor(private readonly prisma: HeartbeatPrisma) {}

  async touchHeartbeat(args: {
    workerId: string;
    pid: number;
    hostname: string;
    startedAt: string;
  }): Promise<RuntimeWorkerHeartbeatRecord> {
    const now = new Date();
    const row = await this.prisma.workerHeartbeat.upsert({
      where: { workerId: args.workerId },
      create: {
        workerId: args.workerId,
        pid: args.pid,
        hostname: args.hostname,
        startedAt: new Date(args.startedAt),
        lastSeenAt: now,
      },
      update: {
        pid: args.pid,
        hostname: args.hostname,
        lastSeenAt: now,
      },
      select: {
        workerId: true,
        pid: true,
        hostname: true,
        startedAt: true,
        lastSeenAt: true,
      },
    });

    return mapHeartbeat(row);
  }

  async getLatestHeartbeat(): Promise<RuntimeWorkerHeartbeatRecord | null> {
    const row = await this.prisma.workerHeartbeat.findFirst({
      orderBy: {
        lastSeenAt: 'desc',
      },
      select: {
        workerId: true,
        pid: true,
        hostname: true,
        startedAt: true,
        lastSeenAt: true,
      },
    });

    return row ? mapHeartbeat(row) : null;
  }
}
