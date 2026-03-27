import { PrismaLegacyReviewRecordStore, getPrismaClient } from '@hg/postgres-store';

type ServerPersistence = {
  reviewRecords: PrismaLegacyReviewRecordStore;
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
    };
  }

  return cachedPersistence;
};
