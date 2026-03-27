import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import {
  PublicationService,
  asActorRef,
  assertCanPublishResultEnvelope,
  createPublishedSnapshotResultEnvelope,
} from '@hg/domain-workflow';
import type { ReviewRecord } from '@hg/shared-schemas';
import type {
  LegacyReviewDetailRecord,
  LegacyReviewPublicationRecord,
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
  asJsonValue,
  decimalToNumber,
  toDate,
  toIsoString,
  toPrismaReviewState,
  toPrismaReviewVersionKind,
} from '../mappers/domain';
import { getReviewDomainId, getSavedReviewVersionDomainId } from '../mappers/import';
import { PrismaPublicationRepository } from '../repos/publication-repository';
import { PrismaReviewRepository } from '../repos/review-repository';
import { PrismaSubmissionRepository } from '../repos/submission-repository';

type ReviewStorePrisma = Pick<
  PrismaClient,
  | '$transaction'
  | 'course'
  | 'courseMaterial'
  | 'submission'
  | 'review'
  | 'reviewVersion'
  | 'publishedResult'
  | 'gradebookEntry'
>;

type ReviewStoreTx = Omit<ReviewStorePrisma, '$transaction'>;

type SubmissionWithReview = Awaited<ReturnType<typeof getSubmissionWithReview>>;

const toPublicationRecord = (
  submission: SubmissionWithReview
): LegacyReviewPublicationRecord | undefined => {
  const effective = submission?.publishedResults?.[0];
  if (!submission) {
    return undefined;
  }

  if (!effective) {
    return {
      isPublished: false,
      publishedResultId: null,
      publishedAt: null,
      score: null,
      maxScore: null,
      summary: null,
    };
  }

  return {
    isPublished: true,
    publishedResultId: effective.domainId,
    publishedAt: toIsoString(effective.publishedAt),
    score: decimalToNumber(effective.finalScore) ?? null,
    maxScore: decimalToNumber(effective.maxScore) ?? null,
    summary: effective.summary ?? null,
  };
};

const createPublishedReviewVersionDomainId = (jobId: string): string =>
  `legacy-review-version:${jobId}:published:${randomUUID()}`;

const createPublishedResultDomainId = (jobId: string): string =>
  `legacy-published-result:${jobId}:${randomUUID()}`;

const noOpAuditRepository = {
  async appendAuditEvents() {
    return undefined;
  },
  async listAuditEvents() {
    return [];
  },
};

export class LegacyReviewPublicationConflictError extends Error {}

