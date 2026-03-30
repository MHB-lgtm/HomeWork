import type { Review, ReviewRepository, ReviewVersion } from '@hg/domain-workflow';
import type { PrismaClient } from '@prisma/client';
import {
  actorRefFromStoredValues,
  asJsonValue,
  decimalToNumber,
  fromPrismaReviewState,
  fromPrismaReviewVersionKind,
  toDate,
  toIsoString,
  toPrismaReviewState,
  toPrismaReviewVersionKind,
} from '../mappers/domain';
import { requireCourseRow, requireReviewRow, requireSubmissionRow } from './shared';

export class PrismaReviewRepository implements ReviewRepository {
  constructor(
    private readonly prisma: Pick<
      PrismaClient,
      'course' | 'submission' | 'review' | 'reviewVersion'
    >
  ) {}

  async getReview(reviewId: string): Promise<Review | null> {
    const row = await this.prisma.review.findUnique({
      where: { domainId: reviewId },
      include: {
        course: { select: { domainId: true } },
        submission: { select: { domainId: true } },
      },
    });

    if (!row) {
      return null;
    }

    const currentVersion =
      row.currentVersionId
        ? await this.prisma.reviewVersion.findUnique({
            where: { id: row.currentVersionId },
            select: { domainId: true },
          })
        : null;

    return {
      reviewId: row.domainId,
      courseId: row.course.domainId,
      submissionId: row.submission.domainId,
      state: fromPrismaReviewState(row.state),
      currentVersionId: currentVersion?.domainId,
      createdAt: toIsoString(row.createdAt),
      updatedAt: toIsoString(row.updatedAt),
    };
  }

  async getReviewBySubmissionId(submissionId: string): Promise<Review | null> {
    const row = await this.prisma.review.findFirst({
      where: { submission: { domainId: submissionId } },
      include: {
        course: { select: { domainId: true } },
        submission: { select: { domainId: true } },
      },
    });

    if (!row) {
      return null;
    }

    const currentVersion =
      row.currentVersionId
        ? await this.prisma.reviewVersion.findUnique({
            where: { id: row.currentVersionId },
            select: { domainId: true },
          })
        : null;

    return {
      reviewId: row.domainId,
      courseId: row.course.domainId,
      submissionId: row.submission.domainId,
      state: fromPrismaReviewState(row.state),
      currentVersionId: currentVersion?.domainId,
      createdAt: toIsoString(row.createdAt),
      updatedAt: toIsoString(row.updatedAt),
    };
  }

  async saveReview(review: Review): Promise<void> {
    const [course, submission] = await Promise.all([
      requireCourseRow(this.prisma, review.courseId),
      requireSubmissionRow(this.prisma, review.submissionId),
    ]);

    const currentVersion = review.currentVersionId
      ? await this.prisma.reviewVersion.findUnique({
          where: { domainId: review.currentVersionId },
          select: { id: true },
        })
      : null;

    await this.prisma.review.upsert({
      where: { domainId: review.reviewId },
      create: {
        domainId: review.reviewId,
        courseId: course.id,
        submissionId: submission.id,
        currentVersionId: currentVersion?.id ?? null,
        state: toPrismaReviewState(review.state),
        createdAt: toDate(review.createdAt),
        updatedAt: toDate(review.updatedAt),
      },
      update: {
        courseId: course.id,
        submissionId: submission.id,
        currentVersionId: currentVersion?.id ?? null,
        state: toPrismaReviewState(review.state),
        updatedAt: toDate(review.updatedAt),
      },
    });
  }

