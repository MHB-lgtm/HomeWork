import {
  PrismaAssignmentStore,
  PrismaCourseMembershipStore,
  PrismaCourseStore,
  PrismaCourseRagStore,
  PrismaExamIndexStore,
  PrismaExamStore,
  PrismaJobStore,
  PrismaLectureStore,
  PrismaLegacyReviewRecordStore,
  PrismaRubricStore,
  PrismaStudentResultsStore,
  PrismaUserAuthStore,
  PrismaWorkerHeartbeatStore,
  getPrismaClient,
} from '@hg/postgres-store';

type ServerPersistence = {
  reviewRecords: PrismaLegacyReviewRecordStore;
  jobs: PrismaJobStore;
  workerHeartbeats: PrismaWorkerHeartbeatStore;
  userAuth: PrismaUserAuthStore;
  courseMemberships: PrismaCourseMembershipStore;
  courses: PrismaCourseStore;
  assignments: PrismaAssignmentStore;
  studentResults: PrismaStudentResultsStore;
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
      courseMemberships: new PrismaCourseMembershipStore(prisma),
      courses: new PrismaCourseStore(prisma),
      assignments: new PrismaAssignmentStore(prisma),
      studentResults: new PrismaStudentResultsStore(prisma),
      exams: new PrismaExamStore(prisma),
      lectures: new PrismaLectureStore(prisma),
      courseRag: new PrismaCourseRagStore(prisma),
      rubrics: new PrismaRubricStore(prisma),
      examIndexes: new PrismaExamIndexStore(prisma),
    };
  }

  return cachedPersistence;
};
