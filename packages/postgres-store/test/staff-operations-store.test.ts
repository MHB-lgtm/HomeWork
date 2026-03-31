import { describe, expect, it } from 'vitest';
import { PrismaStaffOperationsStore } from '../src';

const createFakeStaffOperationsPrisma = () => {
  const courseRows = new Map<string, Record<string, unknown>>();
  const assignmentRows = new Map<string, Record<string, unknown>>();
  const membershipRows = new Map<string, Record<string, unknown>>();
  const submissionRows = new Map<string, Record<string, unknown>>();
  const userRows = new Map<string, Record<string, unknown>>();
  const jobRows = new Map<string, Record<string, unknown>>();
  const reviewRows = new Map<string, Record<string, unknown>>();
  const publishedRows = new Map<string, Record<string, unknown>>();
  const gradebookRows = new Map<string, Record<string, unknown>>();

  let courseSequence = 0;
  let assignmentSequence = 0;
  let membershipSequence = 0;
  let submissionSequence = 0;
  let publishedSequence = 0;
  let gradebookSequence = 0;

  const getCourseByInternalId = (courseId: string) =>
    [...courseRows.values()].find((row) => row.id === courseId) ?? null;

  const getAssignmentByInternalId = (assignmentId: string) =>
    [...assignmentRows.values()].find((row) => row.id === assignmentId) ?? null;

  const getAssignmentByDomainId = (assignmentId: string) =>
    assignmentRows.get(assignmentId) ?? null;

  const hasStaffMembership = (
    courseInternalId: string,
    staffWhere: Record<string, unknown> | undefined
  ) => {
    if (!staffWhere) {
      return true;
    }

    return [...membershipRows.values()].some(
      (membership) =>
        membership.courseId === courseInternalId &&
        membership.userId === staffWhere.userId &&
        (staffWhere.status ? membership.status === staffWhere.status : true) &&
        (Array.isArray(staffWhere.role?.in)
          ? staffWhere.role.in.includes(membership.role)
          : membership.role === staffWhere.role)
    );
  };

  const buildPublishedRows = (submissionInternalId: string) =>
    [...publishedRows.values()]
      .filter(
        (published) =>
          published.submissionId === submissionInternalId && published.status === 'EFFECTIVE'
      )
      .sort(
        (left, right) =>
          new Date(String(right.publishedAt)).getTime() -
          new Date(String(left.publishedAt)).getTime()
      )
      .slice(0, 1)
      .map((published) => {
        const gradebookEntry =
          [...gradebookRows.values()].find(
            (entry) => entry.publishedResultId === published.id
          ) ?? null;

        return {
          domainId: published.domainId,
          publishedAt: new Date(String(published.publishedAt)),
          finalScore: published.finalScore,
          maxScore: published.maxScore,
          summary: published.summary,
          sourceReviewVersionId: published.sourceReviewVersionId,
          gradebookEntry: gradebookEntry
            ? {
                score: gradebookEntry.score,
                maxScore: gradebookEntry.maxScore,
                publishedAt: new Date(String(gradebookEntry.publishedAt)),
              }
            : null,
        };
      });

  const buildSubmissionProjection = (submissionRow: Record<string, unknown>) => {
    const studentUser = userRows.get(String(submissionRow.studentUserId)) ?? null;
    const gradingJob =
      [...jobRows.values()].find((job) => job.submissionId === submissionRow.id) ?? null;
    const review =
      [...reviewRows.values()].find((item) => item.submissionId === submissionRow.id) ?? null;

    return {
      domainId: submissionRow.domainId,
      submittedAt: new Date(String(submissionRow.submittedAt)),
      state: submissionRow.state,
      legacyJobId: submissionRow.legacyJobId,
      studentUserId: submissionRow.studentUserId,
      updatedAt: new Date(String(submissionRow.updatedAt ?? submissionRow.submittedAt)),
      studentUser: studentUser
        ? {
            id: studentUser.id,
            displayName: studentUser.displayName ?? null,
            normalizedEmail: studentUser.normalizedEmail ?? null,
          }
        : null,
      gradingJob: gradingJob
        ? {
            status: gradingJob.status,
            updatedAt: new Date(String(gradingJob.updatedAt ?? submissionRow.submittedAt)),
          }
        : null,
      review: review
        ? {
            state: review.state,
            updatedAt: new Date(String(review.updatedAt)),
            currentVersionId: review.currentVersionId ?? null,
          }
        : null,
      publishedResults: buildPublishedRows(String(submissionRow.id)),
    };
  };

  const buildAssignmentProjection = (assignmentRow: Record<string, unknown>) => {
    const course = getCourseByInternalId(String(assignmentRow.courseId));
    const activeStudentMemberships = [...membershipRows.values()]
      .filter(
        (membership) =>
          membership.courseId === assignmentRow.courseId &&
          membership.role === 'STUDENT' &&
          membership.status === 'ACTIVE'
      )
      .map((membership) => ({
        userId: membership.userId,
      }));

    const submissions = [...submissionRows.values()]
      .filter(
        (submission) =>
          submission.assignmentInternalId === assignmentRow.id &&
          submission.state !== 'SUPERSEDED' &&
          submission.studentUserId != null
      )
      .sort(
        (left, right) =>
          new Date(String(right.submittedAt)).getTime() -
          new Date(String(left.submittedAt)).getTime()
      )
      .map(buildSubmissionProjection);

    return {
      domainId: assignmentRow.domainId,
      title: assignmentRow.title,
      openAt: new Date(String(assignmentRow.openAt)),
      deadlineAt: new Date(String(assignmentRow.deadlineAt)),
      state: assignmentRow.state,
      updatedAt: new Date(String(assignmentRow.updatedAt)),
      course: {
        domainId: course?.domainId,
        title: course?.title,
        memberships: activeStudentMemberships,
      },
      submissions,
    };
  };

  const matchesAssignmentWhere = (
    assignmentRow: Record<string, unknown>,
    where: Record<string, any> | undefined
  ): boolean => {
    if (!where) {
      return true;
    }

    if (typeof where.domainId === 'string' && assignmentRow.domainId !== where.domainId) {
      return false;
    }

    if (where.course?.domainId) {
      const course = getCourseByInternalId(String(assignmentRow.courseId));
      if (course?.domainId !== where.course.domainId) {
        return false;
      }
    }

    const staffWhere = where.course?.memberships?.some;
    if (staffWhere && !hasStaffMembership(String(assignmentRow.courseId), staffWhere)) {
      return false;
    }

    return true;
  };

  const matchesSubmissionWhere = (
    submissionRow: Record<string, unknown>,
    where: Record<string, any> | undefined
  ): boolean => {
    if (!where) {
      return true;
    }

    if (typeof where.domainId === 'string' && submissionRow.domainId !== where.domainId) {
      return false;
    }

    if (typeof where.assignmentId === 'string' && submissionRow.assignmentId !== where.assignmentId) {
      return false;
    }

    if (where.state?.not && submissionRow.state === where.state.not) {
      return false;
    }

    if (where.assignment?.course?.domainId || where.assignment?.course?.memberships?.some) {
      const assignment = getAssignmentByInternalId(String(submissionRow.assignmentInternalId));
      if (!assignment) {
        return false;
      }

      const course = getCourseByInternalId(String(assignment.courseId));
      if (where.assignment.course.domainId && course?.domainId !== where.assignment.course.domainId) {
        return false;
      }

      const staffWhere = where.assignment.course.memberships?.some;
      if (staffWhere && !hasStaffMembership(String(assignment.courseId), staffWhere)) {
        return false;
      }
    }

    return true;
  };

  return {
    prisma: {
      assignment: {
        async findMany(args: { where?: Record<string, any> }) {
          return [...assignmentRows.values()]
            .filter((row) => matchesAssignmentWhere(row, args.where))
            .sort(
              (left, right) =>
                new Date(String(left.deadlineAt)).getTime() -
                new Date(String(right.deadlineAt)).getTime()
            )
            .map(buildAssignmentProjection);
        },
        async findFirst(args: { where?: Record<string, any> }) {
          const rows = await this.findMany(args);
          return rows[0] ?? null;
        },
      },
      submission: {
        async findFirst(args: { where?: Record<string, any> }) {
          const row = [...submissionRows.values()].find((submission) =>
            matchesSubmissionWhere(submission, args.where)
          );
          if (!row) {
            return null;
          }

          const assignment = getAssignmentByInternalId(String(row.assignmentInternalId));
          const course = assignment ? getCourseByInternalId(String(assignment.courseId)) : null;
          const activeStudentMemberships = [...membershipRows.values()]
            .filter(
              (membership) =>
                membership.courseId === assignment?.courseId &&
                membership.role === 'STUDENT' &&
                membership.status === 'ACTIVE'
            )
            .map((membership) => ({
              userId: membership.userId,
            }));
          const studentUser = row.studentUserId ? userRows.get(String(row.studentUserId)) : null;
          const gradingJob =
            [...jobRows.values()].find((job) => job.submissionId === row.id) ?? null;
          const review =
            [...reviewRows.values()].find((item) => item.submissionId === row.id) ?? null;

          return {
            domainId: row.domainId,
            submittedAt: new Date(String(row.submittedAt)),
            state: row.state,
            legacyJobId: row.legacyJobId,
            studentUserId: row.studentUserId,
            assignment: assignment && course
              ? {
                  domainId: assignment.domainId,
                  title: assignment.title,
                  state: assignment.state,
                  course: {
                    domainId: course.domainId,
                    title: course.title,
                    memberships: activeStudentMemberships,
                  },
                }
              : null,
            studentUser: studentUser
              ? {
                  id: studentUser.id,
                  displayName: studentUser.displayName ?? null,
                  normalizedEmail: studentUser.normalizedEmail ?? null,
                }
              : null,
            gradingJob: gradingJob
              ? {
                  status: gradingJob.status,
                }
              : null,
            review: review
              ? {
                  state: review.state,
                  updatedAt: new Date(String(review.updatedAt)),
                  currentVersionId: review.currentVersionId ?? null,
                }
              : null,
            publishedResults: buildPublishedRows(String(row.id)),
          };
        },
      },
    },
    seedUser(args: { id: string; displayName?: string | null; normalizedEmail?: string | null }) {
      userRows.set(args.id, {
        id: args.id,
        displayName: args.displayName ?? null,
        normalizedEmail: args.normalizedEmail ?? null,
      });
    },
    seedCourse(args: { domainId: string; title: string }) {
      const row = {
        id: `course-row-${++courseSequence}`,
        domainId: args.domainId,
        title: args.title,
      };
      courseRows.set(args.domainId, row);
      return row;
    },
    seedMembership(args: {
      courseId: string;
      userId: string;
      role: string;
      status?: string;
    }) {
      const course = courseRows.get(args.courseId);
      if (!course) throw new Error(`Unknown course: ${args.courseId}`);

      const row = {
        id: `membership-row-${++membershipSequence}`,
        courseId: course.id,
        userId: args.userId,
        role: args.role,
        status: args.status ?? 'ACTIVE',
      };
      membershipRows.set(row.id, row);
      return row;
    },
    seedAssignment(args: {
      domainId: string;
      courseId: string;
      title: string;
      openAt: string;
      deadlineAt: string;
      state?: string;
      updatedAt?: string;
    }) {
      const course = courseRows.get(args.courseId);
      if (!course) throw new Error(`Unknown course: ${args.courseId}`);

      const row = {
        id: `assignment-row-${++assignmentSequence}`,
        domainId: args.domainId,
        title: args.title,
        courseId: course.id,
        openAt: args.openAt,
        deadlineAt: args.deadlineAt,
        state: args.state ?? 'OPEN',
        updatedAt: args.updatedAt ?? args.openAt,
      };
      assignmentRows.set(args.domainId, row);
      return row;
    },
    seedSubmission(args: {
      assignmentId: string;
      studentUserId: string;
      submittedAt: string;
      state?: string;
      legacyJobId?: string | null;
      updatedAt?: string;
    }) {
      const assignment = assignmentRows.get(args.assignmentId);
      if (!assignment) throw new Error(`Unknown assignment: ${args.assignmentId}`);

      const row = {
        id: `submission-row-${++submissionSequence}`,
        domainId: `submission:${args.assignmentId}:${submissionSequence}`,
        assignmentInternalId: assignment.id,
        assignmentId: assignment.domainId,
        studentUserId: args.studentUserId,
        submittedAt: args.submittedAt,
        state: args.state ?? 'QUEUED',
        legacyJobId: args.legacyJobId ?? `job:${submissionSequence}`,
        updatedAt: args.updatedAt ?? args.submittedAt,
      };
      submissionRows.set(row.domainId, row);
      return row;
    },
    seedJob(args: { submissionDomainId: string; status: string; updatedAt?: string }) {
      const submission = submissionRows.get(args.submissionDomainId);
      if (!submission) throw new Error(`Unknown submission: ${args.submissionDomainId}`);

      const row = {
        id: `job-row:${submission.id}`,
        submissionId: submission.id,
        status: args.status,
        updatedAt: args.updatedAt ?? submission.updatedAt,
      };
      jobRows.set(String(submission.domainId), row);
      return row;
    },
    seedReview(args: {
      submissionDomainId: string;
      state: string;
      currentVersionId?: string | null;
      updatedAt: string;
    }) {
      const submission = submissionRows.get(args.submissionDomainId);
      if (!submission) throw new Error(`Unknown submission: ${args.submissionDomainId}`);

      const row = {
        id: `review-row:${submission.id}`,
        submissionId: submission.id,
        state: args.state,
        currentVersionId: args.currentVersionId ?? null,
        updatedAt: args.updatedAt,
      };
      reviewRows.set(String(submission.domainId), row);
      return row;
    },
    seedPublishedResult(args: {
      submissionDomainId: string;
      publishedAt: string;
      score: number;
      maxScore: number;
      summary: string;
      sourceReviewVersionId: string;
    }) {
      const submission = submissionRows.get(args.submissionDomainId);
      if (!submission) throw new Error(`Unknown submission: ${args.submissionDomainId}`);

      const row = {
        id: `published-row-${++publishedSequence}`,
        domainId: `published:${submission.domainId}:${publishedSequence}`,
        submissionId: submission.id,
        status: 'EFFECTIVE',
        publishedAt: args.publishedAt,
        finalScore: args.score,
        maxScore: args.maxScore,
        summary: args.summary,
        sourceReviewVersionId: args.sourceReviewVersionId,
      };
      publishedRows.set(row.domainId, row);
      return row;
    },
    seedGradebookEntry(args: {
      publishedResultDomainId: string;
      score: number;
      maxScore: number;
      publishedAt: string;
    }) {
      const published = publishedRows.get(args.publishedResultDomainId);
      if (!published) throw new Error(`Unknown published result: ${args.publishedResultDomainId}`);

      const row = {
        id: `gradebook-row-${++gradebookSequence}`,
        domainId: `gradebook:${gradebookSequence}`,
        publishedResultId: published.id,
        score: args.score,
        maxScore: args.maxScore,
        publishedAt: args.publishedAt,
      };
      gradebookRows.set(row.domainId, row);
      return row;
    },
  };
};

