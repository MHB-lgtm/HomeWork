import type {
  LegacyJobStatus,
  OperationalSubmissionStatusValue,
  StudentAssignmentSubmissionStateValue,
  StudentVisibleAssignmentStatusValue,
} from '../types';

type OperationalLifecycleArgs = {
  hasPublishedResult: boolean;
  hasSubmission: boolean;
  jobStatus?: LegacyJobStatus | string | null;
  submissionState?: string | null;
  reviewState?: string | null;
};

const READY_REVIEW_STATES = new Set(['READY_FOR_REVIEW', 'LECTURER_EDITED']);
const READY_SUBMISSION_STATES = new Set(['PROCESSED', 'LECTURER_EDITED']);

export const deriveOperationalSubmissionStatus = (
  args: OperationalLifecycleArgs
): OperationalSubmissionStatusValue => {
  if (args.hasPublishedResult) {
    return 'PUBLISHED';
  }

  if (
    (args.reviewState && READY_REVIEW_STATES.has(args.reviewState)) ||
    (args.submissionState && READY_SUBMISSION_STATES.has(args.submissionState)) ||
    args.jobStatus === 'DONE'
  ) {
    return 'READY_FOR_REVIEW';
  }

  if (args.jobStatus === 'RUNNING') {
    return 'PROCESSING';
  }

  if (args.jobStatus === 'FAILED') {
    return 'FAILED';
  }

  if (args.hasSubmission) {
    return 'SUBMITTED';
  }

  return 'SUBMITTED';
};

export const deriveStudentVisibleAssignmentStatus = (args: {
  hasPublishedResult: boolean;
  hasSubmission: boolean;
}): StudentVisibleAssignmentStatusValue => {
  if (args.hasPublishedResult) {
    return 'PUBLISHED';
  }

  if (args.hasSubmission) {
    return 'SUBMITTED';
  }

  return 'OPEN';
};

export const toLegacyStudentSubmissionState = (
  visibleStatus: StudentVisibleAssignmentStatusValue
): StudentAssignmentSubmissionStateValue => {
  switch (visibleStatus) {
    case 'OPEN':
      return 'NOT_SUBMITTED';
    case 'PUBLISHED':
      return 'PUBLISHED';
    case 'SUBMITTED':
      return 'SUBMITTED';
  }
};
