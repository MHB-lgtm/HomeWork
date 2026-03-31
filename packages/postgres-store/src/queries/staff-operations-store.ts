import type { Assignment } from '@hg/shared-schemas';
import {
  AssignmentState as PrismaAssignmentState,
  type PrismaClient,
  type Prisma,
} from '@prisma/client';
import { decimalToNumber, toIsoString } from '../mappers/domain';
import type {
  AssignmentSubmissionOpsDetailRecord,
  AssignmentSubmissionOpsRowRecord,
  PublishEligibilityValue,
  StaffDashboardAssignmentRowRecord,
  StaffReviewPublicationSummaryRecord,
} from '../types';
import { deriveOperationalSubmissionStatus } from './lifecycle-status';

type StaffOperationsStorePrisma = Pick<PrismaClient, 'assignment' | 'submission'>;

type StaffAccessOptions = {
  bypassCourseScope?: boolean;
};

type ActiveStudentMembershipRow = {
  userId: string;
};

type EffectivePublicationRow = {
  domainId: string;
  publishedAt: Date;
  finalScore: Parameters<typeof decimalToNumber>[0];
  maxScore: Parameters<typeof decimalToNumber>[0];
  summary: string;
  sourceReviewVersionId: string;
  gradebookEntry: {
    score: Parameters<typeof decimalToNumber>[0];
    maxScore: Parameters<typeof decimalToNumber>[0];
    publishedAt: Date;
  } | null;
};

type AssignmentSubmissionProjectionRow = {
  domainId: string;
  submittedAt: Date;
  state: string;
  legacyJobId: string | null;
  studentUserId: string | null;
  updatedAt: Date;
  studentUser: {
    id: string;
    displayName: string | null;
    normalizedEmail: string | null;
  } | null;
  gradingJob: {
    status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';
    updatedAt: Date;
  } | null;
  review: {
    state: string;
    updatedAt: Date;
    currentVersionId: string | null;
  } | null;
  publishedResults: EffectivePublicationRow[];
};

type StaffAssignmentRow = {
  domainId: string;
  title: string;
  openAt: Date;
  deadlineAt: Date;
  state: PrismaAssignmentState;
  updatedAt: Date;
  course: {
    domainId: string;
    title: string;
    memberships: ActiveStudentMembershipRow[];
  };
  submissions: AssignmentSubmissionProjectionRow[];
};

type StaffSubmissionDetailRow = {
  domainId: string;
  submittedAt: Date;
  state: string;
  legacyJobId: string | null;
  studentUserId: string | null;
  assignment: {
    domainId: string;
    title: string;
    state: PrismaAssignmentState;
    course: {
      domainId: string;
      title: string;
      memberships: ActiveStudentMembershipRow[];
    };
  } | null;
  studentUser: {
    id: string;
    displayName: string | null;
    normalizedEmail: string | null;
  } | null;
  gradingJob: {
    status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';
    updatedAt: Date;
  } | null;
  review: {
    state: string;
    updatedAt: Date;
    currentVersionId: string | null;
  } | null;
  publishedResults: EffectivePublicationRow[];
};

const STAFF_ROLES = ['COURSE_ADMIN', 'LECTURER'] as const;

const ACTIVE_STUDENT_MEMBERSHIP_SELECT = {
  where: {
    role: 'STUDENT',
    status: 'ACTIVE',
  },
  select: {
    userId: true,
  },
} satisfies Prisma.Course$membershipsArgs;

const EFFECTIVE_PUBLISHED_RESULT_SELECT = {
  where: { status: 'EFFECTIVE' },
  orderBy: { publishedAt: 'desc' },
  take: 1,
  select: {
    domainId: true,
    publishedAt: true,
    finalScore: true,
    maxScore: true,
    summary: true,
    sourceReviewVersionId: true,
    gradebookEntry: {
      select: {
        score: true,
        maxScore: true,
        publishedAt: true,
      },
    },
  },
} satisfies Prisma.Submission$publishedResultsArgs;

const SUBMISSION_PROJECTION_SELECT = {
  where: {
    state: {
      not: 'SUPERSEDED',
    },
    studentUserId: {
      not: null,
    },
  },
  orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
  select: {
    domainId: true,
    submittedAt: true,
    state: true,
    legacyJobId: true,
    studentUserId: true,
    updatedAt: true,
    studentUser: {
      select: {
        id: true,
        displayName: true,
        normalizedEmail: true,
      },
    },
    gradingJob: {
      select: {
        status: true,
        updatedAt: true,
      },
    },
    review: {
      select: {
        state: true,
        updatedAt: true,
        currentVersionId: true,
      },
    },
    publishedResults: EFFECTIVE_PUBLISHED_RESULT_SELECT,
  },
} satisfies Prisma.Assignment$submissionsArgs;

