import * as fs from 'fs/promises';
import * as path from 'path';
import { JobRecord, JobStatus } from './types';
import { RubricSpec } from '@hg/shared-schemas';

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

const UPLOADS_DIR = () => path.join(getDataDirOnce(), 'uploads');
const JOBS_DIR = () => path.join(getDataDirOnce(), 'jobs');
const PENDING_DIR = () => path.join(JOBS_DIR(), 'pending');
const RUNNING_DIR = () => path.join(JOBS_DIR(), 'running');
const DONE_DIR = () => path.join(JOBS_DIR(), 'done');
const FAILED_DIR = () => path.join(JOBS_DIR(), 'failed');

/**
 * Ensure all required directories exist
 */
export async function ensureJobDirs(): Promise<void> {
  await fs.mkdir(UPLOADS_DIR(), { recursive: true });
  await fs.mkdir(PENDING_DIR(), { recursive: true });
  await fs.mkdir(RUNNING_DIR(), { recursive: true });
  await fs.mkdir(DONE_DIR(), { recursive: true });
  await fs.mkdir(FAILED_DIR(), { recursive: true });
}

interface CreateJobParams {
  examSourcePath: string;
  questionId: string;
  submissionSourcePath: string;
  questionSourcePath?: string;
  notes?: string;
  rubric?: RubricSpec;
}

/**
 * Create a new job and write it to pending folder
 */
export async function createJob(params: CreateJobParams): Promise<{ jobId: string }> {
  await ensureJobDirs();

  const jobId = `job-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date().toISOString();

  // Copy exam file to uploads with unique name (preserve extension)
  const examExt = path.extname(params.examSourcePath);
  const examBaseName = path.basename(params.examSourcePath, examExt);
  const examFileName = `${examBaseName}_${jobId}${examExt}`;
  const examFilePath = path.join(UPLOADS_DIR(), examFileName);
  await fs.copyFile(params.examSourcePath, examFilePath);

  // Copy submission file to uploads with unique name (preserve extension)
  const submissionExt = path.extname(params.submissionSourcePath);
  const submissionBaseName = path.basename(params.submissionSourcePath, submissionExt);
  const submissionFileName = `${submissionBaseName}_${jobId}${submissionExt}`;
  const submissionFilePath = path.join(UPLOADS_DIR(), submissionFileName);
  await fs.copyFile(params.submissionSourcePath, submissionFilePath);

  // Copy optional question file if provided
  let questionFilePath: string | undefined;
  if (params.questionSourcePath) {
    const questionExt = path.extname(params.questionSourcePath);
    const questionBaseName = path.basename(params.questionSourcePath, questionExt);
    const questionFileName = `${questionBaseName}_${jobId}${questionExt}`;
    questionFilePath = path.join(UPLOADS_DIR(), questionFileName);
    await fs.copyFile(params.questionSourcePath, questionFilePath);
  }

  const job: JobRecord = {
    id: jobId,
    status: 'PENDING',
    createdAt: now,
    updatedAt: now,
    inputs: {
      examFilePath,
      questionId: params.questionId,
      submissionFilePath,
      questionFilePath,
      notes: params.notes,
    },
    versions: {
      prompt_version: '1.0.0',
      rubric_version: '1.0.0',
      model_version: 'gemini-1.5-pro',
    },
    rubric: params.rubric,
  };

  const jobFilePath = path.join(PENDING_DIR(), `${jobId}.json`);
  await fs.writeFile(jobFilePath, JSON.stringify(job, null, 2), 'utf-8');

  return { jobId };
}

/**
 * Get a job by ID, searching in all status folders
 */
export async function getJob(jobId: string): Promise<JobRecord | null> {
  const folders = [PENDING_DIR(), RUNNING_DIR(), DONE_DIR(), FAILED_DIR()];

  for (const folder of folders) {
    const filePath = path.join(folder, `${jobId}.json`);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as JobRecord;
    } catch (error) {
      // File doesn't exist in this folder, continue searching
      continue;
    }
  }

  return null;
}

/**
 * Atomically claim the next pending job by moving it to running
 * Returns null if no pending jobs exist
 */
export async function claimNextPendingJob(): Promise<JobRecord | null> {
  try {
    const files = await fs.readdir(PENDING_DIR());
    const jsonFiles = files.filter((f) => f.endsWith('.json'));

    if (jsonFiles.length === 0) {
      return null;
    }

    // Get file stats and sort by mtime (oldest first)
    const filesWithStats = await Promise.all(
      jsonFiles.map(async (file) => {
        const filePath = path.join(PENDING_DIR(), file);
        const stats = await fs.stat(filePath);
        return { file, mtime: stats.mtime.getTime() };
      })
    );

    filesWithStats.sort((a, b) => a.mtime - b.mtime);
    const oldestFile = filesWithStats[0].file;

    const pendingPath = path.join(PENDING_DIR(), oldestFile);
    const runningPath = path.join(RUNNING_DIR(), oldestFile);

    // Read the job file
    const content = await fs.readFile(pendingPath, 'utf-8');
    const job: JobRecord = JSON.parse(content);

    // Atomically rename (this is the lock mechanism)
    await fs.rename(pendingPath, runningPath);

    // Update status and timestamp
    job.status = 'RUNNING';
    job.updatedAt = new Date().toISOString();

    // Write updated job back to running folder
    await fs.writeFile(runningPath, JSON.stringify(job, null, 2), 'utf-8');

    return job;
  } catch (error) {
    // If directory doesn't exist or other error, return null
    return null;
  }
}

/**
 * Complete a job by moving it from running to done
 */
export async function completeJob(jobId: string, resultJson: unknown): Promise<void> {
  const runningPath = path.join(RUNNING_DIR(), `${jobId}.json`);
  const donePath = path.join(DONE_DIR(), `${jobId}.json`);

  const content = await fs.readFile(runningPath, 'utf-8');
  const job: JobRecord = JSON.parse(content);

  job.status = 'DONE';
  job.updatedAt = new Date().toISOString();
  job.resultJson = resultJson;

  await fs.writeFile(donePath, JSON.stringify(job, null, 2), 'utf-8');
  await fs.unlink(runningPath);
}

/**
 * Fail a job by moving it from running to failed
 */
export async function failJob(jobId: string, errorMessage: string): Promise<void> {
  const runningPath = path.join(RUNNING_DIR(), `${jobId}.json`);
  const failedPath = path.join(FAILED_DIR(), `${jobId}.json`);

  const content = await fs.readFile(runningPath, 'utf-8');
  const job: JobRecord = JSON.parse(content);

  job.status = 'FAILED';
  job.updatedAt = new Date().toISOString();
  job.errorMessage = errorMessage;

  await fs.writeFile(failedPath, JSON.stringify(job, null, 2), 'utf-8');
  await fs.unlink(runningPath);
}

