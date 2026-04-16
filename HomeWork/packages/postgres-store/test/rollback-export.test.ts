import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import type { ReviewRecord } from '@hg/shared-schemas';
import { exportRuntimeJobsToLegacyQueue } from '../src';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dirPath) => fs.rm(dirPath, { recursive: true, force: true }))
  );
});

const createTempDir = async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hg-postgres-rollback-export-'));
  tempDirs.push(tempDir);
  return tempDir;
};

const baseReview: ReviewRecord = {
  version: '1.0.0',
  jobId: 'job-pending',
  createdAt: '2026-03-28T10:00:00.000Z',
  updatedAt: '2026-03-28T10:05:00.000Z',
  annotations: [
    {
      id: 'a-1',
      criterionId: 'criterion-1',
      pageIndex: 0,
      bboxNorm: { x: 0, y: 0, w: 0.2, h: 0.2 },
      createdBy: 'human',
      status: 'confirmed',
      createdAt: '2026-03-28T10:00:00.000Z',
      updatedAt: '2026-03-28T10:05:00.000Z',
    },
  ],
};

const createFakePrisma = (rows: any[]) => ({
  gradingJob: {
    async findMany(args?: { where?: Record<string, any> }) {
      const where = args?.where ?? {};
      let filtered = [...rows];

      if (typeof where.domainId === 'string') {
        filtered = filtered.filter((row) => row.domainId === where.domainId);
      }

      const statuses = where.status?.in;
      if (Array.isArray(statuses)) {
        filtered = filtered.filter((row) => statuses.includes(row.status));
      }

      filtered.sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
      return filtered;
    },
  },
});

