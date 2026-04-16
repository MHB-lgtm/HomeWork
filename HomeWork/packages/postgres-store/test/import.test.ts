import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import type { ReviewRecord } from '@hg/shared-schemas';
import {
  reviewContextFromStoredPayload,
  importFileBackedData,
  PLACEHOLDER_COURSE_DOMAIN_ID,
} from '../src';
import {
  deriveReviewStateFromLegacy,
  deriveSubmissionStateFromLegacy,
  getCourseDomainIdForLegacyJob,
  getGradebookEntryDomainId,
  getImportedReviewVersionDomainId,
  getPublishedResultDomainId,
  getSubmissionDomainId,
} from '../src/mappers/import';

const aiReview: ReviewRecord = {
  version: '1.0.0',
  jobId: 'job-1',
  createdAt: '2026-03-26T10:00:00.000Z',
  updatedAt: '2026-03-26T10:05:00.000Z',
  annotations: [],
};

const humanReview: ReviewRecord = {
  ...aiReview,
  annotations: [
    {
      id: 'a1',
      criterionId: 'c1',
      pageIndex: 0,
      bboxNorm: { x: 0, y: 0, w: 0.2, h: 0.2 },
      createdBy: 'human',
      status: 'confirmed',
      createdAt: aiReview.createdAt,
      updatedAt: aiReview.updatedAt,
    },
  ],
};

const silentLogger = {
  log: () => undefined,
  warn: () => undefined,
};

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dirPath) => fs.rm(dirPath, { recursive: true, force: true }))
  );
});

const pickSelectedFields = (row: Record<string, unknown>, select?: Record<string, boolean>) => {
  if (!select) {
    return row;
  }

  return Object.fromEntries(
    Object.entries(select)
      .filter(([, enabled]) => enabled)
      .map(([key]) => [key, row[key]])
  );
};

const matchesWhere = (row: Record<string, unknown>, where: Record<string, unknown>): boolean =>
  Object.entries(where).every(([key, value]) => row[key] === value);

const createFakeModel = (uniqueKey: string, label: string) => {
  const rows = new Map<string, Record<string, unknown>>();
  let sequence = 0;

  const getByWhere = (where: Record<string, unknown>) => {
    if (typeof where.id === 'string') {
      return [...rows.values()].find((row) => row.id === where.id) ?? null;
    }

    const uniqueValue = where[uniqueKey];
    if (typeof uniqueValue !== 'string') {
      return null;
    }

    return rows.get(uniqueValue) ?? null;
  };

  return {
    rows,
    async findUnique(args: { where: Record<string, unknown>; select?: Record<string, boolean> }) {
      const row = getByWhere(args.where);
      return row ? pickSelectedFields(row, args.select) : null;
    },
    async findFirst(args: { where: Record<string, unknown>; select?: Record<string, boolean> }) {
      const row = [...rows.values()].find((candidate) => matchesWhere(candidate, args.where)) ?? null;
      return row ? pickSelectedFields(row, args.select) : null;
    },
    async create(args: { data: Record<string, unknown>; select?: Record<string, boolean> }) {
      const row = {
        id: `${label}-row-${++sequence}`,
        ...args.data,
      };
      rows.set(String(row[uniqueKey]), row);
      return pickSelectedFields(row, args.select);
    },
    async update(args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
      select?: Record<string, boolean>;
    }) {
      const current = getByWhere(args.where);
      if (!current) {
        throw new Error(`${label} row not found`);
      }

      const next = { ...current, ...args.data };
      rows.set(String(next[uniqueKey]), next);
      return pickSelectedFields(next, args.select);
    },
    async findMany(args?: {
      where?: Record<string, unknown>;
      select?: Record<string, boolean>;
      orderBy?: Record<string, 'asc' | 'desc'>;
    }) {
      let values = [...rows.values()];

      if (args?.where) {
        values = values.filter((candidate) => matchesWhere(candidate, args.where!));
      }

      if (args?.orderBy) {
        const [[key, direction]] = Object.entries(args.orderBy);
        values.sort((left, right) => {
          const leftValue = left[key];
          const rightValue = right[key];
          if (leftValue === rightValue) return 0;
          if (direction === 'desc') {
            return leftValue > rightValue ? -1 : 1;
          }
          return leftValue > rightValue ? 1 : -1;
        });
      }

      return values.map((row) => pickSelectedFields(row, args?.select));
    },
  };
};

