import type { Assignment } from '@hg/shared-schemas';
import {
  StudentAssignmentResultSchema,
  StudentAssignmentStatusSchema,
} from '@hg/shared-schemas';
import {
  AssignmentState as PrismaAssignmentState,
  Prisma,
  SubmissionState as PrismaSubmissionState,
  type PrismaClient,
} from '@prisma/client';
import { decimalToNumber, toIsoString } from '../mappers/domain';
import type {
  StudentAssignmentResultRecord,
  StudentAssignmentStatusRecord,
} from '../types';
import {
  deriveStudentVisibleAssignmentStatus,
  toLegacyStudentSubmissionState,
} from './lifecycle-status';

type StudentResultsStorePrisma = Pick<PrismaClient, 'assignment'>;

type VisibilityOptions = {
  bypassVisibility?: boolean;
};

type StudentAssignmentRow = {
  domainId: string;
  title: string;
  openAt: Date;
  deadlineAt: Date;
  state: PrismaAssignmentState;
  course: {
    domainId: string;
    title: string;
  };
  submissions: Array<{
    domainId: string;
    submittedAt: Date;
    state: PrismaSubmissionState;
    publishedResults: Array<{
      domainId: string;
      publishedAt: Date;
      finalScore: Parameters<typeof decimalToNumber>[0];
      maxScore: Parameters<typeof decimalToNumber>[0];
      summary: string;
      breakdownSnapshot: unknown;
      gradebookEntry: {
        score: Parameters<typeof decimalToNumber>[0];
        maxScore: Parameters<typeof decimalToNumber>[0];
        publishedAt: Date;
      } | null;
    }>;
  }>;
};

const fromStoredAssignmentState = (
  state: PrismaAssignmentState
): Assignment['state'] => {
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

  throw new Error(`Unsupported stored assignment state: ${state}`);
};

const deriveVisibleStatus = (row: StudentAssignmentRow) => {
  const latestSubmission = row.submissions[0];
  const effectivePublished = latestSubmission?.publishedResults[0];

  return deriveStudentVisibleAssignmentStatus({
    hasPublishedResult: Boolean(effectivePublished),
    hasSubmission: Boolean(latestSubmission),
  });
};

const toPublishedScore = (
  effectivePublished: StudentAssignmentRow['submissions'][number]['publishedResults'][number] | undefined
) => {
  if (!effectivePublished) {
    return null;
  }

  return (
    decimalToNumber(effectivePublished.gradebookEntry?.score) ??
    decimalToNumber(effectivePublished.finalScore) ??
    null
  );
};

const toPublishedMaxScore = (
  effectivePublished: StudentAssignmentRow['submissions'][number]['publishedResults'][number] | undefined
) => {
  if (!effectivePublished) {
    return null;
  }

  return (
    decimalToNumber(effectivePublished.gradebookEntry?.maxScore) ??
    decimalToNumber(effectivePublished.maxScore) ??
    null
  );
};

const toPublishedAt = (
  effectivePublished: StudentAssignmentRow['submissions'][number]['publishedResults'][number] | undefined
) => {
  if (!effectivePublished) {
    return null;
  }

  return toIsoString(effectivePublished.gradebookEntry?.publishedAt ?? effectivePublished.publishedAt);
};

const buildStatusRecord = (
  row: StudentAssignmentRow
): StudentAssignmentStatusRecord => {
  const latestSubmission = row.submissions[0];
  const effectivePublished = latestSubmission?.publishedResults[0];
  const visibleStatus = deriveVisibleStatus(row);

  return StudentAssignmentStatusSchema.parse({
    version: '1.0.0',
    assignmentId: row.domainId,
    courseId: row.course.domainId,
    courseTitle: row.course.title,
    assignmentTitle: row.title,
    openAt: toIsoString(row.openAt),
    deadlineAt: toIsoString(row.deadlineAt),
    assignmentState: fromStoredAssignmentState(row.state),
    visibleStatus,
    submissionState: toLegacyStudentSubmissionState(visibleStatus),
    submittedAt: latestSubmission ? toIsoString(latestSubmission.submittedAt) : null,
    hasPublishedResult: Boolean(effectivePublished),
    publishedAt: toPublishedAt(effectivePublished),
    score: toPublishedScore(effectivePublished),
    maxScore: toPublishedMaxScore(effectivePublished),
  });
};