describe('exportRuntimeJobsToLegacyQueue', () => {
  it('exports pending/running DB jobs to the legacy queue shape and writes the current review only when present', async () => {
    const dataDir = await createTempDir();
    const prisma = createFakePrisma([
      {
        domainId: 'job-pending',
        status: 'PENDING',
        questionId: null,
        submissionMimeType: 'application/pdf',
        gradingMode: 'GENERAL',
        gradingScope: 'DOCUMENT',
        notes: 'pending notes',
        rubricJson: null,
        resultJson: null,
        errorMessage: null,
        createdAt: new Date('2026-03-28T10:00:00.000Z'),
        updatedAt: new Date('2026-03-28T10:01:00.000Z'),
        course: { domainId: 'course-1' },
        exam: { domainId: 'exam-1' },
        examSnapshotAsset: { path: 'C:\\data\\uploads\\exam_job-pending.pdf' },
        submissionAsset: {
          path: 'C:\\data\\uploads\\submission_job-pending.pdf',
          mimeType: 'application/pdf',
        },
        questionAsset: null,
        submission: {
          review: {
            currentVersionId: 'version-1',
            createdAt: new Date('2026-03-28T10:00:00.000Z'),
            updatedAt: new Date('2026-03-28T10:05:00.000Z'),
            versions: [{ id: 'version-1', rawPayload: baseReview }],
          },
        },
      },
      {
        domainId: 'job-running',
        status: 'RUNNING',
        questionId: 'q5',
        submissionMimeType: 'image/png',
        gradingMode: 'RUBRIC',
        gradingScope: 'QUESTION',
        notes: null,
        rubricJson: {
          examId: 'exam-2',
          questionId: 'q5',
          title: 'Rubric Q5',
          criteria: [
            {
              id: 'criterion-1',
              label: 'Correctness',
              kind: 'points',
              maxPoints: 5,
            },
          ],
        },
        resultJson: null,
        errorMessage: null,
        createdAt: new Date('2026-03-28T10:10:00.000Z'),
        updatedAt: new Date('2026-03-28T10:11:00.000Z'),
        course: null,
        exam: { domainId: 'exam-2' },
        examSnapshotAsset: { path: 'C:\\data\\uploads\\exam_job-running.pdf' },
        submissionAsset: {
          path: 'C:\\data\\uploads\\submission_job-running.png',
          mimeType: 'image/png',
        },
        questionAsset: { path: 'C:\\data\\uploads\\question_job-running.png' },
        submission: {
          review: {
            currentVersionId: null,
            createdAt: new Date('2026-03-28T10:10:00.000Z'),
            updatedAt: new Date('2026-03-28T10:11:00.000Z'),
            versions: [],
          },
        },
      },
    ]);

    const summary = await exportRuntimeJobsToLegacyQueue(prisma as any, { dataDir });

    expect(summary).toMatchObject({
      exportedJobs: 2,
      exportedReviews: 1,
      skippedJobs: 0,
      exportedJobIds: ['job-pending', 'job-running'],
      exportedReviewJobIds: ['job-pending'],
      skippedJobIds: [],
    });

    const pendingJob = JSON.parse(
      await fs.readFile(path.join(dataDir, 'jobs', 'pending', 'job-pending.json'), 'utf-8')
    );
    expect(pendingJob).toMatchObject({
      id: 'job-pending',
      status: 'PENDING',
      inputs: {
        courseId: 'course-1',
        examId: 'exam-1',
        questionId: '',
        examFilePath: 'C:\\data\\uploads\\exam_job-pending.pdf',
        submissionFilePath: 'C:\\data\\uploads\\submission_job-pending.pdf',
        submissionMimeType: 'application/pdf',
        notes: 'pending notes',
        gradingMode: 'GENERAL',
        gradingScope: 'DOCUMENT',
      },
    });

    const runningJob = JSON.parse(
      await fs.readFile(path.join(dataDir, 'jobs', 'running', 'job-running.json'), 'utf-8')
    );
    expect(runningJob).toMatchObject({
      id: 'job-running',
      status: 'RUNNING',
      inputs: {
        examId: 'exam-2',
        questionId: 'q5',
        questionFilePath: 'C:\\data\\uploads\\question_job-running.png',
        gradingMode: 'RUBRIC',
        gradingScope: 'QUESTION',
      },
      rubric: {
        examId: 'exam-2',
        questionId: 'q5',
      },
    });

    const review = JSON.parse(
      await fs.readFile(path.join(dataDir, 'reviews', 'job-pending.json'), 'utf-8')
    );
    expect(review).toMatchObject({
      jobId: 'job-pending',
      annotations: baseReview.annotations,
    });

    await expect(
      fs.readFile(path.join(dataDir, 'reviews', 'job-running.json'), 'utf-8')
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('skips DONE/FAILED jobs during rollback export even when a specific jobId is requested', async () => {
    const dataDir = await createTempDir();
    const prisma = createFakePrisma([
      {
        domainId: 'job-done',
        status: 'DONE',
        questionId: 'q1',
        submissionMimeType: 'application/pdf',
        gradingMode: 'RUBRIC',
        gradingScope: 'QUESTION',
        notes: null,
        rubricJson: null,
        resultJson: { mode: 'RUBRIC' },
        errorMessage: null,
        createdAt: new Date('2026-03-28T11:00:00.000Z'),
        updatedAt: new Date('2026-03-28T11:05:00.000Z'),
        course: null,
        exam: { domainId: 'exam-1' },
        examSnapshotAsset: { path: 'C:\\data\\uploads\\exam_job-done.pdf' },
        submissionAsset: {
          path: 'C:\\data\\uploads\\submission_job-done.pdf',
          mimeType: 'application/pdf',
        },
        questionAsset: null,
        submission: {
          review: null,
        },
      },
    ]);

    const summary = await exportRuntimeJobsToLegacyQueue(prisma as any, {
      dataDir,
      jobId: 'job-done',
    });

    expect(summary).toMatchObject({
      requestedJobId: 'job-done',
      exportedJobs: 0,
      exportedReviews: 0,
      skippedJobs: 1,
      skippedJobIds: ['job-done'],
    });
    expect(summary.warningCounts).toMatchObject({
      non_exportable_status: 1,
    });

    await expect(
      fs.readFile(path.join(dataDir, 'jobs', 'done', 'job-done.json'), 'utf-8')
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
