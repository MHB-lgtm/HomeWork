import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type { ReviewRecord } from '@hg/shared-schemas';
import type {
  LegacyReviewDetailRecord,
  LegacyReviewSummaryRecord,
  LegacySubmissionAssetRecord,
} from '../types';
import {
  actorKindFromReviewRecord,
  createStoredReviewRecordPayload,
  createLegacyReviewResultEnvelope,
  reviewRecordFromStoredPayload,
  reviewContextFromStoredPayload,
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
    select: {
      id: true,
      courseId: true,
      currentPublishedResultId: true,
      material: {
        select: {
          asset: {
            select: {
              path: true,
              mimeType: true,
            },
          },
        },
      },
      review: {
        select: {
          createdAt: true,
          updatedAt: true,
          currentVersionId: true,
          versions: {
            select: {
              id: true,
              rawPayload: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
    },
  });

export class PrismaLegacyReviewRecordStore {
  constructor(private readonly prisma: ReviewStorePrisma) {}

  async listReviewSummariesByLegacyJobId(): Promise<LegacyReviewSummaryRecord[]> {
    const submissions = await this.prisma.submission.findMany({
      where: {
        legacyJobId: { not: null },
        review: { isNot: null },
      },
      select: {
        legacyJobId: true,
        currentPublishedResultId: true,
        review: {
          select: {
            createdAt: true,
            updatedAt: true,
            currentVersionId: true,
            versions: {
              select: {
                id: true,
                rawPayload: true,
              },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    const currentVersionIds = submissions
      .map((submission) => submission.review?.currentVersionId ?? null)
      .filter((versionId): versionId is string => Boolean(versionId));

    const currentVersions =
      currentVersionIds.length > 0
        ? await this.prisma.reviewVersion.findMany({
            where: { id: { in: currentVersionIds } },
            select: {
              id: true,
              rawPayload: true,
            },
          })
        : [];

    const currentVersionById = new Map(
      currentVersions.map((version) => [version.id, version.rawPayload] as const)
    );

    return submissions
      .flatMap((submission) => {
        const jobId = submission.legacyJobId;
        const review = submission.review;
        if (!jobId || !review) {
          return [];
        }

        const rawPayload =
          (review.currentVersionId
            ? currentVersionById.get(review.currentVersionId)
            : undefined) ?? review.versions[0]?.rawPayload;

        const reviewRecord = reviewRecordFromStoredPayload(
          jobId,
          rawPayload,
          toIsoString(review.createdAt),
          toIsoString(review.updatedAt)
        );

        return [
          {
            jobId,
            displayName: reviewRecord.displayName ?? null,
            createdAt: toIsoString(review.createdAt),
            updatedAt: toIsoString(review.updatedAt),
            annotationCount: reviewRecord.annotations.length,
            hasResult: Boolean(submission.currentPublishedResultId),
          } satisfies LegacyReviewSummaryRecord,
        ];
      })
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async hasLegacySubmission(jobId: string): Promise<boolean> {
    const submission = await this.prisma.submission.findUnique({
      where: { legacyJobId: jobId },
      select: { id: true },
    });

    return Boolean(submission);
  }

  async getReviewDetailByLegacyJobId(jobId: string): Promise<LegacyReviewDetailRecord | null> {
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

    const submissionAsset = submission.material?.asset
      ? ({
          path: submission.material.asset.path,
          mimeType: submission.material.asset.mimeType ?? null,
        } satisfies LegacySubmissionAssetRecord)
      : null;

    return {
      review: reviewRecordFromStoredPayload(
        jobId,
        currentVersion.rawPayload,
        toIsoString(submission.review.createdAt),
        toIsoString(submission.review.updatedAt)
      ),
      context: reviewContextFromStoredPayload(currentVersion.rawPayload) ?? undefined,
      submissionAsset,
    };
  }

  async getSubmissionAssetByLegacyJobId(jobId: string): Promise<LegacySubmissionAssetRecord | null> {
    const submission = await this.prisma.submission.findUnique({
      where: { legacyJobId: jobId },
      select: {
        material: {
          select: {
            asset: {
              select: {
                path: true,
                mimeType: true,
              },
            },
          },
        },
      },
    });

    if (!submission?.material?.asset) {
      return null;
    }

    return {
      path: submission.material.asset.path,
      mimeType: submission.material.asset.mimeType ?? null,
    };
  }

  async getReviewRecordByLegacyJobId(jobId: string): Promise<ReviewRecord | null> {
    const detail = await this.getReviewDetailByLegacyJobId(jobId);
    return detail?.review ?? null;
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

    const currentVersion =
      submission.review?.currentVersionId
        ? await this.prisma.reviewVersion.findUnique({
            where: { id: submission.review.currentVersionId },
            select: { rawPayload: true },
          })
        : null;
    const preservedContext = reviewContextFromStoredPayload(currentVersion?.rawPayload ?? null) ?? undefined;

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
          rawPayload: createStoredReviewRecordPayload(reviewRecord, preservedContext) as never,
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
