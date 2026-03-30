import { describe, expect, it } from 'vitest';
import { PrismaStudentResultsStore } from '../src';

const createFakeStudentResultsPrisma = () => {
  const courseRows = new Map<string, Record<string, unknown>>();
  const assignmentRows = new Map<string, Record<string, unknown>>();
  const membershipRows = new Map<string, Record<string, unknown>>();
  const submissionRows = new Map<string, Record<string, unknown>>();
  const publishedResultRows = new Map<string, Record<string, unknown>>();
  const gradebookRows = new Map<string, Record<string, unknown>>();

  let courseSequence = 0;
  let assignmentSequence = 0;
  let membershipSequence = 0;
  let submissionSequence = 0;
  let publishedResultSequence = 0;
  let gradebookSequence = 0;

  const getCourseByInternalId = (courseId: string) =>
    [...courseRows.values()].find((row) => row.id === courseId) ?? null;

  const getAssignmentSubmissions = (assignmentInternalId: string, userId: string) =>
    [...submissionRows.values()]
      .filter(
        (row) =>
          row.assignmentInternalId === assignmentInternalId &&
          row.studentUserId === userId &&
          row.state !== 'SUPERSEDED'
      )
      .sort(
        (left, right) =>
          new Date(String(right.submittedAt)).getTime() -
          new Date(String(left.submittedAt)).getTime()
      );

  const buildAssignmentRow = (row: Record<string, unknown>, userId: string) => {
    const course = getCourseByInternalId(String(row.courseId));
    const submissions = getAssignmentSubmissions(String(row.id), userId).map((submission) => {
      const publishedResults = [...publishedResultRows.values()]
        .filter(
          (publishedResult) =>
            publishedResult.submissionId === submission.id && publishedResult.status === 'EFFECTIVE'
        )
        .sort(
          (left, right) =>
            new Date(String(right.publishedAt)).getTime() -
            new Date(String(left.publishedAt)).getTime()
        )
        .slice(0, 1)
        .map((publishedResult) => {
          const gradebookEntry =
            [...gradebookRows.values()].find(
              (entry) => entry.publishedResultId === publishedResult.id
            ) ?? null;

          return {
            domainId: publishedResult.domainId,
            publishedAt: new Date(String(publishedResult.publishedAt)),
            finalScore: publishedResult.finalScore,
            maxScore: publishedResult.maxScore,
            summary: publishedResult.summary,
            breakdownSnapshot: publishedResult.breakdownSnapshot,
            gradebookEntry: gradebookEntry
              ? {
                  score: gradebookEntry.score,
                  maxScore: gradebookEntry.maxScore,
                  publishedAt: new Date(String(gradebookEntry.publishedAt)),
                }
              : null,
          };
        });

      return {
        domainId: submission.domainId,
        submittedAt: new Date(String(submission.submittedAt)),
        state: submission.state,
        publishedResults,
      };
    });

    return {
      domainId: row.domainId,
      title: row.title,
      openAt: new Date(String(row.openAt)),
      deadlineAt: new Date(String(row.deadlineAt)),
      state: row.state,
      course: {
        domainId: course?.domainId,
        title: course?.title,
      },
      submissions,
    };
  };

  const matchesWhere = (
    row: Record<string, unknown>,
    where: Record<string, any> | undefined
  ): boolean => {
    if (!where) {
      return true;
    }

    if (typeof where.domainId === 'string' && row.domainId !== where.domainId) {
      return false;
    }

    if (Array.isArray(where.OR)) {
      const matchesAnyClause = where.OR.some((clause) => matchesWhere(row, clause));
      if (!matchesAnyClause) {
        return false;
      }
    }

    if (where.state?.not && row.state === where.state.not) {
      return false;
    }

    if (where.openAt?.lte instanceof Date) {
      const openAt = new Date(String(row.openAt));
      if (openAt.getTime() > where.openAt.lte.getTime()) {
        return false;
      }
    }

    const membershipWhere =
      where.course?.memberships?.some ?? where.course?.is?.memberships?.some;
    if (membershipWhere) {
      const hasMembership = [...membershipRows.values()].some(
        (membership) =>
          membership.courseId === row.courseId &&
          membership.userId === membershipWhere.userId &&
          membership.role === membershipWhere.role &&
          membership.status === membershipWhere.status
      );

      if (!hasMembership) {
        return false;
      }
    }

    if (where.submissions?.some) {
      const submissionWhere = where.submissions.some;
      const hasSubmission = [...submissionRows.values()].some(
        (submission) =>
          submission.assignmentInternalId === row.id &&
          submission.studentUserId === submissionWhere.studentUserId &&
          submission.state !== submissionWhere.state?.not
      );

      if (!hasSubmission) {
        return false;
      }
    }

    return true;
  };

  return {
    prisma: {
      assignment: {
        async findMany(args: { where?: Record<string, any>; select?: Record<string, any> }) {
          const submissionWhere = args.select?.submissions?.where;
          const userId = String(submissionWhere?.studentUserId ?? '');

          return [...assignmentRows.values()]
            .filter((row) => matchesWhere(row, args.where))
            .sort(
              (left, right) =>
                new Date(String(left.deadlineAt)).getTime() -
                new Date(String(right.deadlineAt)).getTime()
            )
            .map((row) => buildAssignmentRow(row, userId));
        },
        async findFirst(args: { where?: Record<string, any>; select?: Record<string, any> }) {
          const rows = await this.findMany(args);
          return rows[0] ?? null;
        },
      },
    },
    seedCourse(args: { domainId: string; title: string }) {
      const row = {
        id: `course-row-${++courseSequence}`,
        ...args,
      };
      courseRows.set(args.domainId, row);
      return row;
    },
    seedAssignment(args: {
      domainId: string;
      courseId: string;
      title: string;
      openAt: string;
      deadlineAt: string;
      state?: string;
    }) {
      const course = courseRows.get(args.courseId);
      if (!course) {
        throw new Error(`Unknown course: ${args.courseId}`);
      }

      const row = {
        id: `assignment-row-${++assignmentSequence}`,
        state: args.state ?? 'OPEN',
        ...args,
        courseId: course.id,
      };
      assignmentRows.set(args.domainId, row);
      return row;
    },
    seedMembership(args: {
      courseId: string;
      userId: string;
      role?: string;
      status?: string;
    }) {
      const course = courseRows.get(args.courseId);
      if (!course) {
        throw new Error(`Unknown course: ${args.courseId}`);
      }

      const row = {
        id: `membership-row-${++membershipSequence}`,
        courseId: course.id,
        userId: args.userId,
        role: args.role ?? 'STUDENT',
        status: args.status ?? 'ACTIVE',
      };
      membershipRows.set(row.id, row);
      return row;
    },
    seedSubmission(args: {
      assignmentId: string;
      studentUserId: string;
      submittedAt: string;
      state?: string;
    }) {
      const assignment = assignmentRows.get(args.assignmentId);
      if (!assignment) {
        throw new Error(`Unknown assignment: ${args.assignmentId}`);
      }

      const row = {
        id: `submission-row-${++submissionSequence}`,
        domainId: `submission:${args.assignmentId}:${submissionSequence}`,
        assignmentInternalId: assignment.id,
        studentUserId: args.studentUserId,
        submittedAt: args.submittedAt,
        state: args.state ?? 'QUEUED',
      };
      submissionRows.set(row.domainId, row);
      return row;
    },
    seedPublishedResult(args: {
      submissionDomainId: string;
      publishedAt: string;
      score: number;
      maxScore: number;
      summary: string;
      breakdownSnapshot: unknown;
    }) {
      const submission = submissionRows.get(args.submissionDomainId);
      if (!submission) {
        throw new Error(`Unknown submission: ${args.submissionDomainId}`);
      }

      const row = {
        id: `published-result-row-${++publishedResultSequence}`,
        domainId: `published:${submission.domainId}:${publishedResultSequence}`,
        submissionId: submission.id,
        status: 'EFFECTIVE',
        publishedAt: args.publishedAt,
        finalScore: args.score,
        maxScore: args.maxScore,
        summary: args.summary,
        breakdownSnapshot: args.breakdownSnapshot,
      };
      publishedResultRows.set(row.domainId, row);
      return row;
    },
    seedGradebookEntry(args: {
      publishedResultDomainId: string;
      score: number;
      maxScore: number;
      publishedAt: string;
    }) {
      const publishedResult = publishedResultRows.get(args.publishedResultDomainId);
      if (!publishedResult) {
        throw new Error(`Unknown published result: ${args.publishedResultDomainId}`);
      }

      const row = {
        id: `gradebook-row-${++gradebookSequence}`,
        domainId: `gradebook:${gradebookSequence}`,
        publishedResultId: publishedResult.id,
        score: args.score,
        maxScore: args.maxScore,
        publishedAt: args.publishedAt,
      };
      gradebookRows.set(row.domainId, row);
      return row;
    },
  };
};