const createFakeCompositeModel = (
  label: string,
  buildKey: (value: Record<string, unknown>) => string | null
) => {
  const rows = new Map<string, Record<string, unknown>>();
  let sequence = 0;

  const getKey = (value: Record<string, unknown>) => buildKey(value);

  const getByWhere = (where: Record<string, unknown>) => {
    if (typeof where.id === 'string') {
      return [...rows.values()].find((row) => row.id === where.id) ?? null;
    }

    const compositeKey = getKey(where);
    if (!compositeKey) {
      return null;
    }

    return rows.get(compositeKey) ?? null;
  };

  return {
    rows,
    async findUnique(args: { where: Record<string, unknown>; select?: Record<string, boolean> }) {
      const row = getByWhere(args.where);
      return row ? pickSelectedFields(row, args.select) : null;
    },
    async create(args: { data: Record<string, unknown>; select?: Record<string, boolean> }) {
      const row = {
        id: `${label}-row-${++sequence}`,
        ...args.data,
      };
      const key = getKey(row);
      if (!key) {
        throw new Error(`Invalid composite key for ${label}`);
      }
      rows.set(key, row);
      return pickSelectedFields(row, args.select);
    },
    async update(args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
      select?: Record<string, boolean>;
    }) {
      const current = getByWhere(args.where);
      if (!current) {
        throw new Error(`${label} row not found`);
      }

      const next = { ...current, ...args.data };
      const key = getKey(next);
      if (!key) {
        throw new Error(`Invalid composite key for ${label}`);
      }
      rows.set(key, next);
      return pickSelectedFields(next, args.select);
    },
  };
};

const createFakePrisma = () => {
  const course = createFakeModel('domainId', 'course');
  const storedAsset = createFakeModel('assetKey', 'asset');
  const courseMaterial = createFakeModel('domainId', 'material');
  const lecture = createFakeModel('domainId', 'lecture');
  const exam = createFakeModel('domainId', 'exam');
  const rubric = createFakeCompositeModel('rubric', (value) => {
    if (
      value.examRowId_questionId &&
      typeof value.examRowId_questionId === 'object' &&
      value.examRowId_questionId !== null
    ) {
      const composite = value.examRowId_questionId as Record<string, unknown>;
      if (typeof composite.examRowId === 'string' && typeof composite.questionId === 'string') {
        return `${composite.examRowId}:${composite.questionId}`;
      }
    }

    if (typeof value.examRowId === 'string' && typeof value.questionId === 'string') {
      return `${value.examRowId}:${value.questionId}`;
    }

    return null;
  });
  const examIndex = createFakeModel('examRowId', 'exam-index');
  const submission = createFakeModel('domainId', 'submission');
  const review = createFakeModel('domainId', 'review');
  const reviewVersion = createFakeModel('domainId', 'review-version');
  const publishedResult = createFakeModel('domainId', 'published-result');
  const gradebookEntry = createFakeModel('domainId', 'gradebook-entry');
  const gradingJob = createFakeModel('domainId', 'grading-job');

  const prisma: any = {
    course,
    storedAsset,
    courseMaterial,
    lecture,
    exam,
    rubric,
    examIndex,
    submission,
    review,
    reviewVersion,
    publishedResult,
    gradebookEntry,
    gradingJob,
    async $transaction(fn: (tx: any) => Promise<unknown>) {
      return fn({
        review,
        reviewVersion,
        publishedResult,
        gradebookEntry,
        submission,
        gradingJob,
      });
    },
  };

  return {
    prisma,
    stores: {
      course: course.rows,
      storedAsset: storedAsset.rows,
      courseMaterial: courseMaterial.rows,
      lecture: lecture.rows,
      exam: exam.rows,
      rubric: rubric.rows,
      examIndex: examIndex.rows,
      submission: submission.rows,
      review: review.rows,
      reviewVersion: reviewVersion.rows,
      publishedResult: publishedResult.rows,
      gradebookEntry: gradebookEntry.rows,
      gradingJob: gradingJob.rows,
    },
  };
};