describe('PrismaStaffOperationsStore', () => {
  it('builds assignment-first dashboard aggregates for accessible courses only', async () => {
    const fake = createFakeStaffOperationsPrisma();
    const store = new PrismaStaffOperationsStore(fake.prisma as any);

    fake.seedUser({ id: 'staff-1' });
    fake.seedUser({ id: 'student-1', displayName: 'Student One', normalizedEmail: 'student1@example.com' });
    fake.seedUser({ id: 'student-2', displayName: 'Student Two', normalizedEmail: 'student2@example.com' });
    fake.seedUser({ id: 'student-3', displayName: 'Student Three', normalizedEmail: 'student3@example.com' });

    fake.seedCourse({ domainId: 'course-a', title: 'Course A' });
    fake.seedCourse({ domainId: 'course-b', title: 'Course B' });
    fake.seedMembership({ courseId: 'course-a', userId: 'staff-1', role: 'LECTURER' });
    fake.seedMembership({ courseId: 'course-a', userId: 'student-1', role: 'STUDENT' });
    fake.seedMembership({ courseId: 'course-a', userId: 'student-2', role: 'STUDENT' });
    fake.seedMembership({ courseId: 'course-a', userId: 'student-3', role: 'STUDENT' });

    const assignmentOne = fake.seedAssignment({
      domainId: 'assignment-1',
      courseId: 'course-a',
      title: 'Homework 1',
      openAt: '2026-03-01T08:00:00.000Z',
      deadlineAt: '2099-03-10T08:00:00.000Z',
      updatedAt: '2026-03-01T08:00:00.000Z',
    });
    fake.seedAssignment({
      domainId: 'assignment-2',
      courseId: 'course-a',
      title: 'Homework 2',
      openAt: '2026-03-02T08:00:00.000Z',
      deadlineAt: '2099-03-11T08:00:00.000Z',
      updatedAt: '2026-03-02T08:00:00.000Z',
    });
    fake.seedAssignment({
      domainId: 'assignment-hidden',
      courseId: 'course-b',
      title: 'Hidden Homework',
      openAt: '2026-03-03T08:00:00.000Z',
      deadlineAt: '2099-03-12T08:00:00.000Z',
    });

    const publishedSubmission = fake.seedSubmission({
      assignmentId: assignmentOne.domainId,
      studentUserId: 'student-1',
      submittedAt: '2026-03-02T09:00:00.000Z',
      state: 'PROCESSED',
      legacyJobId: 'job-published',
    });
    fake.seedJob({
      submissionDomainId: publishedSubmission.domainId,
      status: 'DONE',
      updatedAt: '2026-03-02T09:10:00.000Z',
    });
    fake.seedReview({
      submissionDomainId: publishedSubmission.domainId,
      state: 'READY_FOR_REVIEW',
      currentVersionId: 'rv-published',
      updatedAt: '2026-03-02T09:15:00.000Z',
    });
    const publishedResult = fake.seedPublishedResult({
      submissionDomainId: publishedSubmission.domainId,
      publishedAt: '2026-03-03T09:00:00.000Z',
      score: 94,
      maxScore: 100,
      summary: 'Published',
      sourceReviewVersionId: 'rv-published',
    });
    fake.seedGradebookEntry({
      publishedResultDomainId: publishedResult.domainId,
      score: 94,
      maxScore: 100,
      publishedAt: '2026-03-03T09:00:00.000Z',
    });

    const readySubmission = fake.seedSubmission({
      assignmentId: assignmentOne.domainId,
      studentUserId: 'student-2',
      submittedAt: '2026-03-02T10:00:00.000Z',
      state: 'PROCESSED',
      legacyJobId: 'job-ready',
    });
    fake.seedJob({
      submissionDomainId: readySubmission.domainId,
      status: 'DONE',
      updatedAt: '2026-03-02T10:10:00.000Z',
    });
    fake.seedReview({
      submissionDomainId: readySubmission.domainId,
      state: 'READY_FOR_REVIEW',
      currentVersionId: 'rv-ready',
      updatedAt: '2026-03-02T10:15:00.000Z',
    });

    const processingSubmission = fake.seedSubmission({
      assignmentId: 'assignment-2',
      studentUserId: 'student-1',
      submittedAt: '2026-03-03T10:00:00.000Z',
      state: 'QUEUED',
      legacyJobId: 'job-processing',
    });
    fake.seedJob({
      submissionDomainId: processingSubmission.domainId,
      status: 'RUNNING',
      updatedAt: '2026-03-03T10:05:00.000Z',
    });
    fake.seedReview({
      submissionDomainId: processingSubmission.domainId,
      state: 'DRAFT',
      currentVersionId: null,
      updatedAt: '2026-03-03T10:05:00.000Z',
    });

    const republishSubmission = fake.seedSubmission({
      assignmentId: 'assignment-2',
      studentUserId: 'student-2',
      submittedAt: '2026-03-03T11:00:00.000Z',
      state: 'LECTURER_EDITED',
      legacyJobId: 'job-republish',
    });
    fake.seedJob({
      submissionDomainId: republishSubmission.domainId,
      status: 'DONE',
      updatedAt: '2026-03-03T11:10:00.000Z',
    });
    fake.seedReview({
      submissionDomainId: republishSubmission.domainId,
      state: 'LECTURER_EDITED',
      currentVersionId: 'rv-newer',
      updatedAt: '2026-03-03T11:15:00.000Z',
    });
    const republishResult = fake.seedPublishedResult({
      submissionDomainId: republishSubmission.domainId,
      publishedAt: '2026-03-03T11:05:00.000Z',
      score: 81,
      maxScore: 100,
      summary: 'Published but stale',
      sourceReviewVersionId: 'rv-older',
    });
    fake.seedGradebookEntry({
      publishedResultDomainId: republishResult.domainId,
      score: 81,
      maxScore: 100,
      publishedAt: '2026-03-03T11:05:00.000Z',
    });

    const rows = await store.listStaffDashboardAssignments('staff-1');

    expect(rows).toHaveLength(2);
    const first = rows.find((row) => row.assignmentId === 'assignment-2');
    const second = rows.find((row) => row.assignmentId === 'assignment-1');

    expect(first).toMatchObject({
      assignmentId: 'assignment-2',
      totalActiveStudents: 3,
      notSubmittedCount: 1,
      submittedCount: 0,
      processingCount: 1,
      readyForReviewCount: 0,
      publishedCount: 1,
      failedCount: 0,
      publishableCount: 1,
      republishNeededCount: 1,
    });
    expect(second).toMatchObject({
      assignmentId: 'assignment-1',
      totalActiveStudents: 3,
      notSubmittedCount: 1,
      submittedCount: 0,
      processingCount: 0,
      readyForReviewCount: 1,
      publishedCount: 1,
      failedCount: 0,
      publishableCount: 1,
      republishNeededCount: 0,
    });
  });

  it('lists only current non-superseded submission rows for an accessible assignment', async () => {
    const fake = createFakeStaffOperationsPrisma();
    const store = new PrismaStaffOperationsStore(fake.prisma as any);

    fake.seedUser({ id: 'staff-1' });
    fake.seedUser({ id: 'student-1', displayName: 'Student One', normalizedEmail: 'student1@example.com' });
    fake.seedUser({ id: 'student-2', displayName: 'Student Two', normalizedEmail: 'student2@example.com' });
    fake.seedCourse({ domainId: 'course-a', title: 'Course A' });
    fake.seedCourse({ domainId: 'course-b', title: 'Course B' });
    fake.seedMembership({ courseId: 'course-a', userId: 'staff-1', role: 'COURSE_ADMIN' });
    fake.seedMembership({ courseId: 'course-a', userId: 'student-1', role: 'STUDENT' });
    fake.seedMembership({ courseId: 'course-a', userId: 'student-2', role: 'STUDENT' });

    fake.seedAssignment({
      domainId: 'assignment-1',
      courseId: 'course-a',
      title: 'Homework 1',
      openAt: '2026-03-01T08:00:00.000Z',
      deadlineAt: '2099-03-10T08:00:00.000Z',
    });

    fake.seedSubmission({
      assignmentId: 'assignment-1',
      studentUserId: 'student-1',
      submittedAt: '2026-03-02T08:00:00.000Z',
      state: 'SUPERSEDED',
      legacyJobId: 'job-old',
    });
    const currentSubmission = fake.seedSubmission({
      assignmentId: 'assignment-1',
      studentUserId: 'student-1',
      submittedAt: '2026-03-02T09:00:00.000Z',
      state: 'QUEUED',
      legacyJobId: 'job-current',
    });
    fake.seedJob({
      submissionDomainId: currentSubmission.domainId,
      status: 'RUNNING',
      updatedAt: '2026-03-02T09:05:00.000Z',
    });
    fake.seedReview({
      submissionDomainId: currentSubmission.domainId,
      state: 'DRAFT',
      updatedAt: '2026-03-02T09:05:00.000Z',
    });

    const readySubmission = fake.seedSubmission({
      assignmentId: 'assignment-1',
      studentUserId: 'student-2',
      submittedAt: '2026-03-02T10:00:00.000Z',
      state: 'PROCESSED',
      legacyJobId: 'job-ready',
    });
    fake.seedJob({
      submissionDomainId: readySubmission.domainId,
      status: 'DONE',
      updatedAt: '2026-03-02T10:05:00.000Z',
    });
    fake.seedReview({
      submissionDomainId: readySubmission.domainId,
      state: 'READY_FOR_REVIEW',
      currentVersionId: 'rv-ready',
      updatedAt: '2026-03-02T10:06:00.000Z',
    });

    const rows = await store.listAssignmentSubmissionRows(
      'staff-1',
      'course-a',
      'assignment-1'
    );

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.submissionId)).toEqual([
      readySubmission.domainId,
      currentSubmission.domainId,
    ]);
    expect(rows.map((row) => row.operationalStatus)).toEqual([
      'READY_FOR_REVIEW',
      'PROCESSING',
    ]);
    expect(rows.map((row) => row.publishEligibility)).toEqual([
      'READY',
      'NOT_READY',
    ]);

    await expect(
      store.listAssignmentSubmissionRows('staff-1', 'course-b', 'assignment-1')
    ).resolves.toEqual([]);
  });

  it('returns submission detail with publication and republish state, including super-admin bypass', async () => {
    const fake = createFakeStaffOperationsPrisma();
    const store = new PrismaStaffOperationsStore(fake.prisma as any);

    fake.seedUser({ id: 'super-admin' });
    fake.seedUser({ id: 'student-1', displayName: 'Student One', normalizedEmail: 'student1@example.com' });
    fake.seedCourse({ domainId: 'course-a', title: 'Course A' });
    fake.seedMembership({ courseId: 'course-a', userId: 'student-1', role: 'STUDENT' });
    fake.seedAssignment({
      domainId: 'assignment-1',
      courseId: 'course-a',
      title: 'Homework 1',
      openAt: '2026-03-01T08:00:00.000Z',
      deadlineAt: '2099-03-10T08:00:00.000Z',
      state: 'OPEN',
    });

    const submission = fake.seedSubmission({
      assignmentId: 'assignment-1',
      studentUserId: 'student-1',
      submittedAt: '2026-03-02T09:00:00.000Z',
      state: 'LECTURER_EDITED',
      legacyJobId: 'job-1',
    });
    fake.seedJob({
      submissionDomainId: submission.domainId,
      status: 'DONE',
      updatedAt: '2026-03-02T09:10:00.000Z',
    });
    fake.seedReview({
      submissionDomainId: submission.domainId,
      state: 'LECTURER_EDITED',
      currentVersionId: 'rv-new',
      updatedAt: '2026-03-02T09:15:00.000Z',
    });
    const published = fake.seedPublishedResult({
      submissionDomainId: submission.domainId,
      publishedAt: '2026-03-02T09:05:00.000Z',
      score: 87,
      maxScore: 100,
      summary: 'Published summary',
      sourceReviewVersionId: 'rv-old',
    });
    fake.seedGradebookEntry({
      publishedResultDomainId: published.domainId,
      score: 87,
      maxScore: 100,
      publishedAt: '2026-03-02T09:05:00.000Z',
    });

    await expect(
      store.getAssignmentSubmissionDetail(
        'staff-without-access',
        'course-a',
        'assignment-1',
        submission.domainId
      )
    ).resolves.toBeNull();

    await expect(
      store.getAssignmentSubmissionDetail(
        'super-admin',
        'course-a',
        'assignment-1',
        submission.domainId,
        { bypassCourseScope: true }
      )
    ).resolves.toMatchObject({
      assignmentId: 'assignment-1',
      submissionId: submission.domainId,
      operationalStatus: 'PUBLISHED',
      publishEligibility: 'READY',
      republishNeeded: true,
      reviewLink: '/reviews/job-1',
      submissionDownloadLink: '/api/reviews/job-1/submission-raw',
      publication: {
        isPublished: true,
        score: 87,
        maxScore: 100,
        summary: 'Published summary',
      },
      rawStatuses: {
        assignmentState: 'open',
        submissionState: 'LECTURER_EDITED',
        jobStatus: 'DONE',
        reviewState: 'LECTURER_EDITED',
      },
    });
  });
});
