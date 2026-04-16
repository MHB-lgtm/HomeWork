import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  LegacyReviewContextRecord,
  RuntimeJobClaimRecord,
} from '@hg/postgres-store';
import type { ReviewRecord } from '@hg/shared-schemas';
import { gradeSubmission } from '../core/gradeSubmission';
import { generalEvaluatePerQuestion } from '../core/generalEvaluatePerQuestion';
import { localizeMistakes } from '../core/localizeMistakes';
import { localizeFindingsPerQuestion } from '../core/localizeFindingsPerQuestion';
import { attachStudyPointers } from '../core/attachStudyPointers';
import { getWorkerRuntimePersistence } from './runtimePersistence';
import type { WorkerJobRecord } from '../types/workerJobRecord';

export interface ProcessResult {
  processed: boolean;
  jobId?: string;
}

type ProcessNextPendingJobOptions = {
  workerId: string;
  leaseMs?: number;
};

const DEFAULT_LEASE_MS = 30_000;

const toWorkerJobRecord = (job: RuntimeJobClaimRecord): WorkerJobRecord => ({
  id: job.jobId,
  status: job.status,
  createdAt: job.createdAt,
  updatedAt: job.updatedAt,
  inputs: {
    jobKind: job.jobKind,
    courseId: job.courseId ?? undefined,
    examId: job.examId ?? undefined,
    assignmentId: job.assignmentId ?? undefined,
    examFilePath: job.examFilePath ?? '',
    promptFilePath: job.promptFilePath ?? undefined,
    referenceSolutionFilePath: job.referenceSolutionFilePath ?? undefined,
    questionId: job.questionId ?? '',
    submissionFilePath: job.submissionFilePath,
    submissionMimeType: job.submissionMimeType ?? undefined,
    questionFilePath: job.questionFilePath ?? undefined,
    notes: job.notes ?? undefined,
    gradingMode: job.gradingMode ?? undefined,
    gradingScope: job.gradingScope ?? undefined,
  },
  versions: {
    prompt_version: '1.0.0',
    rubric_version: '1.0.0',
    model_version: 'gemini-1.5-pro',
  },
  rubric: job.rubric ?? undefined,
  resultJson: job.resultJson ?? undefined,
  errorMessage: job.errorMessage ?? undefined,
});

const createEmptyReviewRecord = (jobId: string, createdAt: string): ReviewRecord => ({
  version: '1.0.0',
  jobId,
  createdAt,
  updatedAt: createdAt,
  annotations: [],
});

const loadOrCreateRuntimeReviewRecord = async (
  job: RuntimeJobClaimRecord
): Promise<ReviewRecord> => {
  const persistence = getWorkerRuntimePersistence();
  const existing = await persistence.reviewRecords.getReviewRecordByLegacyJobId(job.jobId);
  return existing ?? createEmptyReviewRecord(job.jobId, job.createdAt);
};

const buildReviewContext = (
  job: RuntimeJobClaimRecord,
  resultJson: unknown,
  errorMessage: string | null = null
): LegacyReviewContextRecord => ({
  status: errorMessage ? 'FAILED' : 'DONE',
  resultJson: resultJson ?? null,
  errorMessage,
  submissionMimeType: job.submissionMimeType ?? null,
  gradingMode: job.gradingMode ?? null,
  gradingScope: job.gradingScope ?? null,
});

/**
 * Process the next pending job if available.
 * Returns { processed: false } if no job is available, { processed: true, jobId } otherwise.
 */
