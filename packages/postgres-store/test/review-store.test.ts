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
});