describe('PrismaStudentResultsStore', () => {
  it('lists only own visible assignment results and keeps status-only rows before publish', async () => {
    const fake = createFakeStudentResultsPrisma();
    const store = new PrismaStudentResultsStore(fake.prisma as any);

    fake.seedCourse({ domainId: 'course-a', title: 'Course A' });
    fake.seedCourse({ domainId: 'course-b', title: 'Course B' });

    fake.seedMembership({ courseId: 'course-a', userId: 'student-1' });
    fake.seedMembership({ courseId: 'course-a', userId: 'student-2' });
    fake.seedMembership({ courseId: 'course-b', userId: 'student-1', status: 'SUSPENDED' });

    const publishedAssignment = fake.seedAssignment({
      domainId: 'assignment-published',
      courseId: 'course-a',
      title: 'Published Homework',
      openAt: '2026-03-01T08:00:00.000Z',
      deadlineAt: '2099-03-10T08:00:00.000Z',
      state: 'OPEN',
    });
    const submittedAssignment = fake.seedAssignment({
      domainId: 'assignment-submitted',
      courseId: 'course-a',
      title: 'Submitted Homework',
      openAt: '2026-03-01T08:00:00.000Z',
      deadlineAt: '2099-03-11T08:00:00.000Z',
      state: 'OPEN',
    });
    fake.seedAssignment({
      domainId: 'assignment-not-submitted',
      courseId: 'course-a',
      title: 'Waiting Homework',
      openAt: '2026-03-01T08:00:00.000Z',
      deadlineAt: '2099-03-12T08:00:00.000Z',
      state: 'OPEN',
    });
    const hiddenSuspendedAssignment = fake.seedAssignment({
      domainId: 'assignment-hidden',
      courseId: 'course-b',
      title: 'Hidden Homework',
      openAt: '2026-03-01T08:00:00.000Z',
      deadlineAt: '2099-03-13T08:00:00.000Z',
      state: 'OPEN',
    });

    const publishedSubmission = fake.seedSubmission({
      assignmentId: publishedAssignment.domainId,
      studentUserId: 'student-1',
      submittedAt: '2026-03-02T09:00:00.000Z',
      state: 'PROCESSED',
    });
    const publishedResult = fake.seedPublishedResult({
      submissionDomainId: publishedSubmission.domainId,
      publishedAt: '2026-03-03T09:00:00.000Z',
      score: 88,
      maxScore: 100,
      summary: 'Strong published result',
      breakdownSnapshot: [{ questionId: 'q1' }],
    });
    fake.seedGradebookEntry({
      publishedResultDomainId: publishedResult.domainId,
      score: 88,
      maxScore: 100,
      publishedAt: '2026-03-03T09:00:00.000Z',
    });

    fake.seedSubmission({
      assignmentId: submittedAssignment.domainId,
      studentUserId: 'student-1',
      submittedAt: '2026-03-02T10:00:00.000Z',
      state: 'QUEUED',
    });

    fake.seedSubmission({
      assignmentId: submittedAssignment.domainId,
      studentUserId: 'student-2',
      submittedAt: '2026-03-02T11:00:00.000Z',
      state: 'PROCESSED',
    });

    fake.seedSubmission({
      assignmentId: hiddenSuspendedAssignment.domainId,
      studentUserId: 'student-1',
      submittedAt: '2026-03-02T12:00:00.000Z',
      state: 'PROCESSED',
    });

    const results = await store.listStudentAssignmentResults('student-1');

    expect(results).toHaveLength(3);
    expect(results.map((result) => result.assignmentId)).toEqual([
      'assignment-published',
      'assignment-submitted',
      'assignment-not-submitted',
    ]);
    expect(results.map((result) => result.submissionState)).toEqual([
      'PUBLISHED',
      'SUBMITTED',
      'NOT_SUBMITTED',
    ]);
    expect(results[0]).toMatchObject({
      assignmentId: 'assignment-published',
      submissionState: 'PUBLISHED',
      hasPublishedResult: true,
      score: 88,
      maxScore: 100,
    });
    expect(results[1]).toMatchObject({
      assignmentId: 'assignment-submitted',
      submissionState: 'SUBMITTED',
      hasPublishedResult: false,
      score: null,
      maxScore: null,
    });
    expect(results[2]).toMatchObject({
      assignmentId: 'assignment-not-submitted',
      submissionState: 'NOT_SUBMITTED',
      hasPublishedResult: false,
      submittedAt: null,
    });
  });

  it('returns published breakdown only for the current student result', async () => {
    const fake = createFakeStudentResultsPrisma();
    const store = new PrismaStudentResultsStore(fake.prisma as any);

    fake.seedCourse({ domainId: 'course-a', title: 'Course A' });
    fake.seedMembership({ courseId: 'course-a', userId: 'student-1' });
    fake.seedMembership({ courseId: 'course-a', userId: 'student-2' });

    const assignment = fake.seedAssignment({
      domainId: 'assignment-1',
      courseId: 'course-a',
      title: 'Homework 1',
      openAt: '2026-03-01T08:00:00.000Z',
      deadlineAt: '2099-03-10T08:00:00.000Z',
      state: 'OPEN',
    });
    const studentOneSubmission = fake.seedSubmission({
      assignmentId: assignment.domainId,
      studentUserId: 'student-1',
      submittedAt: '2026-03-02T09:00:00.000Z',
      state: 'PROCESSED',
    });
    const studentOnePublished = fake.seedPublishedResult({
      submissionDomainId: studentOneSubmission.domainId,
      publishedAt: '2026-03-03T09:00:00.000Z',
      score: 91,
      maxScore: 100,
      summary: 'Clear and correct work.',
      breakdownSnapshot: [
        {
          questionId: 'q1',
          overallSummary: 'Good answer with one minor issue.',
          findings: [{ findingId: 'q1-f1', title: 'Minor issue' }],
        },
      ],
    });
    fake.seedGradebookEntry({
      publishedResultDomainId: studentOnePublished.domainId,
      score: 91,
      maxScore: 100,
      publishedAt: '2026-03-03T09:00:00.000Z',
    });

    const otherSubmission = fake.seedSubmission({
      assignmentId: assignment.domainId,
      studentUserId: 'student-2',
      submittedAt: '2026-03-02T10:00:00.000Z',
      state: 'PROCESSED',
    });
    const otherPublished = fake.seedPublishedResult({
      submissionDomainId: otherSubmission.domainId,
      publishedAt: '2026-03-03T10:00:00.000Z',
      score: 50,
      maxScore: 100,
      summary: 'Other student result',
      breakdownSnapshot: [{ questionId: 'q1' }],
    });
    fake.seedGradebookEntry({
      publishedResultDomainId: otherPublished.domainId,
      score: 50,
      maxScore: 100,
      publishedAt: '2026-03-03T10:00:00.000Z',
    });

    const result = await store.getStudentAssignmentResult('student-1', assignment.domainId);

    expect(result).toMatchObject({
      assignmentId: 'assignment-1',
      submissionState: 'PUBLISHED',
      publishedResultId: studentOnePublished.domainId,
      summary: 'Clear and correct work.',
      score: 91,
      maxScore: 100,
    });
    expect(result?.breakdownSnapshot).toEqual([
      {
        questionId: 'q1',
        overallSummary: 'Good answer with one minor issue.',
        findings: [{ findingId: 'q1-f1', title: 'Minor issue' }],
      },
    ]);
  });

  it('can bypass visibility for historical reads without exposing unpublished content', async () => {
    const fake = createFakeStudentResultsPrisma();
    const store = new PrismaStudentResultsStore(fake.prisma as any);

    fake.seedCourse({ domainId: 'course-a', title: 'Course A' });
    fake.seedMembership({ courseId: 'course-a', userId: 'student-1', status: 'SUSPENDED' });

    const assignment = fake.seedAssignment({
      domainId: 'assignment-1',
      courseId: 'course-a',
      title: 'Homework 1',
      openAt: '2026-03-01T08:00:00.000Z',
      deadlineAt: '2099-03-10T08:00:00.000Z',
      state: 'CLOSED',
    });
    const submission = fake.seedSubmission({
      assignmentId: assignment.domainId,
      studentUserId: 'student-1',
      submittedAt: '2026-03-02T09:00:00.000Z',
      state: 'PROCESSED',
    });
    const published = fake.seedPublishedResult({
      submissionDomainId: submission.domainId,
      publishedAt: '2026-03-03T09:00:00.000Z',
      score: 77,
      maxScore: 100,
      summary: 'Historical result',
      breakdownSnapshot: [{ questionId: 'q1' }],
    });
    fake.seedGradebookEntry({
      publishedResultDomainId: published.domainId,
      score: 77,
      maxScore: 100,
      publishedAt: '2026-03-03T09:00:00.000Z',
    });

    await expect(store.getStudentAssignmentResult('student-1', assignment.domainId)).resolves.toBeNull();
    await expect(
      store.getStudentAssignmentResult('student-1', assignment.domainId, {
        bypassVisibility: true,
      })
    ).resolves.toMatchObject({
      assignmentId: 'assignment-1',
      submissionState: 'PUBLISHED',
      score: 77,
      summary: 'Historical result',
    });
  });
});