const createImportFixture = async (options?: {
  blockCourseCompatibilityTarget?: boolean;
}): Promise<string> => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hg-postgres-import-'));
  tempDirs.push(tempDir);

  const writeJson = async (relativePath: string, value: unknown) => {
    const absolutePath = path.join(tempDir, relativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, JSON.stringify(value, null, 2), 'utf-8');
  };

  await writeJson('courses/course-1/course.json', {
    version: '1.0.0',
    courseId: 'course-1',
    title: 'Course 1',
    createdAt: '2026-03-26T10:00:00.000Z',
    updatedAt: '2026-03-26T10:05:00.000Z',
  });
  await writeJson('courses/course-1/lectures/lecture-1/lecture.json', {
    version: '1.0.0',
    lectureId: 'lecture-1',
    courseId: 'course-1',
    title: 'Signals Intro',
    sourceType: 'markdown',
    assetPath: 'courses/course-1/lectures/lecture-1/assets/lecture.md',
    externalUrl: 'https://example.com/lecture-1',
    createdAt: '2026-03-26T10:10:00.000Z',
    updatedAt: '2026-03-26T10:15:00.000Z',
  });

  await writeJson('exams/exam-1/exam.json', {
    examId: 'exam-1',
    title: 'Midterm 1',
    createdAt: '2026-03-26T09:00:00.000Z',
    updatedAt: '2026-03-26T09:05:00.000Z',
    examFilePath: 'exams/exam-1/assets/exam.pdf',
  });
  await writeJson('exams/exam-1/examIndex.json', {
    version: '1.0.0',
    examId: 'exam-1',
    generatedAt: '2026-03-26T09:10:00.000Z',
    updatedAt: '2026-03-26T09:10:00.000Z',
    status: 'proposed',
    questions: [
      {
        id: 'q1',
        order: 1,
        displayLabel: 'Question 1',
        aliases: ['Q1', '1)'],
        promptText: 'Solve the equation.',
      },
    ],
  });
  await writeJson('rubrics/exam-1/q-1.json', {
    examId: 'exam-1',
    questionId: 'q-1',
    title: 'Rubric for Q1',
    criteria: [
      {
        id: 'criterion-1',
        label: 'Correct setup',
        kind: 'points',
        maxPoints: 10,
      },
    ],
  });

  await writeJson('jobs/done/job-1.json', {
    id: 'job-1',
    status: 'DONE',
    createdAt: '2026-03-26T10:00:00.000Z',
    updatedAt: '2026-03-26T10:05:00.000Z',
    inputs: {
      courseId: 'course-1',
      examId: 'exam-1',
      questionId: 'q-1',
      examFilePath: 'exams/exam-1/assets/exam.pdf',
      submissionFilePath: 'uploads/job-1.pdf',
      submissionMimeType: 'application/pdf',
    },
    resultJson: {
      mode: 'RUBRIC',
      rubricEvaluation: {
        sectionScore: 91,
        sectionMaxPoints: 100,
        overallFeedback: 'Strong work',
      },
    },
  });

  await writeJson('reviews/job-1.json', aiReview);
  await writeJson('reviews/missing-job.json', {
    ...aiReview,
    jobId: 'missing-job',
  });

  if (options?.blockCourseCompatibilityTarget) {
    await fs.writeFile(path.join(tempDir, 'courses', 'course-1', 'rag'), 'blocked', 'utf-8');
  }

  await fs.mkdir(path.join(tempDir, 'uploads'), { recursive: true });
  await fs.writeFile(path.join(tempDir, 'uploads', 'job-1.pdf'), 'fixture', 'utf-8');
  await fs.mkdir(path.join(tempDir, 'exams', 'exam-1', 'assets'), { recursive: true });
  await fs.writeFile(path.join(tempDir, 'exams', 'exam-1', 'assets', 'exam.pdf'), 'exam', 'utf-8');
  await fs.mkdir(path.join(tempDir, 'courses', 'course-1', 'lectures', 'lecture-1', 'assets'), {
    recursive: true,
  });
  await fs.writeFile(
    path.join(tempDir, 'courses', 'course-1', 'lectures', 'lecture-1', 'assets', 'lecture.md'),
    '# Lecture',
    'utf-8'
  );

  return tempDir;
};

