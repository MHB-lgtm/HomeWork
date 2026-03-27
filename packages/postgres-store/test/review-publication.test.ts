import { describe, expect, it } from 'vitest';
import type { ReviewRecord } from '@hg/shared-schemas';
import {
  createStoredReviewRecordPayload,
  LegacyReviewPublicationConflictError,
  PrismaLegacyReviewRecordStore,
} from '../src';

const makeReviewRecord = (overrides: Partial<ReviewRecord> = {}): ReviewRecord => ({
  version: '1.0.0',
  jobId: 'job-1',
  createdAt: '2026-03-26T10:00:00.000Z',
  updatedAt: '2026-03-26T10:05:00.000Z',
  annotations: [],
  ...overrides,
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

const createFakePrisma = () => {
  const courses = new Map<string, any>();
  const materials = new Map<string, any>();
  const assets = new Map<string, any>();
  const submissions = new Map<string, any>();
  const reviews = new Map<string, any>();
  const reviewVersions = new Map<string, any>();
  const publishedResults = new Map<string, any>();
  const gradebookEntries = new Map<string, any>();

  const courseRow = {
    id: 'course-1',
    domainId: 'course-1',
  };
  const assetRow = {
    id: 'asset-1',
    path: 'C:\\fixtures\\job-1.pdf',
    mimeType: 'application/pdf',
  };
  const materialRow = {
    id: 'material-1',
    domainId: 'material-1',
    assetId: assetRow.id,
  };

  courses.set(courseRow.domainId, courseRow);
  assets.set(assetRow.id, assetRow);
  materials.set(materialRow.domainId, materialRow);

  const getSubmissionRow = (where: Record<string, unknown>) => {
    if (typeof where.id === 'string') {
      return [...submissions.values()].find((row) => row.id === where.id) ?? null;
    }

    if (typeof where.domainId === 'string') {
      return submissions.get(where.domainId) ?? null;
    }

    if (typeof where.legacyJobId === 'string') {
      return [...submissions.values()].find((row) => row.legacyJobId === where.legacyJobId) ?? null;
    }

    return null;
  };

  const getReviewRow = (where: Record<string, unknown>) => {
    if (typeof where.id === 'string') {
      return [...reviews.values()].find((row) => row.id === where.id) ?? null;
    }

    if (typeof where.domainId === 'string') {
      return reviews.get(where.domainId) ?? null;
    }

    return null;
  };

  const getReviewVersionRow = (where: Record<string, unknown>) => {
    if (typeof where.id === 'string') {
      return [...reviewVersions.values()].find((row) => row.id === where.id) ?? null;
    }

    if (typeof where.domainId === 'string') {
      return reviewVersions.get(where.domainId) ?? null;
    }

    return null;
  };

  const getPublishedResultRow = (where: Record<string, unknown>) => {
    if (typeof where.id === 'string') {
      return [...publishedResults.values()].find((row) => row.id === where.id) ?? null;
    }

    if (typeof where.domainId === 'string') {
      return publishedResults.get(where.domainId) ?? null;
    }

    return null;
  };

  let reviewVersionSequence = 1;
  let publishedResultSequence = 1;
  let gradebookEntrySequence = 1;

  const prisma: any = {
    course: {
      async findUnique(args: any) {
        const row = typeof args.where.domainId === 'string' ? courses.get(args.where.domainId) ?? null : null;
        return row ? pickSelectedFields(row, args.select) : null;
      },
    },
    courseMaterial: {
      async findUnique(args: any) {
        const row =
          typeof args.where.domainId === 'string' ? materials.get(args.where.domainId) ?? null : null;
        return row ? pickSelectedFields(row, args.select) : null;
      },
    },
    submission: {
      async findUnique(args: any) {
        const row = getSubmissionRow(args.where);
        if (!row) {
          return null;
        }

        const material = [...materials.values()].find((item) => item.id === row.materialId) ?? null;
        const asset = material ? assets.get(material.assetId) ?? null : null;
        const review = [...reviews.values()].find((item) => item.submissionId === row.id) ?? null;
        const effectivePublishedResults = [...publishedResults.values()]
          .filter((item) => item.submissionId === row.id)
          .filter((item) => item.status === 'EFFECTIVE')
          .sort((left, right) => right.publishedAt.getTime() - left.publishedAt.getTime());

        if (args.select) {
          return {
            ...(args.select.id ? { id: row.id } : {}),
            ...(args.select.domainId ? { domainId: row.domainId } : {}),
            ...(args.select.legacyJobId ? { legacyJobId: row.legacyJobId ?? null } : {}),
            ...(args.select.courseId ? { courseId: row.courseId } : {}),
            ...(args.select.currentPublishedResultId
              ? { currentPublishedResultId: row.currentPublishedResultId ?? null }
              : {}),
            ...(args.select.material
              ? {
                  material: material
                    ? {
                        asset: asset
                          ? {
                              path: asset.path,
                              mimeType: asset.mimeType ?? null,
                            }
                          : null,
                      }
                    : null,
                }
              : {}),
            ...(args.select.review
              ? {
                  review: review
                    ? {
                        createdAt: review.createdAt,
                        updatedAt: review.updatedAt,
                        currentVersionId: review.currentVersionId ?? null,
                        versions: [...reviewVersions.values()]
                          .filter((version) => version.reviewId === review.id)
                          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
                          .slice(0, 1)
                          .map((version) => ({
                            id: version.id,
                            rawPayload: version.rawPayload,
                          })),
                      }
                    : null,
                }
              : {}),
            ...(args.select.publishedResults
              ? {
                  publishedResults: effectivePublishedResults.map((item) => ({
                    domainId: item.domainId,
                    publishedAt: item.publishedAt,
                    finalScore: item.finalScore,
                    maxScore: item.maxScore,
                    summary: item.summary,
                  })),
                }
              : {}),
          };
        }

        if (args.include) {
          return {
            ...row,
            ...(args.include.course
              ? {
                  course: {
                    domainId: [...courses.values()].find((course) => course.id === row.courseId)?.domainId,
                  },
                }
              : {}),
            ...(args.include.material
              ? {
                  material: material
                    ? {
                        domainId: material.domainId,
                      }
                    : null,
                }
              : {}),
            ...(args.include.review
              ? {
                  review,
                }
              : {}),
          };
        }

        return row;
      },
      async update(args: any) {
        const current = getSubmissionRow(args.where);
        if (!current) {
          throw new Error('submission row not found');
        }

        const next = { ...current, ...args.data };
        submissions.set(current.domainId, next);
        return next;
      },
    },
    review: {
      async findUnique(args: any) {
        const row = getReviewRow(args.where);
        if (!row) {
          return null;
        }

        if (args.select) {
          return pickSelectedFields(row, args.select);
        }

        if (args.include) {
          const course = [...courses.values()].find((item) => item.id === row.courseId);
          const submission = [...submissions.values()].find((item) => item.id === row.submissionId);
          return {
            ...row,
            ...(args.include.course ? { course: { domainId: course?.domainId } } : {}),
            ...(args.include.submission ? { submission: { domainId: submission?.domainId } } : {}),
          };
        }

        return row;
      },
      async findFirst(args: any) {
        const targetSubmissionDomainId = args.where?.submission?.domainId;
        const submission = [...submissions.values()].find((item) => item.domainId === targetSubmissionDomainId);
        if (!submission) {
          return null;
        }

        const row = [...reviews.values()].find((item) => item.submissionId === submission.id) ?? null;
        if (!row) {
          return null;
        }

        const course = [...courses.values()].find((item) => item.id === row.courseId);
        return {
          ...row,
          ...(args.include?.course ? { course: { domainId: course?.domainId } } : {}),
          ...(args.include?.submission ? { submission: { domainId: submission.domainId } } : {}),
        };
      },
      async create(args: any) {
        const row = {
          id: `review-row-${reviews.size + 1}`,
          ...args.data,
        };
        reviews.set(row.domainId, row);
        return row;
      },
      async update(args: any) {
        const current = getReviewRow(args.where);
        if (!current) {
          throw new Error('review row not found');
        }

        const next = { ...current, ...args.data };
        reviews.set(current.domainId, next);
        return next;
      },
      async upsert(args: any) {
        const existing = getReviewRow(args.where);
        if (existing) {
          const next = { ...existing, ...args.update };
          reviews.set(existing.domainId, next);
          return next;
        }

        const row = {
          id: `review-row-${reviews.size + 1}`,
          ...args.create,
        };
        reviews.set(row.domainId, row);
        return row;
      },
    },
    reviewVersion: {
      async findUnique(args: any) {
        const row = getReviewVersionRow(args.where);
        return row ? pickSelectedFields(row, args.select) : null;
      },
      async findMany(args: any) {
        if (args.where?.review?.domainId) {
          const review = reviews.get(args.where.review.domainId);
          return [...reviewVersions.values()]
            .filter((version) => version.reviewId === review?.id)
            .sort((left, right) =>
              args.orderBy?.createdAt === 'asc'
                ? left.createdAt.getTime() - right.createdAt.getTime()
                : right.createdAt.getTime() - left.createdAt.getTime()
            )
            .map((version) => ({
              domainId: version.domainId,
              reviewId: review.domainId,
              kind: version.kind,
              actorUserId: version.actorUserId ?? null,
              actorKind: version.actorKind,
              actorRefRaw: version.actorRefRaw ?? null,
              score: version.score ?? null,
              maxScore: version.maxScore ?? null,
              summary: version.summary ?? null,
              questionBreakdown: version.questionBreakdown ?? null,
              rawPayload: version.rawPayload,
              createdAt: version.createdAt,
            }));
        }

        return [];
      },
      async create(args: any) {
        const row = {
          id: `review-version-row-${reviewVersionSequence++}`,
          ...args.data,
        };
        reviewVersions.set(row.domainId, row);
        return row;
      },
      async upsert(args: any) {
        const existing = getReviewVersionRow(args.where);
        if (existing) {
          const next = { ...existing, ...args.update };
          reviewVersions.set(existing.domainId, next);
          return next;
        }

        const row = {
          id: `review-version-row-${reviewVersionSequence++}`,
          ...args.create,
        };
        reviewVersions.set(row.domainId, row);
        return row;
      },
    },
    publishedResult: {
      async findUnique(args: any) {
        const row = getPublishedResultRow(args.where);
        return row ? pickSelectedFields(row, args.select) : null;
      },
      async updateMany(args: any) {
        const submissionId = args.where.submissionId;
        [...publishedResults.values()]
          .filter((row) => row.submissionId === submissionId)
          .filter((row) => row.status === args.where.status)
          .forEach((row) => {
            publishedResults.set(row.domainId, { ...row, ...args.data });
          });
        return { count: 1 };
      },
      async upsert(args: any) {
        const existing = getPublishedResultRow(args.where);
        if (existing) {
          const next = { ...existing, ...args.update };
          publishedResults.set(existing.domainId, next);
          return pickSelectedFields(next, args.select);
        }

        const row = {
          id: `published-result-row-${publishedResultSequence++}`,
          ...args.create,
        };
        publishedResults.set(row.domainId, row);
        return pickSelectedFields(row, args.select);
      },
    },
    gradebookEntry: {
      async findUnique(args: any) {
        let row = null;
        if (args.where.domainId) {
          row = gradebookEntries.get(args.where.domainId) ?? null;
        } else if (args.where.publishedResultId) {
          row =
            [...gradebookEntries.values()].find(
              (entry) => entry.publishedResultId === args.where.publishedResultId
            ) ?? null;
        }

        if (!row) {
          return null;
        }

        if (args.include?.course) {
          const course = [...courses.values()].find((item) => item.id === row.courseId);
          return {
            ...row,
            course: { domainId: course?.domainId },
          };
        }

        return pickSelectedFields(row, args.select);
      },
      async upsert(args: any) {
        const existing = gradebookEntries.get(args.where.domainId) ?? null;
        if (existing) {
          const next = { ...existing, ...args.update };
          gradebookEntries.set(next.domainId, next);
          return next;
        }

        const row = {
          id: `gradebook-entry-row-${gradebookEntrySequence++}`,
          ...args.create,
        };
        gradebookEntries.set(row.domainId, row);
        return row;
      },
    },
    async $transaction(fn: (tx: any) => Promise<unknown>) {
      return fn(prisma);
    },
  };

  const seedImportedReview = (options?: { publishable?: boolean; alreadyPublished?: boolean }) => {
    const publishable = options?.publishable !== false;
    const reviewRecord = makeReviewRecord();
    const resultJson = publishable
      ? {
          mode: 'RUBRIC',
          rubricEvaluation: {
            sectionScore: 91,
            sectionMaxPoints: 100,
            overallFeedback: 'Strong work',
            criteria: [],
          },
        }
      : {
          mode: 'GENERAL',
          generalEvaluation: {
            overallSummary: 'Readable work, but no numeric score was produced.',
            findings: [],
          },
        };

    const submissionRow = {
      id: 'submission-row-1',
      domainId: 'legacy-submission:job-1',
      legacyJobId: 'job-1',
      courseId: courseRow.id,
      materialId: materialRow.id,
      studentUserId: null,
      moduleType: 'LEGACY_JOB',
      assignmentId: null,
      examBatchId: null,
      submittedAt: new Date('2026-03-26T10:00:00.000Z'),
      state: publishable ? 'LECTURER_EDITED' : 'PROCESSED',
      currentPublishedResultId: null,
    };
    submissions.set(submissionRow.domainId, submissionRow);

    const reviewRow = {
      id: 'review-row-1',
      domainId: 'legacy-review:job-1',
      courseId: courseRow.id,
      submissionId: submissionRow.id,
      currentVersionId: 'review-version-row-imported',
      state: options?.alreadyPublished ? 'PUBLISHED' : 'LECTURER_EDITED',
      createdAt: new Date('2026-03-26T10:00:00.000Z'),
      updatedAt: new Date('2026-03-26T10:05:00.000Z'),
    };
    reviews.set(reviewRow.domainId, reviewRow);

    const importedVersion = {
      id: 'review-version-row-imported',
      domainId: 'legacy-review-version:job-1:imported',
      reviewId: reviewRow.id,
      kind: 'LECTURER_EDIT',
      actorUserId: null,
      actorKind: 'LEGACY',
      actorRefRaw: 'review-route',
      score: publishable ? 91 : null,
      maxScore: publishable ? 100 : null,
      summary: publishable ? 'Strong work' : 'Readable work, but no numeric score was produced.',
      questionBreakdown: [],
      rawPayload: createStoredReviewRecordPayload(reviewRecord, {
        status: 'DONE',
        resultJson,
        errorMessage: null,
        submissionMimeType: 'application/pdf',
        gradingMode: publishable ? 'RUBRIC' : 'GENERAL',
        gradingScope: 'QUESTION',
      }),
      flagsJson: null,
      createdAt: new Date('2026-03-26T10:05:00.000Z'),
    };
    reviewVersions.set(importedVersion.domainId, importedVersion);

    if (options?.alreadyPublished) {
      const publishedResultRow = {
        id: 'published-result-row-seeded',
        domainId: 'legacy-published-result:job-1:seeded',
        courseId: courseRow.id,
        submissionId: submissionRow.id,
        studentUserId: null,
        moduleType: 'LEGACY_JOB',
        assignmentId: null,
        examBatchId: null,
        reviewId: reviewRow.id,
        sourceReviewVersionId: importedVersion.id,
        publishedAt: new Date('2026-03-26T10:06:00.000Z'),
        status: 'EFFECTIVE',
        finalScore: 91,
        maxScore: 100,
        summary: 'Seeded publication',
        breakdownSnapshot: [],
      };
      publishedResults.set(publishedResultRow.domainId, publishedResultRow);
      submissionRow.currentPublishedResultId = publishedResultRow.id;
    }
  };

  return {
    prisma,
    seedImportedReview,
    stores: {
      submissions,
      reviews,
      reviewVersions,
      publishedResults,
      gradebookEntries,
    },
  };
};

describe('PrismaLegacyReviewRecordStore publication flow', () => {
  it('publishes a patched imported review and exposes publication state in detail', async () => {
    const { prisma, seedImportedReview, stores } = createFakePrisma();
    seedImportedReview();

    const store = new PrismaLegacyReviewRecordStore(prisma);
    await store.patchReviewDisplayNameByLegacyJobId('job-1', 'Renamed after import');

    const publication = await store.publishReviewByLegacyJobId('job-1');
    const detail = await store.getReviewDetailByLegacyJobId('job-1');

    expect(publication).toMatchObject({
      isPublished: true,
      score: 91,
      maxScore: 100,
      summary: 'Strong work',
    });
    expect(detail?.review.displayName).toBe('Renamed after import');
    expect(detail?.publication).toMatchObject({
      isPublished: true,
      publishedResultId: publication.publishedResultId,
      score: 91,
      maxScore: 100,
      summary: 'Strong work',
    });
    expect(stores.submissions.get('legacy-submission:job-1').currentPublishedResultId).toBeTruthy();
    expect(stores.gradebookEntries.size).toBe(1);
  });

  it('rejects publish for a fallback-only review with no imported submission', async () => {
    const { prisma } = createFakePrisma();
    const store = new PrismaLegacyReviewRecordStore(prisma);

    await expect(store.publishReviewByLegacyJobId('missing-job')).rejects.toBeInstanceOf(
      LegacyReviewPublicationConflictError
    );
  });

  it('rejects publish when the current review result is not publishable', async () => {
    const { prisma, seedImportedReview } = createFakePrisma();
    seedImportedReview({ publishable: false });

    const store = new PrismaLegacyReviewRecordStore(prisma);

    await expect(store.publishReviewByLegacyJobId('job-1')).rejects.toMatchObject({
      message: 'ReviewResultEnvelope is not publishable: score, maxScore, and summary are required',
    });
  });

  it('can publish a legacy imported review when publishable context is provided by the route layer', async () => {
    const { prisma, seedImportedReview, stores } = createFakePrisma();
    seedImportedReview();

    const importedVersion = stores.reviewVersions.get('legacy-review-version:job-1:imported');
    importedVersion.score = null;
    importedVersion.maxScore = null;
    importedVersion.summary = 'Legacy snapshot with no stored score';
    importedVersion.rawPayload = makeReviewRecord();

    const store = new PrismaLegacyReviewRecordStore(prisma);

    const publication = await store.publishReviewByLegacyJobId('job-1', {
      reviewRecord: makeReviewRecord(),
      context: {
        status: 'DONE',
        resultJson: {
          mode: 'RUBRIC',
          rubricEvaluation: {
            sectionScore: 91,
            sectionMaxPoints: 100,
            overallFeedback: 'Recovered from file-backed context',
            criteria: [],
          },
        },
        errorMessage: null,
        submissionMimeType: 'application/pdf',
        gradingMode: 'RUBRIC',
        gradingScope: 'QUESTION',
      },
    });

    expect(publication).toMatchObject({
      isPublished: true,
      score: 91,
      maxScore: 100,
      summary: 'Recovered from file-backed context',
    });
  });

  it('republish supersedes the previous effective published result and keeps one current pointer', async () => {
    const { prisma, seedImportedReview, stores } = createFakePrisma();
    seedImportedReview({ alreadyPublished: true });

    const store = new PrismaLegacyReviewRecordStore(prisma);
    const publication = await store.publishReviewByLegacyJobId('job-1');

    const rows = [...stores.publishedResults.values()].sort(
      (left, right) => left.publishedAt.getTime() - right.publishedAt.getTime()
    );
    const effectiveRows = rows.filter((row) => row.status === 'EFFECTIVE');
    const supersededRows = rows.filter((row) => row.status === 'SUPERSEDED');

    expect(rows).toHaveLength(2);
    expect(effectiveRows).toHaveLength(1);
    expect(supersededRows).toHaveLength(1);
    expect(effectiveRows[0].domainId).toBe(publication.publishedResultId);
    expect(stores.submissions.get('legacy-submission:job-1').currentPublishedResultId).toBe(
      effectiveRows[0].id
    );
  });
});
