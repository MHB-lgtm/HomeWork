import type { AuditEvent } from '../entities/audit';
import type { GradebookEntry, PublishedResult } from '../entities/publication';
import type { Review, ReviewVersion } from '../entities/review';
import type { PublicationRepository, AuditRepository, ReviewRepository } from '../repositories';
import type { ActorRef } from '../refs';
import { projectGradebookEntry } from '../projections/gradebook';
import { createPublishedSnapshotResultEnvelope } from '../rules/publication';

type PublicationServiceDeps = {
  reviewRepository: ReviewRepository;
  publicationRepository: PublicationRepository;
  auditRepository: AuditRepository;
};

export class PublicationService {
  constructor(private readonly deps: PublicationServiceDeps) {}

  async publish(params: {
    review: Review;
    sourceReviewVersion: ReviewVersion;
    publishedReviewVersion: ReviewVersion;
    publishedResult: PublishedResult;
    actorRef?: ActorRef;
  }): Promise<{ publishedResult: PublishedResult; gradebookEntry: GradebookEntry; auditEvents: AuditEvent[] }> {
    const { review, sourceReviewVersion, publishedReviewVersion, publishedResult, actorRef } = params;

    createPublishedSnapshotResultEnvelope(sourceReviewVersion);

    await this.deps.reviewRepository.appendReviewVersion(publishedReviewVersion);
    await this.deps.reviewRepository.setCurrentReviewVersion(
      review.reviewId,
      publishedReviewVersion.reviewVersionId
    );
    await this.deps.reviewRepository.saveReview({
      ...review,
      currentVersionId: publishedReviewVersion.reviewVersionId,
      state: 'published',
      updatedAt: publishedResult.publishedAt,
    });

    await this.deps.publicationRepository.markPublishedResultsSupersededForSubmission(
      publishedResult.submissionId
    );
    await this.deps.publicationRepository.savePublishedResult(publishedResult);

    const gradebookEntry = projectGradebookEntry(publishedResult);
    await this.deps.publicationRepository.upsertGradebookEntry(gradebookEntry);

    const auditEvents: AuditEvent[] = [
      {
        eventId: `audit:${publishedReviewVersion.reviewVersionId}`,
        aggregateType: 'review',
        aggregateId: review.reviewId,
        eventType: 'review.published_snapshot_created',
        occurredAt: publishedReviewVersion.createdAt,
        actorRef,
        payload: {
          reviewVersionId: publishedReviewVersion.reviewVersionId,
          sourceReviewVersionId: sourceReviewVersion.reviewVersionId,
        },
      },
      {
        eventId: `audit:${publishedResult.publishedResultId}`,
        aggregateType: 'published_result',
        aggregateId: publishedResult.publishedResultId,
        eventType: 'published_result.effective_created',
        occurredAt: publishedResult.publishedAt,
        actorRef,
        payload: {
          reviewId: publishedResult.reviewId,
          sourceReviewVersionId: publishedResult.sourceReviewVersionId,
          submissionId: publishedResult.submissionId,
        },
      },
    ];

    await this.deps.auditRepository.appendAuditEvents(auditEvents);

    return {
      publishedResult,
      gradebookEntry,
      auditEvents,
    };
  }
}