describe('legacy import helpers', () => {
  it('uses a placeholder course when legacy jobs have no courseId', () => {
    expect(getCourseDomainIdForLegacyJob()).toBe(PLACEHOLDER_COURSE_DOMAIN_ID);
  });

  it('produces deterministic natural keys for reruns', () => {
    expect(getSubmissionDomainId('job-123')).toBe('legacy-submission:job-123');
    expect(getImportedReviewVersionDomainId('job-123')).toBe('legacy-review-version:job-123:imported');
    expect(getPublishedResultDomainId('job-123')).toBe('legacy-published-result:job-123');
    expect(getGradebookEntryDomainId('job-123')).toBe('legacy-gradebook-entry:job-123');
  });

  it('derives imported states from available legacy data', () => {
    expect(
      deriveSubmissionStateFromLegacy(
        { id: 'job-1', status: 'DONE', resultJson: { mode: 'RUBRIC' } },
        aiReview,
        true
      )
    ).toBe('published');
    expect(
      deriveSubmissionStateFromLegacy(
        { id: 'job-1', status: 'DONE' },
        humanReview,
        false
      )
    ).toBe('lecturer_edited');
    expect(deriveReviewStateFromLegacy(aiReview, false)).toBe('ready_for_review');
    expect(deriveReviewStateFromLegacy(humanReview, false)).toBe('lecturer_edited');
  });
});

