import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type { ReviewRecord } from '@hg/shared-schemas';
import {
  actorKindFromReviewRecord,
  createLegacyReviewResultEnvelope,
  reviewRecordFromStoredPayload,
  reviewVersionKindFromReviewRecord,
  setReviewDisplayName,
} from '../mappers/review-record';
import {
  toDate,
  toIsoString,
  toPrismaReviewState,
  toPrismaReviewVersionKind,
} from '../mappers/domain';
import { getReviewDomainId, getSavedReviewVersionDomainId } from '../mappers/import';

type ReviewStorePrisma = Pick<
  PrismaClient,
  '$transaction' | 'submission' | 'review' | 'reviewVersion'
>;

const getSubmissionWithReview = async (prisma: ReviewStorePrisma, jobId: string) =>
  prisma.submission.findUnique({
    where: { legacyJobId: jobId },
    include: {
      review: {
        include: {
          versions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
    },
  });

export class PrismaLegacyReviewRecordStore {
  constructor(private readonly prisma: ReviewStorePrisma) {}

  async hasLegacySubmission(jobId: string): Promise<boolean> {
    const submission = await this.prisma.submission.findUnique({
      where: { legacyJobId: jobId },
      select: { id: true },
    });

    return Boolean(submission);
  }

  async getReviewRecordByLegacyJobId(jobId: string): Promise<ReviewRecord | null> {
    const submission = await getSubmissionWithReview(this.prisma, jobId);
    if (!submission?.review) {
      return null;
    }

    const currentVersion =
      submission.review.currentVersionId
        ? await this.prisma.reviewVersion.findUnique({
            where: { id: submission.review.currentVersionId },
            select: {
              rawPayload: true,
            },
          })
        : submission.review.versions[0] ?? null;

    if (!currentVersion) {
      return null;
    }

    return reviewRecordFromStoredPayload(
      jobId,
      currentVersion.rawPayload,
      toIsoString(submission.review.createdAt),
      toIsoString(submission.review.updatedAt)
    );
  }

  async saveReviewRecordByLegacyJobId(jobId: string, reviewRecord: ReviewRecord): Promise<ReviewRecord> {
    const submission = await this.prisma.submission.findUnique({
      where: { legacyJobId: jobId },
      include: {
        review: true,
      },
    });

    if (!submission) {
      throw new Error(`Submission not found for legacy job "${jobId}"`);
    }

    await this.prisma.$transaction(async (tx) => {
      const review =
        submission.review ??
        (await tx.review.create({
          data: {
            domainId: getReviewDomainId(jobId),
            courseId: submission.courseId,
            submissionId: submission.id,
            state: toPrismaReviewState('ready_for_review'),
            createdAt: toDate(reviewRecord.createdAt),
            updatedAt: toDate(reviewRecord.updatedAt),
          },
        }));

      const kind = reviewVersionKindFromReviewRecord(reviewRecord);
      const version = await tx.reviewVersion.create({
        data: {
          domainId: getSavedReviewVersionDomainId(jobId, randomUUID()),
          reviewId: review.id,
          kind: toPrismaReviewVersionKind(kind),
          actorKind: actorKindFromReviewRecord(reviewRecord),
          actorRefRaw: kind === 'lecturer_edit' ? 'review-route' : 'ai',
          summary: createLegacyReviewResultEnvelope(reviewRecord).summary ?? null,
          rawPayload: reviewRecord as never,
          createdAt: toDate(reviewRecord.updatedAt),
        },
      });

      await tx.review.update({
        where: { id: review.id },
        data: {
          currentVersionId: version.id,
          state: toPrismaReviewState(
            kind === 'lecturer_edit' ? 'lecturer_edited' : 'ready_for_review'
          ),
          updatedAt: toDate(reviewRecord.updatedAt),
        },
      });
    });

    return reviewRecord;
  }

  async patchReviewDisplayNameByLegacyJobId(
    jobId: string,
    displayName: string | null
  ): Promise<ReviewRecord> {
    const currentReview = await this.getReviewRecordByLegacyJobId(jobId);
    const now = new Date().toISOString();
    const baseReview =
      currentReview ??
      ({
        version: '1.0.0',
        jobId,
        createdAt: now,
        updatedAt: now,
        annotations: [],
      } satisfies ReviewRecord);

    const nextReview = {
      ...setReviewDisplayName(baseReview, displayName),
      updatedAt: now,
    };

    return this.saveReviewRecordByLegacyJobId(jobId, nextReview);
  }
}