export async function processNextPendingJob(
  options: ProcessNextPendingJobOptions
): Promise<ProcessResult> {
  const persistence = getWorkerRuntimePersistence();
  const leaseMs = options.leaseMs ?? DEFAULT_LEASE_MS;
  const claimedJob = await persistence.jobs.claimNextPendingJob({
    workerId: options.workerId,
    leaseMs,
  });

  if (!claimedJob) {
    return { processed: false };
  }

  const job = toWorkerJobRecord(claimedJob);
  const jobId = job.id;
  const jobKind = job.inputs.jobKind || 'EXAM';
  const gradingMode = job.inputs.gradingMode || 'RUBRIC';
  console.log(`[worker] Processing job ${jobId} (kind: ${jobKind}, mode: ${gradingMode})`);

  const renewTimer = setInterval(() => {
    void persistence.jobs
      .renewLease({
        jobId,
        workerId: options.workerId,
        leaseMs,
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[worker] Failed to renew lease for ${jobId}: ${message}`);
      });
  }, Math.max(5_000, Math.floor(leaseMs / 2)));
  renewTimer.unref?.();

  try {
    let resultJson: any;
    let annotations: ReviewRecord['annotations'] = [];

    if (gradingMode === 'GENERAL') {
      const generalResult = await generalEvaluatePerQuestion(job);
      resultJson = {
        mode: 'GENERAL',
        generalEvaluation: generalResult.result,
      };

      const allAnnotations: ReviewRecord['annotations'] = [];

      if ('questions' in generalResult.result && Array.isArray(generalResult.result.questions)) {
        for (const questionEval of generalResult.result.questions) {
          let miniPdfPath: string | undefined;
          try {
            const dataDir = process.env.HG_DATA_DIR;
            if (dataDir) {
              const miniPdfPathCandidate = path.join(
                dataDir,
                'uploads',
                'derived',
                jobId,
                'questions',
                `${questionEval.questionId}.pdf`
              );
              await fs.access(miniPdfPathCandidate);
              miniPdfPath = miniPdfPathCandidate;
            }
          } catch {
            miniPdfPath = undefined;
          }

          const localizationResult = await localizeFindingsPerQuestion({
            job,
            questionId: questionEval.questionId,
            pageIndices: questionEval.pageIndices,
            miniPdfPath,
            findings: questionEval.findings,
          });

          if (localizationResult.ok) {
            allAnnotations.push(...localizationResult.annotations);
            console.log(
              `[job:${jobId}] Question ${questionEval.questionId} localization: ${localizationResult.annotations.length} annotations`
            );
          } else {
            console.warn(
              `[job:${jobId}] Question ${questionEval.questionId} localization failed: ${localizationResult.error}`
            );
          }
        }
      }

      annotations = allAnnotations.slice(0, 200);
      console.log(`[job:${jobId}] General mode total annotations: ${annotations.length}`);
    } else {
      const gradeResult = await gradeSubmission(job);
      resultJson = {
        mode: 'RUBRIC',
        rubricEvaluation: gradeResult.result,
      };

      const localizationResult = await localizeMistakes({
        jobId,
        questionId: job.inputs.questionId,
        submissionFilePath: job.inputs.submissionFilePath,
        rubricEvaluation: gradeResult.result,
      });

      if (localizationResult.ok) {
        annotations = localizationResult.annotations;
        console.log(`[job:${jobId}] annotations generated: ${localizationResult.annotations.length}`);
      } else {
        annotations = [];
        console.warn(`[job:${jobId}] annotations generation failed: ${localizationResult.error}`);
      }
    }

    try {
      const studyPointers = await attachStudyPointers({ job, resultJson });
      if (studyPointers) {
        resultJson.studyPointers = studyPointers;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[job:${jobId}] studyPointers failed: ${message}`);
    }

    const review = await loadOrCreateRuntimeReviewRecord(claimedJob);
    await persistence.reviewRecords.saveReviewRecordByLegacyJobId(
      jobId,
      {
        ...review,
        annotations,
        updatedAt: new Date().toISOString(),
      },
      {
        context: buildReviewContext(claimedJob, resultJson),
      }
    );

    await persistence.jobs.completeJob({
      jobId,
      workerId: options.workerId,
      resultJson,
    });

    console.log(`[worker] Completed job ${jobId}`);
    return { processed: true, jobId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    try {
      await persistence.jobs.failJob({
        jobId,
        workerId: options.workerId,
        errorMessage,
      });
    } catch (failError) {
      const failMessage = failError instanceof Error ? failError.message : String(failError);
      console.error(`[worker] Failed to mark job ${jobId} as failed: ${failMessage}`);
    }

    console.error(`[worker] Job ${jobId} failed: ${errorMessage}`);
    return { processed: true, jobId };
  } finally {
    clearInterval(renewTimer);
  }
}