describe('importFileBackedData', () => {
  it('supports dry-run without mutating the database and emits structured reporting', async () => {
    const dataDir = await createImportFixture();
    const { prisma, stores } = createFakePrisma();

    const summary = await importFileBackedData(prisma, {
      dataDir,
      dryRun: true,
      logger: silentLogger,
    });

    expect(summary).toMatchObject({
      dryRun: true,
      importedCourses: 1,
      importedLectures: 1,
      importedLectureAssets: 1,
      importedExams: 1,
      importedRubrics: 1,
      importedExamIndexes: 1,
      importedJobsPending: 0,
      importedJobsRunning: 0,
      importedJobsDone: 1,
      importedJobsFailed: 0,
      importedSubmissions: 1,
      importedReviews: 1,
      importedPublishedResults: 1,
      updatedRecords: 0,
      skippedRecords: 0,
      unresolvedRecords: 1,
      failedRecords: 0,
    });
    expect(summary.warningCounts).toMatchObject({
      missing_job: 1,
    });
    expect(summary.warnings).toContain('Skipping review without matching job: missing-job');

    expect(stores.course.size).toBe(0);
    expect(stores.exam.size).toBe(0);
    expect(stores.rubric.size).toBe(0);
    expect(stores.examIndex.size).toBe(0);
    expect(stores.submission.size).toBe(0);
    expect(stores.review.size).toBe(0);
    expect(stores.publishedResult.size).toBe(0);
  });

  it('reruns safely and reports updates on the second import', async () => {
    const dataDir = await createImportFixture();
    const { prisma, stores } = createFakePrisma();

    const firstRun = await importFileBackedData(prisma, {
      dataDir,
      logger: silentLogger,
    });
    const secondRun = await importFileBackedData(prisma, {
      dataDir,
      logger: silentLogger,
    });

    expect(firstRun).toMatchObject({
      dryRun: false,
      importedCourses: 1,
      importedLectures: 1,
      importedLectureAssets: 1,
      importedExams: 1,
      importedRubrics: 1,
      importedExamIndexes: 1,
      importedJobsPending: 0,
      importedJobsRunning: 0,
      importedJobsDone: 1,
      importedJobsFailed: 0,
      importedSubmissions: 1,
      importedReviews: 1,
      importedPublishedResults: 1,
      unresolvedRecords: 1,
      failedRecords: 0,
    });
    expect(secondRun).toMatchObject({
      dryRun: false,
      importedCourses: 1,
      importedLectures: 1,
      importedLectureAssets: 1,
      importedExams: 1,
      importedRubrics: 1,
      importedExamIndexes: 1,
      importedJobsPending: 0,
      importedJobsRunning: 0,
      importedJobsDone: 1,
      importedJobsFailed: 0,
      importedSubmissions: 1,
      importedReviews: 1,
      importedPublishedResults: 1,
      unresolvedRecords: 1,
      failedRecords: 0,
    });
    expect(secondRun.updatedRecords).toBeGreaterThan(0);
    expect(secondRun.warningCounts).toMatchObject({
      missing_job: 1,
    });

    expect(stores.course.size).toBe(2);
    expect(stores.storedAsset.size).toBe(4);
    expect(stores.courseMaterial.size).toBe(2);
    expect(stores.lecture.size).toBe(1);
    expect(stores.exam.size).toBe(1);
    expect(stores.rubric.size).toBe(1);
    expect(stores.examIndex.size).toBe(1);
    expect(stores.submission.size).toBe(1);
    expect(stores.review.size).toBe(1);
    expect(stores.reviewVersion.size).toBe(1);
    expect(stores.publishedResult.size).toBe(1);
    expect(stores.gradebookEntry.size).toBe(1);
    expect(stores.gradingJob.size).toBe(1);
    expect(stores.submission.get(getSubmissionDomainId('job-1'))?.currentPublishedResultId).toBe(
      stores.publishedResult.get(getPublishedResultDomainId('job-1'))?.id
    );
    expect(
      reviewContextFromStoredPayload(
        stores.reviewVersion.get(getImportedReviewVersionDomainId('job-1'))?.rawPayload
      )
    ).toEqual({
      status: 'DONE',
      resultJson: {
        mode: 'RUBRIC',
        rubricEvaluation: {
          sectionScore: 91,
          sectionMaxPoints: 100,
          overallFeedback: 'Strong work',
        },
      },
      errorMessage: null,
      submissionMimeType: 'application/pdf',
      gradingMode: null,
      gradingScope: null,
    });
  });

  it('does not emit compatibility files by default during import', async () => {
    const dataDir = await createImportFixture({ blockCourseCompatibilityTarget: true });
    const { prisma } = createFakePrisma();

    const summary = await importFileBackedData(prisma, {
      dataDir,
      logger: silentLogger,
    });

    expect(summary.failedRecords).toBe(0);
    expect(summary.warningCounts.course_compat_export_failed).toBeUndefined();
  });

  it('emits compatibility files only when explicitly requested', async () => {
    const dataDir = await createImportFixture({ blockCourseCompatibilityTarget: true });
    const { prisma } = createFakePrisma();

    const summary = await importFileBackedData(prisma, {
      dataDir,
      emitCompatFiles: true,
      logger: silentLogger,
    });

    expect(summary.failedRecords).toBe(1);
    expect(summary.warningCounts).toMatchObject({
      course_compat_export_failed: 1,
      missing_job: 1,
    });
  });
});