const toAssignmentState = (state: PrismaAssignmentState): Assignment['state'] => {
  switch (state) {
    case PrismaAssignmentState.DRAFT:
      return 'draft';
    case PrismaAssignmentState.OPEN:
      return 'open';
    case PrismaAssignmentState.CLOSED:
      return 'closed';
    case PrismaAssignmentState.PROCESSING:
      return 'processing';
    case PrismaAssignmentState.REVIEWED:
      return 'reviewed';
    case PrismaAssignmentState.PUBLISHED:
      return 'published';
  }

  throw new Error(`Unsupported assignment state: ${state}`);
};

const toPublicationSummary = (
  row: EffectivePublicationRow | undefined
): StaffReviewPublicationSummaryRecord | undefined => {
  if (!row) {
    return undefined;
  }

  return {
    isPublished: true,
    publishedResultId: row.domainId,
    publishedAt: toIsoString(row.gradebookEntry?.publishedAt ?? row.publishedAt),
    score: decimalToNumber(row.gradebookEntry?.score) ?? decimalToNumber(row.finalScore) ?? null,
    maxScore:
      decimalToNumber(row.gradebookEntry?.maxScore) ?? decimalToNumber(row.maxScore) ?? null,
    summary: row.summary ?? null,
  };
};

const toPublishEligibility = (args: {
  hasPublishedResult: boolean;
  republishNeeded: boolean;
  operationalStatus: AssignmentSubmissionOpsRowRecord['operationalStatus'];
}): PublishEligibilityValue => {
  if (args.hasPublishedResult && !args.republishNeeded) {
    return 'PUBLISHED';
  }

  if (args.republishNeeded || args.operationalStatus === 'READY_FOR_REVIEW') {
    return 'READY';
  }

  return 'NOT_READY';
};

const sortRowsLatestFirst = <T extends { submittedAt: Date }>(rows: T[]): T[] =>
  [...rows].sort((left, right) => right.submittedAt.getTime() - left.submittedAt.getTime());

const uniqueLatestSubmissionRows = (
  submissions: AssignmentSubmissionProjectionRow[],
  activeStudentIds: Set<string>
): AssignmentSubmissionProjectionRow[] => {
  const seen = new Set<string>();
  const rows: AssignmentSubmissionProjectionRow[] = [];

  for (const submission of sortRowsLatestFirst(submissions)) {
    if (!submission.studentUserId || !activeStudentIds.has(submission.studentUserId)) {
      continue;
    }

    if (seen.has(submission.studentUserId)) {
      continue;
    }

    seen.add(submission.studentUserId);
    rows.push(submission);
  }

  return rows;
};

const toLatestActivityAt = (
  assignmentUpdatedAt: Date,
  row: AssignmentSubmissionProjectionRow
): string => {
  const effectivePublished = row.publishedResults[0];
  const latest = [
    assignmentUpdatedAt.getTime(),
    row.submittedAt.getTime(),
    row.updatedAt.getTime(),
    row.gradingJob?.updatedAt?.getTime() ?? 0,
    row.review?.updatedAt?.getTime() ?? 0,
    effectivePublished?.publishedAt?.getTime() ?? 0,
    effectivePublished?.gradebookEntry?.publishedAt?.getTime() ?? 0,
  ].reduce((max, value) => Math.max(max, value), 0);

  return new Date(latest).toISOString();
};

const buildOpsRow = (args: {
  courseId: string;
  assignmentId: string;
  assignmentState: Assignment['state'];
  submission: AssignmentSubmissionProjectionRow;
}): AssignmentSubmissionOpsRowRecord => {
  if (!args.submission.studentUserId) {
    throw new Error(`Missing student user on submission ${args.submission.domainId}`);
  }

  const effectivePublished = args.submission.publishedResults[0];
  const operationalStatus = deriveOperationalSubmissionStatus({
    hasPublishedResult: Boolean(effectivePublished),
    hasSubmission: true,
    jobStatus: args.submission.gradingJob?.status ?? null,
    submissionState: args.submission.state,
    reviewState: args.submission.review?.state ?? null,
  });
  const republishNeeded = Boolean(
    effectivePublished &&
      args.submission.review?.currentVersionId &&
      args.submission.review.currentVersionId !== effectivePublished.sourceReviewVersionId
  );
  const publication = toPublicationSummary(effectivePublished);

  return {
    version: '1.0.0' as const,
    courseId: args.courseId,
    assignmentId: args.assignmentId,
    submissionId: args.submission.domainId,
    studentUserId: args.submission.studentUserId,
    studentDisplayName: args.submission.studentUser?.displayName ?? null,
    studentEmail: args.submission.studentUser?.normalizedEmail ?? null,
    submittedAt: toIsoString(args.submission.submittedAt),
    operationalStatus,
    publishEligibility: toPublishEligibility({
      hasPublishedResult: Boolean(effectivePublished),
      republishNeeded,
      operationalStatus,
    }),
    republishNeeded,
    jobId: args.submission.legacyJobId ?? null,
    reviewUpdatedAt: args.submission.review
      ? toIsoString(args.submission.review.updatedAt)
      : null,
    publishedAt: publication?.publishedAt ?? null,
    score: publication?.score ?? null,
    maxScore: publication?.maxScore ?? null,
  };
};