  async appendReviewVersion(reviewVersion: ReviewVersion): Promise<void> {
    const review = await requireReviewRow(this.prisma, reviewVersion.reviewId);

    await this.prisma.reviewVersion.upsert({
      where: { domainId: reviewVersion.reviewVersionId },
      create: {
        domainId: reviewVersion.reviewVersionId,
        reviewId: review.id,
        kind: toPrismaReviewVersionKind(reviewVersion.kind),
        actorUserId:
          reviewVersion.actorRef?.startsWith('user:')
            ? reviewVersion.actorRef.slice('user:'.length)
            : null,
        actorKind: reviewVersion.actorRef === 'ai' ? 'AI' : 'LEGACY',
        actorRefRaw:
          reviewVersion.actorRef && reviewVersion.actorRef !== 'ai'
            ? reviewVersion.actorRef.replace(/^legacy:/, '')
            : null,
        score:
          typeof reviewVersion.resultEnvelope.score === 'number'
            ? reviewVersion.resultEnvelope.score
            : null,
        maxScore:
          typeof reviewVersion.resultEnvelope.maxScore === 'number'
            ? reviewVersion.resultEnvelope.maxScore
            : null,
        summary: reviewVersion.resultEnvelope.summary ?? null,
        questionBreakdown: asJsonValue(reviewVersion.resultEnvelope.questionBreakdown ?? null),
        rawPayload: asJsonValue(reviewVersion.resultEnvelope.rawPayload),
        flagsJson: asJsonValue(reviewVersion.resultEnvelope.flags ?? null),
        createdAt: toDate(reviewVersion.createdAt),
      },
      update: {
        kind: toPrismaReviewVersionKind(reviewVersion.kind),
        actorUserId:
          reviewVersion.actorRef?.startsWith('user:')
            ? reviewVersion.actorRef.slice('user:'.length)
            : null,
        actorKind: reviewVersion.actorRef === 'ai' ? 'AI' : 'LEGACY',
        actorRefRaw:
          reviewVersion.actorRef && reviewVersion.actorRef !== 'ai'
            ? reviewVersion.actorRef.replace(/^legacy:/, '')
            : null,
        score:
          typeof reviewVersion.resultEnvelope.score === 'number'
            ? reviewVersion.resultEnvelope.score
            : null,
        maxScore:
          typeof reviewVersion.resultEnvelope.maxScore === 'number'
            ? reviewVersion.resultEnvelope.maxScore
            : null,
        summary: reviewVersion.resultEnvelope.summary ?? null,
        questionBreakdown: asJsonValue(reviewVersion.resultEnvelope.questionBreakdown ?? null),
        rawPayload: asJsonValue(reviewVersion.resultEnvelope.rawPayload),
        flagsJson: asJsonValue(reviewVersion.resultEnvelope.flags ?? null),
        createdAt: toDate(reviewVersion.createdAt),
      },
    });
  }

  async listReviewVersions(reviewId: string): Promise<ReviewVersion[]> {
    const rows = await this.prisma.reviewVersion.findMany({
      where: { review: { domainId: reviewId } },
      orderBy: { createdAt: 'asc' },
    });

    return rows.map((row) => ({
      reviewVersionId: row.domainId,
      reviewId,
      kind: fromPrismaReviewVersionKind(row.kind),
      resultEnvelope: {
        rawPayload: row.rawPayload,
        score: decimalToNumber(row.score),
        maxScore: decimalToNumber(row.maxScore),
        summary: row.summary ?? undefined,
        questionBreakdown: row.questionBreakdown ?? undefined,
        flags: undefined,
      },
      createdAt: toIsoString(row.createdAt),
      actorRef: actorRefFromStoredValues(row.actorUserId, row.actorKind, row.actorRefRaw),
    }));
  }

  async setCurrentReviewVersion(reviewId: string, reviewVersionId: string): Promise<void> {
    const [review, reviewVersion] = await Promise.all([
      requireReviewRow(this.prisma, reviewId),
      this.prisma.reviewVersion.findUnique({
        where: { domainId: reviewVersionId },
        select: { id: true },
      }),
    ]);

    if (!reviewVersion) {
      throw new Error(`ReviewVersion not found for domain id "${reviewVersionId}"`);
    }

    await this.prisma.review.update({
      where: { id: review.id },
      data: { currentVersionId: reviewVersion.id },
    });
  }
}
