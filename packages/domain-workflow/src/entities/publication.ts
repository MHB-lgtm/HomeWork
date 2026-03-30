import type { CourseId } from './course';
import type { ModuleRef, StudentRef } from '../refs';
import type { GradebookEntryStatus, PublishedResultStatus } from '../states';
import type { ReviewId, ReviewVersionId } from './review';
import type { SubmissionId } from './submission';

export type PublishedResultId = string;
export type GradebookEntryId = string;

export interface PublishedResult {
  publishedResultId: PublishedResultId;
  courseId: CourseId;
  submissionId: SubmissionId;
  studentRef: StudentRef;
  moduleRef: ModuleRef;
  reviewId: ReviewId;
  sourceReviewVersionId: ReviewVersionId;
  publishedAt: string;
  status: PublishedResultStatus;
  finalScore: number;
  maxScore: number;
  summary: string;
  breakdownSnapshot: unknown;
}

export interface GradebookEntry {
  gradebookEntryId: GradebookEntryId;
  courseId: CourseId;
  studentRef: StudentRef;
  moduleRef: ModuleRef;
  publishedResultId: PublishedResultId;
  score: number;
  maxScore: number;
  status: GradebookEntryStatus;
  publishedAt: string;
}
