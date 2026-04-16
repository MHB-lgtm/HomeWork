import {
  PrismaCourseRagStore,
  PrismaExamIndexStore,
  PrismaJobStore,
  PrismaLegacyReviewRecordStore,
  PrismaWorkerHeartbeatStore,
  getPrismaClient,
} from '@hg/postgres-store';

export type WorkerRuntimePersistence = {
  jobs: PrismaJobStore;
  reviewRecords: PrismaLegacyReviewRecordStore;
  workerHeartbeats: PrismaWorkerHeartbeatStore;
  examIndexes: PrismaExamIndexStore;
  courseRag: PrismaCourseRagStore;
};

let cachedPersistence: WorkerRuntimePersistence | null = null;

export const getWorkerRuntimePersistence = (): WorkerRuntimePersistence => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for the W2A worker runtime');
  }

  if (!cachedPersistence) {
    const prisma = getPrismaClient();
    cachedPersistence = {
      jobs: new PrismaJobStore(prisma),
      reviewRecords: new PrismaLegacyReviewRecordStore(prisma),
      workerHeartbeats: new PrismaWorkerHeartbeatStore(prisma),
      examIndexes: new PrismaExamIndexStore(prisma),
      courseRag: new PrismaCourseRagStore(prisma),
    };
  }

  return cachedPersistence;
};
