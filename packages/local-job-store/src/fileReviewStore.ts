import * as fs from 'fs/promises';
import * as path from 'path';
import { ReviewRecord, ReviewRecordSchema } from '@hg/shared-schemas';

// Get data directory from environment variable
// Fail fast if missing (no fallbacks - HG_DATA_DIR must be set)
const getDataDir = (): string => {
  const dataDir = process.env.HG_DATA_DIR;
  if (!dataDir) {
    throw new Error('HG_DATA_DIR is not set in environment variables');
  }
  return path.resolve(dataDir);
};

// Initialize DATA_DIR once and log it
let DATA_DIR: string | null = null;
let DATA_DIR_LOGGED = false;

const getDataDirOnce = (): string => {
  if (!DATA_DIR) {
    DATA_DIR = getDataDir();
    if (!DATA_DIR_LOGGED) {
      console.log('[local-job-store] DATA_DIR:', DATA_DIR);
      DATA_DIR_LOGGED = true;
    }
  }
  return DATA_DIR;
};

const REVIEWS_DIR = () => path.join(getDataDirOnce(), 'reviews');

/**
 * Get the reviews directory path
 */
export function getReviewDir(): string {
  return REVIEWS_DIR();
}

/**
 * Get the file path for a review by jobId
 */
function getReviewFilePath(jobId: string): string {
  return path.join(REVIEWS_DIR(), `${jobId}.json`);
}

/**
 * Load a review record by jobId
 * @returns ReviewRecord if found, null if not found
 */
export async function loadReview(jobId: string): Promise<ReviewRecord | null> {
  const filePath = getReviewFilePath(jobId);

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    return ReviewRecordSchema.parse(parsed);
  } catch (error) {
    // File doesn't exist -> return null
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    // Other errors (parse, validation) -> rethrow
    throw error;
  }
}

/**
 * Save a review record atomically (write to temp file, then rename)
 */
export async function saveReview(review: ReviewRecord): Promise<void> {
  // Ensure reviews directory exists
  await fs.mkdir(REVIEWS_DIR(), { recursive: true });

  const filePath = getReviewFilePath(review.jobId);
  const tempFilePath = `${filePath}.tmp`;

  // Validate the review before saving
  const validated = ReviewRecordSchema.parse(review);

  // Write to temp file first
  await fs.writeFile(tempFilePath, JSON.stringify(validated, null, 2), 'utf-8');

  // Atomically rename temp file to final file
  await fs.rename(tempFilePath, filePath);
}

/**
 * Get an existing review or create an empty one (does NOT save it)
 * @returns ReviewRecord (empty if not found)
 */
export async function getOrCreateReview(jobId: string): Promise<ReviewRecord> {
  const existing = await loadReview(jobId);

  if (existing) {
    return existing;
  }

  // Return empty review record
  const now = new Date().toISOString();
  return {
    version: '1.0.0',
    jobId,
    createdAt: now,
    updatedAt: now,
    annotations: [],
  };
}

