import { describe, expect, it } from 'vitest';
import {
  deriveOperationalSubmissionStatus,
  deriveStudentVisibleAssignmentStatus,
  toLegacyStudentSubmissionState,
} from '../src/queries/lifecycle-status';

describe('lifecycle status projection', () => {
  it('maps submission and runtime states to staff operational status', () => {
    expect(
      deriveOperationalSubmissionStatus({
        hasPublishedResult: false,
        hasSubmission: true,
        jobStatus: 'PENDING',
      })
    ).toBe('SUBMITTED');

    expect(
      deriveOperationalSubmissionStatus({
        hasPublishedResult: false,
        hasSubmission: true,
        jobStatus: 'RUNNING',
      })
    ).toBe('PROCESSING');

    expect(
      deriveOperationalSubmissionStatus({
        hasPublishedResult: false,
        hasSubmission: true,
        jobStatus: 'DONE',
      })
    ).toBe('READY_FOR_REVIEW');

    expect(
      deriveOperationalSubmissionStatus({
        hasPublishedResult: false,
        hasSubmission: true,
        submissionState: 'PROCESSED',
      })
    ).toBe('READY_FOR_REVIEW');

    expect(
      deriveOperationalSubmissionStatus({
        hasPublishedResult: false,
        hasSubmission: true,
        reviewState: 'READY_FOR_REVIEW',
      })
    ).toBe('READY_FOR_REVIEW');

    expect(
      deriveOperationalSubmissionStatus({
        hasPublishedResult: true,
        hasSubmission: true,
        jobStatus: 'DONE',
      })
    ).toBe('PUBLISHED');

    expect(
      deriveOperationalSubmissionStatus({
        hasPublishedResult: false,
        hasSubmission: true,
        jobStatus: 'FAILED',
      })
    ).toBe('FAILED');
  });

  it('maps student-safe visibility and legacy compatibility states', () => {
    expect(
      deriveStudentVisibleAssignmentStatus({
        hasPublishedResult: false,
        hasSubmission: false,
      })
    ).toBe('OPEN');
    expect(toLegacyStudentSubmissionState('OPEN')).toBe('NOT_SUBMITTED');

    expect(
      deriveStudentVisibleAssignmentStatus({
        hasPublishedResult: false,
        hasSubmission: true,
      })
    ).toBe('SUBMITTED');
    expect(toLegacyStudentSubmissionState('SUBMITTED')).toBe('SUBMITTED');

    expect(
      deriveStudentVisibleAssignmentStatus({
        hasPublishedResult: true,
        hasSubmission: true,
      })
    ).toBe('PUBLISHED');
    expect(toLegacyStudentSubmissionState('PUBLISHED')).toBe('PUBLISHED');
  });
});
