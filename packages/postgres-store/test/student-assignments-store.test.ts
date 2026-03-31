import { describe, expect, it } from 'vitest';
import { PrismaStudentAssignmentsStore } from '../src';

const createFakeStudentAssignmentsPrisma = () => {
  const courseRows = new Map<string, Record<string, unknown>>();
  const assignmentRows = new Map<string, Record<string, unknown>>();
  const membershipRows = new Map<string, Record<string, unknown>>();
  const submissionRows = new Map<string, Record<string, unknown>>();
  const publishedResultRows = new Map<string, Record<string, unknown>>();

  let courseSequence = 0;
  let assignmentSequence = 0;
  let membershipSequence = 0;
  let submissionSequence = 0;
  let publishedResultSequence = 0;

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
      )
      .slice(0, 1)
      .map((submission) => ({
        submittedAt: new Date(String(submission.submittedAt)),
        publishedResults: [...publishedResultRows.values()]
          .filter(
            (publishedResult) =>
              publishedResult.submissionId === submission.id &&
              publishedResult.status === 'EFFECTIVE'
          )
          .sort(
            (left, right) =>
              new Date(String(right.publishedAt)).getTime() -
              new Date(String(left.publishedAt)).getTime()
          )
          .slice(0, 1)
          .map((publishedResult) => ({
            domainId: String(publishedResult.domainId),
          })),
      }));

  const buildAssignmentRow = (row: Record<string, unknown>, userId: string) => ({
    domainId: row.domainId,
    title: row.title,
    openAt: new Date(String(row.openAt)),
    deadlineAt: new Date(String(row.deadlineAt)),
    state: row.state,
    createdAt: new Date(String(row.createdAt)),
    updatedAt: new Date(String(row.updatedAt)),
    course: {
      domainId: getCourseByInternalId(String(row.courseId))?.domainId,
    },
    week: {
      domainId: row.weekDomainId,
    },
    exam: {
      domainId: row.examDomainId,
    },
    materials: [
      {
        role: 'PROMPT',
        material: {
          domainId: row.promptMaterialId,
        },
      },
    ],
    submissions: getAssignmentSubmissions(String(row.id), userId),
  });

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

    if (where.state?.not && row.state === where.state.not) {
      return false;
    }

    if (where.openAt?.lte instanceof Date) {
      const openAt = new Date(String(row.openAt));
      if (openAt.getTime() > where.openAt.lte.getTime()) {
        return false;
      }
    }

    const membershipWhere = where.course?.memberships?.some ?? where.course?.is?.memberships?.some;
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

    return true;
  };

  return {
    prisma: {
      assignment: {
        async findMany(args: { where?: Record<string, any>; select?: Record<string, any> }) {
          const userId = String(args.select?.submissions?.where?.studentUserId ?? '');

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
      createdAt?: string;
      updatedAt?: string;
    }) {
      const course = courseRows.get(args.courseId);
      if (!course) {
        throw new Error(`Unknown course: ${args.courseId}`);
      }

      const row = {
        id: `assignment-row-${++assignmentSequence}`,
        state: args.state ?? 'OPEN',
        createdAt: args.createdAt ?? args.openAt,
        updatedAt: args.updatedAt ?? args.openAt,
        weekDomainId: `week:${args.courseId}:default`,
        examDomainId: `exam:${args.domainId}`,
        promptMaterialId: `material:${args.domainId}:prompt`,
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
      };
      publishedResultRows.set(row.domainId, row);
      return row;
    },
  };
};

