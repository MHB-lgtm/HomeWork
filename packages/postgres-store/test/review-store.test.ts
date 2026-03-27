import { describe, expect, it } from 'vitest';
import type { ReviewRecord } from '@hg/shared-schemas';
import {
  createStoredReviewRecordPayload,
  PrismaLegacyReviewRecordStore,
} from '../src';

const makeReviewRecord = (displayName?: string): ReviewRecord => ({
  version: '1.0.0',
  jobId: 'job-1',
  displayName,
  createdAt: '2026-03-26T10:00:00.000Z',
  updatedAt: '2026-03-26T10:05:00.000Z',
  annotations: [],
});

const createFakePrisma = () => {
  const reviewVersions = new Map<string, any>();
  const reviews = new Map<string, any>();
  const submissions = new Map<string, any>();
  const materials = new Map<string, any>();
  const assets = new Map<string, any>();
  const publishedResults = new Map<string, any>();

  assets.set('asset-row-1', {
    id: 'asset-row-1',
    path: 'C:\\fixtures\\job-1.pdf',
    mimeType: 'application/pdf',
  });
  materials.set('material-row-1', {
    id: 'material-row-1',
    assetId: 'asset-row-1',
  });

  submissions.set('job-1', {
    id: 'submission-row-1',
    legacyJobId: 'job-1',
    courseId: 'course-row-1',
    materialId: 'material-row-1',
    currentPublishedResultId: null,
    review: null,
  });

  const prisma: any = {
    submission: {
      async findUnique(args: any) {
        const row = submissions.get(args.where.legacyJobId);
        if (!row) {
          return null;
        }

        const review = row.review ? reviews.get(row.review) : null;
        const material = row.materialId ? materials.get(row.materialId) : null;
        const asset = material ? assets.get(material.assetId) : null;
        const effectivePublishedResults = [...publishedResults.values()]
          .filter((publishedResult) => publishedResult.submissionId === row.id)
          .filter((publishedResult) => publishedResult.status === 'EFFECTIVE')
          .sort((left, right) => right.publishedAt.getTime() - left.publishedAt.getTime());

        if (args.select) {
          return {
            ...(args.select.id ? { id: row.id } : {}),
            ...(args.select.courseId ? { courseId: row.courseId } : {}),
            ...(args.select.currentPublishedResultId
              ? { currentPublishedResultId: row.currentPublishedResultId ?? null }
              : {}),
            ...(args.select.material
              ? {
                  material: asset
                    ? {
                        asset: {
                          path: asset.path,
                          mimeType: asset.mimeType ?? null,
                        },
                      }
                    : null,
                }
              : {}),
            ...(args.select.publishedResults
              ? {
                  publishedResults: effectivePublishedResults.map((publishedResult) => ({
                    domainId: publishedResult.domainId,
                    publishedAt: publishedResult.publishedAt,
                    finalScore: publishedResult.finalScore,
                    maxScore: publishedResult.maxScore,
                    summary: publishedResult.summary ?? null,
                  })),
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
          };
        }

        if (args.include?.review) {
          return {
            ...row,
            review: review
              ? {
                  ...review,
                  versions: [...reviewVersions.values()]
                    .filter((version) => version.reviewId === review.id)
                    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
                    .slice(0, 1),
                }
              : null,
          };
        }

        return row;
      },
      async findMany(args: any) {
        return [...submissions.values()]
          .filter((row) => {
            if (args.where?.legacyJobId?.not === null && !row.legacyJobId) {
              return false;
            }

            if (args.where?.review?.isNot === null) {
              return row.review !== null;
            }

            return true;
          })
          .map((row) => {
            const review = row.review ? reviews.get(row.review) : null;
            const effectivePublishedResults = [...publishedResults.values()]
              .filter((publishedResult) => publishedResult.submissionId === row.id)
              .filter((publishedResult) => publishedResult.status === 'EFFECTIVE')
              .sort((left, right) => right.publishedAt.getTime() - left.publishedAt.getTime());
            return {
              legacyJobId: row.legacyJobId,
              currentPublishedResultId: row.currentPublishedResultId ?? null,
              publishedResults: effectivePublishedResults.map((publishedResult) => ({
                domainId: publishedResult.domainId,
                publishedAt: publishedResult.publishedAt,
                finalScore: publishedResult.finalScore,
                maxScore: publishedResult.maxScore,
                summary: publishedResult.summary ?? null,
              })),
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
            };
          });
      },
    },
    review: {
      async create(args: any) {
        const id = `review-row-${reviews.size + 1}`;
        const row = { id, ...args.data };
        reviews.set(id, row);
        const submission = submissions.get('job-1');
        if (submission) {
          submission.review = id;
        }
        return row;
      },
      async update(args: any) {
        const current = reviews.get(args.where.id);
        const next = { ...current, ...args.data };
        reviews.set(args.where.id, next);
        return next;
      },
    },
    reviewVersion: {
      async create(args: any) {
        const id = `review-version-row-${reviewVersions.size + 1}`;
        const row = { id, ...args.data };
        reviewVersions.set(id, row);
        return row;
      },
      async findUnique(args: any) {
        if (args.where.id) {
          return reviewVersions.get(args.where.id) ?? null;
        }

        const row = [...reviewVersions.values()].find(
          (version) => version.domainId === args.where.domainId
        );
        return row ?? null;
      },
      async findMany(args: any) {
        const ids = new Set(args.where.id.in);
        return [...reviewVersions.values()]
          .filter((version) => ids.has(version.id))
          .map((version) => ({
            id: version.id,
            rawPayload: version.rawPayload,
          }));
      },
    },
    async $transaction(fn: (tx: any) => Promise<unknown>) {
      return fn({
        review: prisma.review,
        reviewVersion: prisma.reviewVersion,
      });
    },
  };

  return { prisma, reviewVersions, reviews, submissions, publishedResults };
};

describe('PrismaLegacyReviewRecordStore', () => {
  it('returns null when no DB-backed submission exists', async () => {
    const { prisma } = createFakePrisma();
    const store = new PrismaLegacyReviewRecordStore(prisma);

    expect(await store.getReviewRecordByLegacyJobId('missing')).toBeNull();
  });

  it('appends a new version when saving a DB-backed review record', async () => {
    const { prisma, reviewVersions, reviews } = createFakePrisma();
    const store = new PrismaLegacyReviewRecordStore(prisma);

    await store.saveReviewRecordByLegacyJobId('job-1', makeReviewRecord('Imported name'));
    await store.patchReviewDisplayNameByLegacyJobId('job-1', 'Renamed');

    expect(reviewVersions.size).toBe(2);
    const reviewRow = [...reviews.values()][0];
    const currentVersion = reviewVersions.get(reviewRow.currentVersionId);

    expect(currentVersion.rawPayload.displayName).toBe('Renamed');
  });

  it('lists DB-backed review summaries using the latest stored version and effective publication summary', async () => {
    const { prisma, submissions, publishedResults } = createFakePrisma();
    const store = new PrismaLegacyReviewRecordStore(prisma);

    await store.saveReviewRecordByLegacyJobId('job-1', makeReviewRecord('Imported name'));
    await store.patchReviewDisplayNameByLegacyJobId('job-1', 'Renamed');

    const submission = submissions.get('job-1');
    submission.currentPublishedResultId = 'published-result-row-1';
    publishedResults.set('legacy-published-result:job-1:published', {
      id: 'published-result-row-1',
      domainId: 'legacy-published-result:job-1:published',
      submissionId: submission.id,
      publishedAt: new Date('2026-03-26T10:06:00.000Z'),
      status: 'EFFECTIVE',
      finalScore: 91,
      maxScore: 100,
      summary: 'Strong work',
    });

    const summaries = await store.listReviewSummariesByLegacyJobId();

    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      jobId: 'job-1',
      displayName: 'Renamed',
      annotationCount: 0,
      hasResult: true,
      createdAt: '2026-03-26T10:00:00.000Z',
      publication: {
        isPublished: true,
        publishedResultId: 'legacy-published-result:job-1:published',
        publishedAt: '2026-03-26T10:06:00.000Z',
        score: 91,
        maxScore: 100,
        summary: 'Strong work',
      },
    });
    expect(summaries[0].updatedAt).toBeTruthy();
  });

  it('omits publication summary when an imported review has no effective publication', async () => {
    const { prisma } = createFakePrisma();
    const store = new PrismaLegacyReviewRecordStore(prisma);

    await store.saveReviewRecordByLegacyJobId('job-1', makeReviewRecord('Imported name'));

    const summaries = await store.listReviewSummariesByLegacyJobId();

    expect(summaries).toHaveLength(1);
    expect(summaries[0].publication).toBeUndefined();
    expect(summaries[0].hasResult).toBe(false);
  });

  it('returns review detail context and submission asset for wrapped imported payloads', async () => {
    const { prisma, submissions, reviews, reviewVersions } = createFakePrisma();
    const store = new PrismaLegacyReviewRecordStore(prisma);

    const reviewRow = {
      id: 'review-row-imported',
      domainId: 'legacy-review:job-1',
      createdAt: new Date('2026-03-26T10:00:00.000Z'),
      updatedAt: new Date('2026-03-26T10:05:00.000Z'),
      currentVersionId: 'review-version-row-imported',
    };
    reviews.set(reviewRow.id, reviewRow);
    submissions.get('job-1').review = reviewRow.id;
    reviewVersions.set('review-version-row-imported', {
      id: 'review-version-row-imported',
      domainId: 'legacy-review-version:job-1:imported',
      reviewId: reviewRow.id,
      createdAt: new Date('2026-03-26T10:05:00.000Z'),
      rawPayload: createStoredReviewRecordPayload(makeReviewRecord('Imported name'), {
        status: 'DONE',
        resultJson: { mode: 'RUBRIC' },
        errorMessage: null,
        submissionMimeType: 'application/pdf',
        gradingMode: 'RUBRIC',
        gradingScope: 'QUESTION',
      }),
    });

    const detail = await store.getReviewDetailByLegacyJobId('job-1');

    expect(detail).toMatchObject({
      review: {
        jobId: 'job-1',
        displayName: 'Imported name',
      },
      context: {
        status: 'DONE',
        resultJson: { mode: 'RUBRIC' },
        errorMessage: null,
        submissionMimeType: 'application/pdf',
        gradingMode: 'RUBRIC',
        gradingScope: 'QUESTION',
      },
      submissionAsset: {
        path: 'C:\\fixtures\\job-1.pdf',
        mimeType: 'application/pdf',
      },
    });
  });

  it('preserves imported context when patching the display name', async () => {
    const { prisma, submissions, reviews, reviewVersions } = createFakePrisma();
    const store = new PrismaLegacyReviewRecordStore(prisma);

    const reviewRow = {
      id: 'review-row-imported',
      domainId: 'legacy-review:job-1',
      createdAt: new Date('2026-03-26T10:00:00.000Z'),
      updatedAt: new Date('2026-03-26T10:05:00.000Z'),
      currentVersionId: 'review-version-row-imported',
    };
    reviews.set(reviewRow.id, reviewRow);
    submissions.get('job-1').review = reviewRow.id;
    reviewVersions.set('review-version-row-imported', {
      id: 'review-version-row-imported',
      domainId: 'legacy-review-version:job-1:imported',
      reviewId: reviewRow.id,
      createdAt: new Date('2026-03-26T10:05:00.000Z'),
      rawPayload: createStoredReviewRecordPayload(makeReviewRecord('Imported name'), {
        status: 'DONE',
        resultJson: { mode: 'RUBRIC' },
        errorMessage: null,
        submissionMimeType: 'application/pdf',
        gradingMode: 'RUBRIC',
        gradingScope: 'QUESTION',
      }),
    });

    await store.patchReviewDisplayNameByLegacyJobId('job-1', 'Renamed');

    const latestVersion = reviewVersions.get(reviews.get(reviewRow.id).currentVersionId);
    expect(latestVersion.rawPayload.legacyJobContext).toEqual({
      status: 'DONE',
      resultJson: { mode: 'RUBRIC' },
      errorMessage: null,
      submissionMimeType: 'application/pdf',
      gradingMode: 'RUBRIC',
      gradingScope: 'QUESTION',
    });
    expect(latestVersion.rawPayload.reviewRecord.displayName).toBe('Renamed');
  });
});
