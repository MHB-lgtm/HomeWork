import type { Submission } from '../entities/submission';
import type { SubmissionState } from '../states';
import { getModuleRefKey } from '../refs';

const allowedSubmissionTransitions: Record<SubmissionState, SubmissionState[]> = {
  uploaded: ['superseded', 'queued'],
  superseded: [],
  queued: ['processed'],
  processed: ['lecturer_edited', 'published'],
  lecturer_edited: ['published'],
  published: [],
};

export const canTransitionSubmissionState = (
  current: SubmissionState,
  next: SubmissionState
): boolean => allowedSubmissionTransitions[current].includes(next);

export const assertCanTransitionSubmissionState = (
  current: SubmissionState,
  next: SubmissionState
): void => {
  if (!canTransitionSubmissionState(current, next)) {
    throw new Error(`Invalid submission transition: ${current} -> ${next}`);
  }
};

export const getLatestEffectiveSubmission = (
  submissions: Submission[],
  studentRef: string,
  moduleRefKey: string
): Submission | null => {
  const candidates = submissions
    .filter(
      (submission) =>
        submission.studentRef === studentRef &&
        getModuleRefKey(submission.moduleRef) === moduleRefKey &&
        submission.state !== 'superseded'
    )
    .sort((left, right) => Date.parse(right.submittedAt) - Date.parse(left.submittedAt));

  return candidates[0] ?? null;
};

export const getSupersededSubmissionIds = (
  submissions: Submission[],
  studentRef: string,
  moduleRefKey: string
): string[] => {
  const ordered = submissions
    .filter(
      (submission) =>
        submission.studentRef === studentRef &&
        getModuleRefKey(submission.moduleRef) === moduleRefKey
    )
    .sort((left, right) => Date.parse(right.submittedAt) - Date.parse(left.submittedAt));

  return ordered.slice(1).map((submission) => submission.submissionId);
};
