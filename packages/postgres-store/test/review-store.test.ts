import { describe, expect, it } from 'vitest';
import type { ReviewRecord } from '@hg/shared-schemas';
import { PrismaLegacyReviewRecordStore } from '../src';

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

  submissions.set('job-1', {
    id: 'submission-row-1',
    legacyJobId: 'job-1',
    courseId: 'course-row-1',
    review: null,
  });

  const prisma: any = {
    submission: {
      async findUnique(args: any) {
        const row = submissions.get(args.where.legacyJobId);
        if (!row) {
          return null;
        }

        if (args.select?.id) {
          return { id: row.id };
        }

        if (args.include?.review) {
          const review = row.review ? reviews.get(row.review) : null;
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
            return {
              legacyJobId: row.legacyJobId,
              currentPublishedResultId: row.currentPublishedResultId ?? null,
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

  return { prisma, reviewVersions, reviews, submissions };
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

  it('lists DB-backed review summaries using the latest stored version', async () => {
    const { prisma, submissions } = createFakePrisma();
    const store = new PrismaLegacyReviewRecordStore(prisma);

    await store.saveReviewRecordByLegacyJobId('job-1', makeReviewRecord('Imported name'));
    await store.patchReviewDisplayNameByLegacyJobId('job-1', 'Renamed');
    submissions.get('job-1').currentPublishedResultId = 'published-result-row-1';

    const summaries = await store.listReviewSummariesByLegacyJobId();

    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      jobId: 'job-1',
      displayName: 'Renamed',
      annotationCount: 0,
      hasResult: true,
      createdAt: '2026-03-26T10:00:00.000Z',
    });
    expect(summaries[0].updatedAt).toBeTruthy();
  });
});