const buildResultRecord = (
  row: StudentAssignmentRow
): StudentAssignmentResultRecord => {
  const status = buildStatusRecord(row);
  const effectivePublished = row.submissions[0]?.publishedResults[0];

  return StudentAssignmentResultSchema.parse({
    ...status,
    publishedResultId: effectivePublished?.domainId ?? null,
    summary: effectivePublished?.summary ?? null,
    breakdownSnapshot: effectivePublished?.breakdownSnapshot ?? null,
  });
};

const studentSubmissionOrderBy: Prisma.SubmissionOrderByWithRelationInput[] = [
  { submittedAt: 'desc' },
  { createdAt: 'desc' },
];

const buildStudentSubmissionArgs = (
  userId: string
): Prisma.Assignment$submissionsArgs => ({
  where: {
    studentUserId: userId,
    state: {
      not: PrismaSubmissionState.SUPERSEDED,
    },
  },
  orderBy: studentSubmissionOrderBy,
  take: 1,
  select: {
    domainId: true,
    submittedAt: true,
    state: true,
    publishedResults: {
      where: { status: 'EFFECTIVE' },
      orderBy: { publishedAt: 'desc' },
      take: 1,
      select: {
        domainId: true,
        publishedAt: true,
        finalScore: true,
        maxScore: true,
        summary: true,
        breakdownSnapshot: true,
        gradebookEntry: {
          select: {
            score: true,
            maxScore: true,
            publishedAt: true,
          },
        },
      },
    },
  },
});

const createStudentVisibilityWhere = (
  userId: string,
  now: Date,
  options?: VisibilityOptions
): Prisma.AssignmentWhereInput => {
  const activeStudentMembershipClause: Prisma.AssignmentWhereInput = {
    state: {
      not: PrismaAssignmentState.DRAFT,
    },
    openAt: {
      lte: now,
    },
    course: {
      is: {
        memberships: {
          some: {
            userId,
            role: 'STUDENT',
            status: 'ACTIVE',
          },
        },
      },
    },
  };

  if (options?.bypassVisibility) {
    return {
      OR: [
        activeStudentMembershipClause,
        {
          submissions: {
            some: {
              studentUserId: userId,
              state: {
                not: PrismaSubmissionState.SUPERSEDED,
              },
            },
          },
        },
      ],
    };
  }

  return activeStudentMembershipClause;
};

export class PrismaStudentResultsStore {
  constructor(private readonly prisma: StudentResultsStorePrisma) {}

  async listStudentAssignmentResults(
    userId: string,
    options?: VisibilityOptions
  ): Promise<StudentAssignmentStatusRecord[]> {
    const now = new Date();
    const rows = (await this.prisma.assignment.findMany({
      where: createStudentVisibilityWhere(userId, now, options),
      orderBy: [{ deadlineAt: 'asc' }, { createdAt: 'desc' }],
      select: {
        domainId: true,
        title: true,
        openAt: true,
        deadlineAt: true,
        state: true,
        course: {
          select: {
            domainId: true,
            title: true,
          },
        },
        submissions: buildStudentSubmissionArgs(userId),
      },
    })) as unknown as StudentAssignmentRow[];

    return rows
      .filter((row) => row.submissions.length > 0)
      .map(buildStatusRecord);
  }

  async getStudentAssignmentResult(
    userId: string,
    assignmentId: string,
    options?: VisibilityOptions
  ): Promise<StudentAssignmentResultRecord | null> {
    const now = new Date();
    const row = (await this.prisma.assignment.findFirst({
      where: {
        domainId: assignmentId,
        ...createStudentVisibilityWhere(userId, now, options),
      },
      select: {
        domainId: true,
        title: true,
        openAt: true,
        deadlineAt: true,
        state: true,
        course: {
          select: {
            domainId: true,
            title: true,
          },
        },
        submissions: buildStudentSubmissionArgs(userId),
      },
    })) as unknown as StudentAssignmentRow | null;

    return row ? buildResultRecord(row) : null;
  }
}
