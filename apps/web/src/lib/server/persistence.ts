import {
  PrismaCourseStore,
  PrismaExamIndexStore,
  PrismaExamStore,
  PrismaLectureStore,
  PrismaLegacyReviewRecordStore,
  PrismaRubricStore,
  getPrismaClient,
} from '@hg/postgres-store';

type ServerPersistence = {
  reviewRecords: PrismaLegacyReviewRecordStore;
  courses: PrismaCourseStore;
  exams: PrismaExamStore;
  lectures: PrismaLectureStore;
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
      courses: new PrismaCourseStore(prisma),
      exams: new PrismaExamStore(prisma),
      lectures: new PrismaLectureStore(prisma),
      rubrics: new PrismaRubricStore(prisma),
      examIndexes: new PrismaExamIndexStore(prisma),
    };
  }

  return cachedPersistence;
};
