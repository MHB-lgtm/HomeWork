import {
  PrismaCourseStore,
  PrismaCourseRagStore,
  PrismaExamIndexStore,
  PrismaExamStore,
  PrismaJobStore,
  PrismaLectureStore,
  PrismaLegacyReviewRecordStore,
  PrismaRubricStore,
  PrismaUserAuthStore,
  PrismaWorkerHeartbeatStore,
  getPrismaClient,
} from '@hg/postgres-store';

type ServerPersistence = {
  reviewRecords: PrismaLegacyReviewRecordStore;
  jobs: PrismaJobStore;
  workerHeartbeats: PrismaWorkerHeartbeatStore;
  userAuth: PrismaUserAuthStore;
  courses: PrismaCourseStore;
  exams: PrismaExamStore;
  lectures: PrismaLectureStore;
  courseRag: PrismaCourseRagStore;
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
      jobs: new PrismaJobStore(prisma),
      workerHeartbeats: new PrismaWorkerHeartbeatStore(prisma),
      userAuth: new PrismaUserAuthStore(prisma),
      courses: new PrismaCourseStore(prisma),
      exams: new PrismaExamStore(prisma),
      lectures: new PrismaLectureStore(prisma),
      courseRag: new PrismaCourseRagStore(prisma),
      rubrics: new PrismaRubricStore(prisma),
      examIndexes: new PrismaExamIndexStore(prisma),
    };
  }

  return cachedPersistence;
};
