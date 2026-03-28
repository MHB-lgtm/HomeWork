import {
  PrismaExamIndexStore,
  PrismaExamStore,
  PrismaLegacyReviewRecordStore,
  PrismaRubricStore,
  getPrismaClient,
} from '@hg/postgres-store';

type ServerPersistence = {
  reviewRecords: PrismaLegacyReviewRecordStore;
  exams: PrismaExamStore;
  rubrics: PrismaRubricStore;
  examIndexes: PrismaExamIndexStore;
};

let cachedPersistence: ServerPersistence | null | undefined;

export const getServerPersistence = (): ServerPersistence | null => {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  if (!cachedPersistence) {
    const prisma = getPrismaClient();
    cachedPersistence = {
      reviewRecords: new PrismaLegacyReviewRecordStore(prisma),
      exams: new PrismaExamStore(prisma),
      rubrics: new PrismaRubricStore(prisma),
      examIndexes: new PrismaExamIndexStore(prisma),
    };
  }

  return cachedPersistence;
};