const createAccessibleAssignmentWhere = (
  userId: string,
  options?: StaffAccessOptions
): Prisma.AssignmentWhereInput => {
  if (options?.bypassCourseScope) {
    return {};
  }

  return {
    course: {
      memberships: {
        some: {
          userId,
          role: { in: [...STAFF_ROLES] },
          status: 'ACTIVE',
        },
      },
    },
  };
};

export class PrismaStaffOperationsStore {
  constructor(private readonly prisma: StaffOperationsStorePrisma) {}

  async listStaffDashboardAssignments(
    userId: string,
    options?: StaffAccessOptions
  ): Promise<StaffDashboardAssignmentRowRecord[]> {
    const rows = (await this.prisma.assignment.findMany({
      where: createAccessibleAssignmentWhere(userId, options),
      orderBy: [{ deadlineAt: 'asc' }, { createdAt: 'desc' }],
      select: {
        domainId: true,
        title: true,
        openAt: true,
        deadlineAt: true,
        state: true,
        updatedAt: true,
        course: {
          select: {
            domainId: true,
            title: true,
            memberships: ACTIVE_STUDENT_MEMBERSHIP_SELECT,
          },
        },
        submissions: SUBMISSION_PROJECTION_SELECT,
      },
    })) as unknown as StaffAssignmentRow[];

    return rows
      .map((assignment) => {
        const activeStudentIds = new Set(
          assignment.course.memberships.map((membership) => membership.userId)
        );
        const currentRows = uniqueLatestSubmissionRows(
          assignment.submissions,
          activeStudentIds
        ).map((submission) =>
          buildOpsRow({
            courseId: assignment.course.domainId,
            assignmentId: assignment.domainId,
            assignmentState: toAssignmentState(assignment.state),
            submission,
          })
        );

        const latestActivityAt =
          currentRows.length > 0
            ? currentRows.reduce(
                (latest, row) => {
                  const activity = toLatestActivityAt(
                    assignment.updatedAt,
                    assignment.submissions.find(
                      (submission) => submission.domainId === row.submissionId
                    )!
                  );
                  return Date.parse(activity) > Date.parse(latest) ? activity : latest;
                },
                toIsoString(assignment.updatedAt)
              )
            : toIsoString(assignment.updatedAt);

        return {
          version: '1.0.0' as const,
          courseId: assignment.course.domainId,
          courseTitle: assignment.course.title,
          assignmentId: assignment.domainId,
          assignmentTitle: assignment.title,
          assignmentState: toAssignmentState(assignment.state),
          openAt: toIsoString(assignment.openAt),
          deadlineAt: toIsoString(assignment.deadlineAt),
          totalActiveStudents: activeStudentIds.size,
          notSubmittedCount: Math.max(activeStudentIds.size - currentRows.length, 0),
          submittedCount: currentRows.filter((row) => row.operationalStatus === 'SUBMITTED').length,
          processingCount: currentRows.filter((row) => row.operationalStatus === 'PROCESSING').length,
          readyForReviewCount: currentRows.filter(
            (row) => row.operationalStatus === 'READY_FOR_REVIEW'
          ).length,
          publishedCount: currentRows.filter((row) => row.operationalStatus === 'PUBLISHED').length,
          failedCount: currentRows.filter((row) => row.operationalStatus === 'FAILED').length,
          publishableCount: currentRows.filter((row) => row.publishEligibility === 'READY').length,
          republishNeededCount: currentRows.filter((row) => row.republishNeeded).length,
          latestActivityAt,
        };
      })
      .sort(
        (left, right) =>
          Date.parse(right.latestActivityAt) - Date.parse(left.latestActivityAt)
      );
  }

