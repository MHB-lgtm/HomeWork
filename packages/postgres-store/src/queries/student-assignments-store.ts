import type { Assignment } from '@hg/shared-schemas';
import { StudentAssignmentSchema } from '@hg/shared-schemas';
import {
  AssignmentMaterialRole,
  AssignmentState as PrismaAssignmentState,
  Prisma,
  SubmissionState as PrismaSubmissionState,
  type PrismaClient,
} from '@prisma/client';
import { toIsoString } from '../mappers/domain';
import type { StudentAssignmentRecord } from '../types';
import { deriveStudentVisibleAssignmentStatus } from './lifecycle-status';

type StudentAssignmentsStorePrisma = Pick<PrismaClient, 'assignment'>;

type StudentAssignmentRow = {
  domainId: string;
  title: string;
  openAt: Date;
  deadlineAt: Date;
  state: PrismaAssignmentState;
  createdAt: Date;
  updatedAt: Date;
  course: {
    domainId: string;
  };
  week: {
    domainId: string;
  };
  exam: {
    domainId: string;
  } | null;
  materials: Array<{
    role: AssignmentMaterialRole;
    material: {
      domainId: string;
    };
  }>;
  submissions: Array<{
    submittedAt: Date;
    publishedResults: Array<{
      domainId: string;
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

const resolveMaterialIds = (materials: StudentAssignmentRow['materials']) => {
  let promptMaterialId: string | null = null;
  let solutionMaterialId: string | undefined;

  for (const material of materials) {
    if (material.role === AssignmentMaterialRole.PROMPT) {
      promptMaterialId = material.material.domainId;
    } else if (material.role === AssignmentMaterialRole.REFERENCE_SOLUTION) {
      solutionMaterialId = material.material.domainId;
    }
  }

  if (!promptMaterialId) {
    throw new Error('Assignment prompt material is missing');
  }

  return {
    promptMaterialId,
    solutionMaterialId,
  };
};

const isSubmissionWindowOpen = (row: StudentAssignmentRow, now: Date) =>
  row.state === PrismaAssignmentState.OPEN &&
  row.openAt.getTime() <= now.getTime() &&
  now.getTime() < row.deadlineAt.getTime();

const mapStudentAssignmentRow = (
  row: StudentAssignmentRow,
  now: Date
): StudentAssignmentRecord => {
  if (!row.exam?.domainId) {
    throw new Error(`Assignment backing exam is missing: ${row.domainId}`);
  }

  const latestSubmission = row.submissions[0];
  const hasSubmission = Boolean(latestSubmission);
  const hasPublishedResult = Boolean(latestSubmission?.publishedResults[0]);
  const visibleStatus = deriveStudentVisibleAssignmentStatus({
    hasPublishedResult,
    hasSubmission,
  });
  const submissionWindowOpen = isSubmissionWindowOpen(row, now);
  const materialIds = resolveMaterialIds(row.materials);

  return StudentAssignmentSchema.parse({
    version: '1.0.0',
    assignmentId: row.domainId,
    courseId: row.course.domainId,
    weekId: row.week.domainId,
    examId: row.exam.domainId,
    title: row.title,
    openAt: toIsoString(row.openAt),
    deadlineAt: toIsoString(row.deadlineAt),
    state: fromStoredAssignmentState(row.state),
    promptMaterialId: materialIds.promptMaterialId,
    solutionMaterialId: materialIds.solutionMaterialId,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
    visibleStatus,
    submittedAt: latestSubmission ? toIsoString(latestSubmission.submittedAt) : null,
    hasSubmission,
    hasPublishedResult,
    canSubmit: submissionWindowOpen && !hasSubmission,
    canResubmit: submissionWindowOpen && hasSubmission,
  });
};

const buildVisibleAssignmentsWhere = (
  userId: string,
  now: Date
): Prisma.AssignmentWhereInput => ({
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
});

const buildStudentSubmissionArgs = (userId: string) => ({
  where: {
    studentUserId: userId,
    state: {
      not: PrismaSubmissionState.SUPERSEDED,
    },
  },
  orderBy: [{ submittedAt: 'desc' as const }, { createdAt: 'desc' as const }],
  take: 1,
  select: {
    submittedAt: true,
    publishedResults: {
      where: { status: 'EFFECTIVE' as const },
      orderBy: { publishedAt: 'desc' as const },
      take: 1,
      select: {
        domainId: true,
      },
    },
  },
});

const assignmentSelect = (userId: string) => ({
  domainId: true,
  title: true,
  openAt: true,
  deadlineAt: true,
  state: true,
  createdAt: true,
  updatedAt: true,
  course: { select: { domainId: true } },
  week: { select: { domainId: true } },
  exam: { select: { domainId: true } },
  materials: {
    select: {
      role: true,
      material: {
        select: {
          domainId: true,
        },
      },
    },
  },
  submissions: buildStudentSubmissionArgs(userId),
});

export class PrismaStudentAssignmentsStore {
  constructor(private readonly prisma: StudentAssignmentsStorePrisma) {}

  async listStudentAssignments(userId: string): Promise<StudentAssignmentRecord[]> {
    const now = new Date();
    const rows = (await this.prisma.assignment.findMany({
      where: buildVisibleAssignmentsWhere(userId, now),
      orderBy: [{ deadlineAt: 'asc' }, { createdAt: 'desc' }],
      select: assignmentSelect(userId),
    })) as unknown as StudentAssignmentRow[];

    return rows.map((row) => mapStudentAssignmentRow(row, now));
  }

  async getStudentAssignment(
    userId: string,
    assignmentId: string
  ): Promise<StudentAssignmentRecord | null> {
    const now = new Date();
    const row = (await this.prisma.assignment.findFirst({
      where: {
        ...buildVisibleAssignmentsWhere(userId, now),
        domainId: assignmentId,
      },
      select: assignmentSelect(userId),
    })) as unknown as StudentAssignmentRow | null;

    return row ? mapStudentAssignmentRow(row, now) : null;
  }
}
