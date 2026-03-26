import type { Review, ReviewVersion } from '../entities/review';
import type { ReviewRepository } from '../repositories';
import { assertCanTransitionReviewState } from '../rules/review';

export class ReviewWorkflowService {
  constructor(private readonly reviewRepository: ReviewRepository) {}

  async appendReviewVersion(review: Review, version: ReviewVersion): Promise<Review> {
    if (review.reviewId !== version.reviewId) {
      throw new Error('ReviewVersion reviewId mismatch');
    }

    await this.reviewRepository.appendReviewVersion(version);
    await this.reviewRepository.setCurrentReviewVersion(review.reviewId, version.reviewVersionId);

    const nextState =
      version.kind === 'lecturer_edit' ? 'lecturer_edited' : 'ready_for_review';

    assertCanTransitionReviewState(review.state, nextState);

    const nextReview: Review = {
      ...review,
      state: nextState,
      currentVersionId: version.reviewVersionId,
      updatedAt: version.createdAt,
    };

    await this.reviewRepository.saveReview(nextReview);
    return nextReview;
  }
}
