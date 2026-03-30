import type { GradebookEntry, PublishedResult } from '../entities/publication';
import { getModuleRefKey } from '../refs';

export const projectGradebookEntry = (
  publishedResult: PublishedResult
): GradebookEntry => {
  if (publishedResult.status !== 'effective') {
    throw new Error('GradebookEntry can only be projected from an effective PublishedResult');
  }

  return {
    gradebookEntryId: `gradebook:${publishedResult.courseId}:${publishedResult.studentRef}:${getModuleRefKey(
      publishedResult.moduleRef
    )}`,
    courseId: publishedResult.courseId,
    studentRef: publishedResult.studentRef,
    moduleRef: publishedResult.moduleRef,
    publishedResultId: publishedResult.publishedResultId,
    score: publishedResult.finalScore,
    maxScore: publishedResult.maxScore,
    status: 'effective',
    publishedAt: publishedResult.publishedAt,
  };
};
