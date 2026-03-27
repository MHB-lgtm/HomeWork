import type { PrismaClient } from '@prisma/client';

const missingMessage = (entity: string, value: string): string =>
  `${entity} not found for domain id "${value}"`;

export const requireCourseRow = async (
  prisma: Pick<PrismaClient, 'course'>,
  domainId: string
) => {
  const row = await prisma.course.findUnique({
    where: { domainId },
    select: { id: true, domainId: true },
  });

  if (!row) {
    throw new Error(missingMessage('Course', domainId));
  }

  return row;
};

export const requireCourseMaterialRow = async (
  prisma: Pick<PrismaClient, 'courseMaterial'>,
  domainId: string
) => {
  const row = await prisma.courseMaterial.findUnique({
    where: { domainId },
    select: { id: true, domainId: true },
  });

  if (!row) {
    throw new Error(missingMessage('CourseMaterial', domainId));
  }

  return row;
};

export const requireSubmissionRow = async (
  prisma: Pick<PrismaClient, 'submission'>,
  domainId: string
) => {
  const row = await prisma.submission.findUnique({
    where: { domainId },
    select: { id: true, domainId: true, legacyJobId: true },
  });

  if (!row) {
    throw new Error(missingMessage('Submission', domainId));
  }

  return row;
};

export const requireReviewRow = async (
  prisma: Pick<PrismaClient, 'review'>,
  domainId: string
) => {
  const row = await prisma.review.findUnique({
    where: { domainId },
    select: { id: true, domainId: true, currentVersionId: true },
  });

  if (!row) {
    throw new Error(missingMessage('Review', domainId));
  }

  return row;
};

export const requireReviewVersionRow = async (
  prisma: Pick<PrismaClient, 'reviewVersion'>,
  domainId: string
) => {
  const row = await prisma.reviewVersion.findUnique({
    where: { domainId },
    select: { id: true, domainId: true },
  });

  if (!row) {
    throw new Error(missingMessage('ReviewVersion', domainId));
  }

  return row;
};

export const requirePublishedResultRow = async (
  prisma: Pick<PrismaClient, 'publishedResult'>,
  domainId: string
) => {
  const row = await prisma.publishedResult.findUnique({
    where: { domainId },
    select: { id: true, domainId: true },
  });

  if (!row) {
    throw new Error(missingMessage('PublishedResult', domainId));
  }

  return row;
};