const getSubmissionWithReview = async (prisma: ReviewStorePrisma, jobId: string) =>
  prisma.submission.findUnique({
    where: { legacyJobId: jobId },
    select: {
      id: true,
      courseId: true,
      currentPublishedResultId: true,
      publishedResults: {
        where: { status: 'EFFECTIVE' },
        orderBy: { publishedAt: 'desc' },
        take: 1,
        select: {
          domainId: true,
          publishedAt: true,
          finalScore: true,
          maxScore: true,
          summary: true,
        },
      },
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
        publishedResults: {
          where: { status: 'EFFECTIVE' },
          orderBy: { publishedAt: 'desc' },
          take: 1,
          select: { domainId: true },
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
            hasResult: Boolean(
              submission.currentPublishedResultId ?? submission.publishedResults[0]?.domainId
            ),
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
      publication: toPublicationRecord(submission),
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

  async publishReviewByLegacyJobId(
    jobId: string,
    options?: {
      actorRef?: string;
      reviewRecord?: ReviewRecord;
      context?: LegacyReviewDetailRecord['context'];
    }
  ): Promise<LegacyReviewPublicationRecord> {
    const actorRef = options?.actorRef ?? 'legacy:review-route';
    const submissionLink = await this.prisma.submission.findUnique({
      where: { legacyJobId: jobId },
      select: { domainId: true },
    });

    if (!submissionLink) {
      throw new LegacyReviewPublicationConflictError(
        `Review "${jobId}" is not backed by an imported Postgres submission`
      );
    }

    const prisma = this.prisma as unknown as PrismaClient;
    const submissionRepository = new PrismaSubmissionRepository(prisma);
    const reviewRepository = new PrismaReviewRepository(prisma);
    const publicationRepository = new PrismaPublicationRepository(prisma);
    const publicationService = new PublicationService({
      reviewRepository,
      publicationRepository,
      auditRepository: noOpAuditRepository,
    });

    const submission = await submissionRepository.getSubmission(submissionLink.domainId);
    if (!submission) {
      throw new LegacyReviewPublicationConflictError(
        `Submission "${submissionLink.domainId}" could not be loaded for review "${jobId}"`
      );
    }

    const review = await reviewRepository.getReviewBySubmissionId(submission.submissionId);
    if (!review) {
      throw new LegacyReviewPublicationConflictError(
        `Review "${jobId}" does not have a persisted Postgres review record`
      );
    }

    const versions = await reviewRepository.listReviewVersions(review.reviewId);
    const sourceReviewVersion =
      (review.currentVersionId
        ? versions.find((version) => version.reviewVersionId === review.currentVersionId)
        : undefined) ?? versions[versions.length - 1];

    if (!sourceReviewVersion) {
      throw new LegacyReviewPublicationConflictError(
        `Review "${jobId}" has no source review version to publish`
      );
    }

    const fallbackEnvelope =
      options?.reviewRecord && options.context
        ? {
            ...createLegacyReviewResultEnvelope(
              options.reviewRecord,
              options.context.resultJson
            ),
            rawPayload: createStoredReviewRecordPayload(
              options.reviewRecord,
              options.context
            ),
          }
        : null;
    const effectiveSourceReviewVersion = {
      ...sourceReviewVersion,
      resultEnvelope: fallbackEnvelope ?? sourceReviewVersion.resultEnvelope,
    };

    let publishable: ReturnType<typeof assertCanPublishResultEnvelope>;
    try {
      publishable = assertCanPublishResultEnvelope(effectiveSourceReviewVersion.resultEnvelope);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new LegacyReviewPublicationConflictError(errorMessage);
    }
    const publishedAt = new Date().toISOString();
    const publishedReviewVersionId = createPublishedReviewVersionDomainId(jobId);
    const publishedResultId = createPublishedResultDomainId(jobId);

    const { publishedResult } = await publicationService.publish({
      review,
      sourceReviewVersion: effectiveSourceReviewVersion,
      publishedReviewVersion: {
        reviewVersionId: publishedReviewVersionId,
        reviewId: review.reviewId,
        kind: 'published_snapshot',
        resultEnvelope: createPublishedSnapshotResultEnvelope(effectiveSourceReviewVersion),
        createdAt: publishedAt,
        actorRef: asActorRef(actorRef),
      },
      publishedResult: {
        publishedResultId,
        courseId: review.courseId,
        submissionId: submission.submissionId,
        studentRef: submission.studentRef,
        moduleRef: submission.moduleRef,
        reviewId: review.reviewId,
        sourceReviewVersionId: publishedReviewVersionId,
        publishedAt,
        status: 'effective',
        finalScore: publishable.score,
        maxScore: publishable.maxScore,
        summary: publishable.summary,
        breakdownSnapshot: effectiveSourceReviewVersion.resultEnvelope.questionBreakdown ?? null,
      },
      actorRef: asActorRef(actorRef),
    });

    return {
      isPublished: true,
      publishedResultId: publishedResult.publishedResultId,
      publishedAt: publishedResult.publishedAt,
      score: publishedResult.finalScore,
      maxScore: publishedResult.maxScore,
      summary: publishedResult.summary,
    };
  }

  async saveReviewRecordByLegacyJobId(
    jobId: string,
    reviewRecord: ReviewRecord,
    options?: { context?: LegacyReviewDetailRecord['context'] }
  ): Promise<ReviewRecord> {
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
    const preservedContext =
      reviewContextFromStoredPayload(currentVersion?.rawPayload ?? null) ??
      options?.context ??
      undefined;
    const resultEnvelope = createLegacyReviewResultEnvelope(
      reviewRecord,
      preservedContext?.resultJson
    );

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
          score:
            typeof resultEnvelope.score === 'number'
              ? resultEnvelope.score
              : null,
          maxScore:
            typeof resultEnvelope.maxScore === 'number'
              ? resultEnvelope.maxScore
              : null,
          summary: resultEnvelope.summary ?? null,
          questionBreakdown: asJsonValue(resultEnvelope.questionBreakdown ?? null),
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
    displayName: string | null,
    options?: { context?: LegacyReviewDetailRecord['context'] }
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

    return this.saveReviewRecordByLegacyJobId(jobId, nextReview, options);
  }
}