  async listAssignmentSubmissionRows(
    userId: string,
    courseId: string,
    assignmentId: string,
    options?: StaffAccessOptions
  ): Promise<AssignmentSubmissionOpsRowRecord[]> {
    const assignment = (await this.prisma.assignment.findFirst({
      where: {
        domainId: assignmentId,
        course: {
          domainId: courseId,
          ...(options?.bypassCourseScope
            ? {}
            : {
                memberships: {
                  some: {
                    userId,
                    role: { in: [...STAFF_ROLES] },
                    status: 'ACTIVE',
                  },
                },
              }),
        },
      },
      select: {
        domainId: true,
        title: true,
        openAt: true,
        deadlineAt: true,
        state: true,
        updatedAt: true,
        course: {
          select: {
            domainId: true,
            title: true,
            memberships: ACTIVE_STUDENT_MEMBERSHIP_SELECT,
          },
        },
        submissions: SUBMISSION_PROJECTION_SELECT,
      },
    })) as unknown as StaffAssignmentRow | null;

    if (!assignment) {
      return [];
    }

    const activeStudentIds = new Set(
      assignment.course.memberships.map((membership) => membership.userId)
    );

    return uniqueLatestSubmissionRows(assignment.submissions, activeStudentIds)
      .map((submission) =>
        buildOpsRow({
          courseId: assignment.course.domainId,
          assignmentId: assignment.domainId,
          assignmentState: toAssignmentState(assignment.state),
          submission,
        })
      )
      .sort((left, right) => Date.parse(right.submittedAt) - Date.parse(left.submittedAt));
  }

  async getAssignmentSubmissionDetail(
    userId: string,
    courseId: string,
    assignmentId: string,
    submissionId: string,
    options?: StaffAccessOptions
  ): Promise<AssignmentSubmissionOpsDetailRecord | null> {
    const row = (await this.prisma.submission.findFirst({
      where: {
        domainId: submissionId,
        assignmentId,
        state: {
          not: 'SUPERSEDED',
        },
        assignment: {
          course: {
            domainId: courseId,
            ...(options?.bypassCourseScope
              ? {}
              : {
                  memberships: {
                    some: {
                      userId,
                      role: { in: [...STAFF_ROLES] },
                      status: 'ACTIVE',
                    },
                  },
                }),
          },
        },
      },
      select: {
        domainId: true,
        submittedAt: true,
        state: true,
        legacyJobId: true,
        studentUserId: true,
        assignment: {
          select: {
            domainId: true,
            title: true,
            state: true,
            course: {
              select: {
                domainId: true,
                title: true,
                memberships: ACTIVE_STUDENT_MEMBERSHIP_SELECT,
              },
            },
          },
        },
        studentUser: {
          select: {
            id: true,
            displayName: true,
            normalizedEmail: true,
          },
        },
        gradingJob: {
          select: {
            status: true,
            updatedAt: true,
          },
        },
        review: {
          select: {
            state: true,
            updatedAt: true,
            currentVersionId: true,
          },
        },
        publishedResults: EFFECTIVE_PUBLISHED_RESULT_SELECT,
      },
    })) as unknown as StaffSubmissionDetailRow | null;

    if (!row?.assignment || !row.studentUserId || !row.legacyJobId) {
      return null;
    }

    const activeStudentIds = new Set(
      row.assignment.course.memberships.map((membership) => membership.userId)
    );
    if (!activeStudentIds.has(row.studentUserId)) {
      return null;
    }

    const baseRow = buildOpsRow({
      courseId: row.assignment.course.domainId,
      assignmentId: row.assignment.domainId,
      assignmentState: toAssignmentState(row.assignment.state),
      submission: {
        domainId: row.domainId,
        submittedAt: row.submittedAt,
        state: row.state,
        legacyJobId: row.legacyJobId,
        studentUserId: row.studentUserId,
        updatedAt: row.review?.updatedAt ?? row.submittedAt,
        studentUser: row.studentUser,
        gradingJob: row.gradingJob,
        review: row.review,
        publishedResults: row.publishedResults,
      },
    });
    const publication = toPublicationSummary(row.publishedResults[0]);

    return {
      ...baseRow,
      courseTitle: row.assignment.course.title,
      assignmentTitle: row.assignment.title,
      reviewLink: `/reviews/${row.legacyJobId}`,
      submissionDownloadLink: `/api/reviews/${row.legacyJobId}/submission-raw`,
      publication,
      rawStatuses: {
        assignmentState: toAssignmentState(row.assignment.state),
        submissionState: row.state,
        jobStatus: row.gradingJob?.status ?? null,
        reviewState: row.review?.state ?? null,
      },
    };
  }
}
