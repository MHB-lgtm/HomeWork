import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { PrismaJobStore } from '../src';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dirPath) => fs.rm(dirPath, { recursive: true, force: true }))
  );
});

const createTempDir = async () => {
  const dirPath = await fs.mkdtemp(path.join(os.tmpdir(), 'hg-postgres-job-store-'));
  tempDirs.push(dirPath);
  return dirPath;
};

const selectFields = (
  row: Record<string, unknown>,
  select?: Record<string, any>
): Record<string, unknown> => {
  if (!select) {
    return row;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(select)) {
    if (!value) {
      continue;
    }

    if (typeof value === 'object' && value.select && row[key] && typeof row[key] === 'object') {
      result[key] = selectFields(row[key] as Record<string, unknown>, value.select);
      continue;
    }

    result[key] = row[key];
  }

  return result;
};

const createFakeJobPrisma = (options: {
  assignmentId?: string;
  courseId?: string;
  examId?: string;
  examAssetPath: string;
  hasExamIndex?: boolean;
}) => {
  const courseRow = {
    id: 'course-row-1',
    domainId: options.courseId ?? 'course-demo-authz',
  };
  const examRow = {
    id: 'exam-row-1',
    domainId: options.examId ?? 'exam-demo-assignment',
    asset: {
      id: 'asset-row-source',
      path: options.examAssetPath,
      mimeType: 'application/pdf',
      originalName: 'assignment.pdf',
    },
  };
  const assignmentRow = {
    id: 'assignment-row-1',
    domainId: options.assignmentId ?? 'assignment-demo',
    title: 'Demo Assignment',
    openAt: new Date('2026-03-29T08:00:00.000Z'),
    deadlineAt: new Date('2099-03-31T08:00:00.000Z'),
    state: 'OPEN',
    course: courseRow,
    exam: examRow,
  };

  const storedAssets: Array<Record<string, unknown>> = [];
  const submissions: Array<Record<string, unknown>> = [];
  const gradingJobs: Array<Record<string, unknown>> = [];
  let storedAssetSequence = 0;
  let submissionSequence = 0;

  const storedAsset = {
    async create(args: { data: Record<string, unknown>; select?: Record<string, any> }) {
      const row = {
        id: `stored-asset-${++storedAssetSequence}`,
        ...args.data,
      };
      storedAssets.push(row);
      return selectFields(row, args.select);
    },
  };

  const courseMaterial = {
    async create(args: { data: Record<string, unknown>; select?: Record<string, any> }) {
      const row = {
        id: `course-material-${storedAssetSequence}`,
        ...args.data,
      };
      return selectFields(row, args.select);
    },
  };

  const submission = {
    async create(args: { data: Record<string, unknown>; select?: Record<string, any> }) {
      const row = {
        id: `submission-row-${++submissionSequence}`,
        ...args.data,
      };
      submissions.push(row);
      return selectFields(row, args.select);
    },
    async updateMany() {
      return { count: 0 };
    },
  };

  const review = {
    async create(args: { data: Record<string, unknown> }) {
      return args.data;
    },
  };

  const gradingJob = {
    async create(args: { data: Record<string, unknown> }) {
      gradingJobs.push(args.data);
      return args.data;
    },
  };

  const assignment = {
    async findUnique(args: { where: Record<string, unknown>; select?: Record<string, any> }) {
      if (args.where.domainId !== assignmentRow.domainId) {
        return null;
      }

      return selectFields(assignmentRow, args.select);
    },
  };

  const examIndex = {
    async findFirst() {
      return options.hasExamIndex === false ? null : { id: 'exam-index-row-1' };
    },
  };

  return {
    prisma: {
      assignment,
      examIndex,
      storedAsset,
      courseMaterial,
      submission,
      review,
      gradingJob,
      async $transaction<T>(callback: (tx: any) => Promise<T>) {
        return callback({
          assignment,
          examIndex,
          storedAsset,
          courseMaterial,
          submission,
          review,
          gradingJob,
        });
      },
    },
    stores: {
      storedAssets,
      submissions,
      gradingJobs,
      assignmentRow,
      examRow,
    },
  };
};

describe('PrismaJobStore', () => {
  it('creates exam-backed assignment submission jobs without prompt-specific fields', async () => {
    const dataDir = await createTempDir();
    const examAssetPath = path.join(dataDir, 'exams', 'exam-demo-assignment', 'assets', 'assignment.pdf');
    await fs.mkdir(path.dirname(examAssetPath), { recursive: true });
    await fs.writeFile(examAssetPath, 'assignment exam bytes');

    const fake = createFakeJobPrisma({ examAssetPath });
    const store = new PrismaJobStore(fake.prisma as any);

    const result = await store.createAssignmentSubmissionJob({
      dataDir,
      assignmentId: fake.stores.assignmentRow.domainId,
      studentUserId: 'student-user-1',
      submission: {
        originalName: 'submission.pdf',
        buffer: Buffer.from('submission-bytes'),
        mimeType: 'application/pdf',
      },
    });

    expect(result.jobId).toMatch(/^job-/);
    expect(fake.stores.submissions).toHaveLength(1);
    expect(fake.stores.gradingJobs).toHaveLength(1);

    const createdSubmission = fake.stores.submissions[0];
    expect(createdSubmission.studentUserId).toBe('student-user-1');
    expect(createdSubmission.assignmentId).toBe(fake.stores.assignmentRow.domainId);
    expect(createdSubmission.moduleType).toBe('ASSIGNMENT');
    expect(createdSubmission.legacyJobId).toBe(result.jobId);

    const createdJob = fake.stores.gradingJobs[0];
    expect(createdJob.jobKind).toBe('ASSIGNMENT');
    expect(createdJob.assignmentId).toBe(fake.stores.assignmentRow.domainId);
    expect(createdJob.examRowId).toBe(fake.stores.examRow.id);
    expect(createdJob.examSnapshotAssetId).toBeTruthy();
    expect(createdJob.promptAssetId).toBeNull();
    expect(createdJob.referenceSolutionAssetId).toBeNull();
    expect(createdJob.rubricJson).toBeUndefined();
    expect(createdJob.gradingMode).toBe('GENERAL');
    expect(createdJob.gradingScope).toBe('DOCUMENT');

    expect(fake.stores.storedAssets.some((asset) => asset.logicalBucket === 'job_exam_snapshots')).toBe(true);
    expect(fake.stores.storedAssets.some((asset) => asset.logicalBucket === 'job_submissions')).toBe(true);
  });

  it('rejects assignment submission jobs until the backing exam index exists', async () => {
    const dataDir = await createTempDir();
    const examAssetPath = path.join(dataDir, 'exams', 'exam-demo-assignment', 'assets', 'assignment.pdf');
    await fs.mkdir(path.dirname(examAssetPath), { recursive: true });
    await fs.writeFile(examAssetPath, 'assignment exam bytes');

    const fake = createFakeJobPrisma({ examAssetPath, hasExamIndex: false });
    const store = new PrismaJobStore(fake.prisma as any);

    await expect(
      store.createAssignmentSubmissionJob({
        dataDir,
        assignmentId: fake.stores.assignmentRow.domainId,
        studentUserId: 'student-user-1',
        submission: {
          originalName: 'submission.pdf',
          buffer: Buffer.from('submission-bytes'),
          mimeType: 'application/pdf',
        },
      })
    ).rejects.toThrow('Assignment exam index is not ready');
  });
});