describe('PrismaStudentAssignmentsStore', () => {
  it('lists open assignments with action flags and hides suspended-course rows', async () => {
    const fake = createFakeStudentAssignmentsPrisma();
    const store = new PrismaStudentAssignmentsStore(fake.prisma as any);

    fake.seedCourse({ domainId: 'course-a', title: 'Course A' });
    fake.seedCourse({ domainId: 'course-b', title: 'Course B' });
    fake.seedMembership({ courseId: 'course-a', userId: 'student-1' });
    fake.seedMembership({ courseId: 'course-b', userId: 'student-1', status: 'SUSPENDED' });

    fake.seedAssignment({
      domainId: 'assignment-open',
      courseId: 'course-a',
      title: 'Open Homework',
      openAt: '2026-03-01T08:00:00.000Z',
      deadlineAt: '2099-03-10T08:00:00.000Z',
    });
    fake.seedAssignment({
      domainId: 'assignment-hidden',
      courseId: 'course-b',
      title: 'Hidden Homework',
      openAt: '2026-03-01T08:00:00.000Z',
      deadlineAt: '2099-03-11T08:00:00.000Z',
    });

    const rows = await store.listStudentAssignments('student-1');

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      assignmentId: 'assignment-open',
      visibleStatus: 'OPEN',
      hasSubmission: false,
      hasPublishedResult: false,
      canSubmit: true,
      canResubmit: false,
      submittedAt: null,
    });
  });

  it('derives submitted and published student states from the latest non-superseded submission', async () => {
    const fake = createFakeStudentAssignmentsPrisma();
    const store = new PrismaStudentAssignmentsStore(fake.prisma as any);

    fake.seedCourse({ domainId: 'course-a', title: 'Course A' });
    fake.seedMembership({ courseId: 'course-a', userId: 'student-1' });

    fake.seedAssignment({
      domainId: 'assignment-submitted',
      courseId: 'course-a',
      title: 'Submitted Homework',
      openAt: '2026-03-01T08:00:00.000Z',
      deadlineAt: '2099-03-10T08:00:00.000Z',
    });
    fake.seedAssignment({
      domainId: 'assignment-published',
      courseId: 'course-a',
      title: 'Published Homework',
      openAt: '2026-03-01T08:00:00.000Z',
      deadlineAt: '2099-03-11T08:00:00.000Z',
    });

    fake.seedSubmission({
      assignmentId: 'assignment-submitted',
      studentUserId: 'student-1',
      submittedAt: '2026-03-02T09:00:00.000Z',
      state: 'QUEUED',
    });
    const publishedSubmission = fake.seedSubmission({
      assignmentId: 'assignment-published',
      studentUserId: 'student-1',
      submittedAt: '2026-03-02T10:00:00.000Z',
      state: 'PROCESSED',
    });
    fake.seedPublishedResult({
      submissionDomainId: publishedSubmission.domainId,
      publishedAt: '2026-03-03T10:00:00.000Z',
    });

    const rows = await store.listStudentAssignments('student-1');

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      assignmentId: 'assignment-submitted',
      visibleStatus: 'SUBMITTED',
      hasSubmission: true,
      hasPublishedResult: false,
      canSubmit: false,
      canResubmit: true,
      submittedAt: '2026-03-02T09:00:00.000Z',
    });
    expect(rows[1]).toMatchObject({
      assignmentId: 'assignment-published',
      visibleStatus: 'PUBLISHED',
      hasSubmission: true,
      hasPublishedResult: true,
      canSubmit: false,
      canResubmit: true,
      submittedAt: '2026-03-02T10:00:00.000Z',
    });
  });

  it('uses the latest non-superseded submission when resubmissions exist', async () => {
    const fake = createFakeStudentAssignmentsPrisma();
    const store = new PrismaStudentAssignmentsStore(fake.prisma as any);

    fake.seedCourse({ domainId: 'course-a', title: 'Course A' });
    fake.seedMembership({ courseId: 'course-a', userId: 'student-1' });

    fake.seedAssignment({
      domainId: 'assignment-resubmit',
      courseId: 'course-a',
      title: 'Resubmit Homework',
      openAt: '2026-03-01T08:00:00.000Z',
      deadlineAt: '2099-03-12T08:00:00.000Z',
    });

    const firstSubmission = fake.seedSubmission({
      assignmentId: 'assignment-resubmit',
      studentUserId: 'student-1',
      submittedAt: '2026-03-02T08:00:00.000Z',
      state: 'SUPERSEDED',
    });
    fake.seedPublishedResult({
      submissionDomainId: firstSubmission.domainId,
      publishedAt: '2026-03-03T08:00:00.000Z',
    });
    fake.seedSubmission({
      assignmentId: 'assignment-resubmit',
      studentUserId: 'student-1',
      submittedAt: '2026-03-04T08:00:00.000Z',
      state: 'QUEUED',
    });

    const row = await store.getStudentAssignment('student-1', 'assignment-resubmit');

    expect(row).toMatchObject({
      assignmentId: 'assignment-resubmit',
      visibleStatus: 'SUBMITTED',
      hasSubmission: true,
      hasPublishedResult: false,
      submittedAt: '2026-03-04T08:00:00.000Z',
      canResubmit: true,
    });
  });
});
