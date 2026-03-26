import type { CourseId } from './course';
import type { ActorRef } from '../refs';
import type { ReviewState, ReviewVersionKind } from '../states';
import type { ReviewResultEnvelope } from '../result-envelope';
import type { SubmissionId } from './submission';

export type ReviewId = string;
export type ReviewVersionId = string;

export interface Review {
  reviewId: ReviewId;
  courseId: CourseId;
  submissionId: SubmissionId;
  state: ReviewState;
  currentVersionId?: ReviewVersionId;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewVersion {
  reviewVersionId: ReviewVersionId;
  reviewId: ReviewId;
  kind: ReviewVersionKind;
  resultEnvelope: ReviewResultEnvelope;
  createdAt: string;
  actorRef?: ActorRef;
}
