import { claimNextJob, completeJob, failJob, getOrCreateReview, saveReview } from '@hg/local-job-store';
import { gradeSubmission } from '../core/gradeSubmission';
import { generalEvaluatePerQuestion } from '../core/generalEvaluatePerQuestion';
import { localizeMistakes } from '../core/localizeMistakes';
import { localizeFindingsPerQuestion } from '../core/localizeFindingsPerQuestion';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface ProcessResult {
  processed: boolean;
  jobId?: string;
}

/**
 * Process the next pending job if available
 * @returns { processed: false } if no job found, { processed: true, jobId } if processed
 */
export async function processNextPendingJob(): Promise<ProcessResult> {
  const job = await claimNextJob();

  if (!job) {
    return { processed: false };
  }

  const jobId = job.id;
  const gradingMode = job.inputs.gradingMode || 'RUBRIC';
  console.log(`[worker] Processing job ${jobId} (mode: ${gradingMode})`);

  try {
    let resultJson: any;

    if (gradingMode === 'GENERAL') {
      // General mode: per-question evaluation
      const generalResult = await generalEvaluatePerQuestion(job);
      resultJson = {
        mode: 'GENERAL',
        generalEvaluation: generalResult.result,
      };

      // Run localization per question (best-effort)
      const review = await getOrCreateReview(jobId);
      const allAnnotations: any[] = [];

      // Check if result has questions array (new format)
      if ('questions' in generalResult.result && Array.isArray(generalResult.result.questions)) {
        for (const questionEval of generalResult.result.questions) {
          // Determine mini-PDF path if it exists
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
              // Check if file exists
              await fs.access(miniPdfPathCandidate);
              miniPdfPath = miniPdfPathCandidate;
            }
          } catch {
            // Mini-PDF doesn't exist - that's OK, will use original submission
          }

          // Run localization for this question
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
            // Localization failed for this question - log warning but continue
            console.warn(`[job:${jobId}] Question ${questionEval.questionId} localization failed: ${localizationResult.error}`);
          }
        }
      }

      // Cap total annotations (max 200 overall)
      const cappedAnnotations = allAnnotations.slice(0, 200);

      // Save ReviewRecord with all annotations
      review.annotations = cappedAnnotations;
      review.updatedAt = new Date().toISOString();
      await saveReview(review);
      console.log(`[job:${jobId}] General mode total annotations: ${cappedAnnotations.length}`);
    } else {
      // Rubric mode: existing behavior
      const gradeResult = await gradeSubmission(job);

      // Prepare result JSON
      resultJson = {
        mode: 'RUBRIC', // Explicitly set mode for rubric jobs
        rubricEvaluation: gradeResult.result,
      };

      // Run localization pass to generate annotations
      const localizationResult = await localizeMistakes({
        jobId,
        questionId: job.inputs.questionId,
        submissionFilePath: job.inputs.submissionFilePath,
        rubricEvaluation: gradeResult.result,
      });

      // Ensure ReviewRecord exists and save annotations
      const review = await getOrCreateReview(jobId);
      if (localizationResult.ok) {
        review.annotations = localizationResult.annotations;
        review.updatedAt = new Date().toISOString();
        await saveReview(review);
        console.log(`[job:${jobId}] annotations generated: ${localizationResult.annotations.length}`);
      } else {
        // Localization failed - save review with empty annotations
        review.annotations = [];
        review.updatedAt = new Date().toISOString();
        await saveReview(review);
        console.warn(`[job:${jobId}] annotations generation failed: ${localizationResult.error}`);
      }
    }

    // Complete the job
    await completeJob(jobId, resultJson);

    console.log(`[worker] Completed job ${jobId}`);
    return { processed: true, jobId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await failJob(jobId, errorMessage);
    console.error(`[worker] Job ${jobId} failed: ${errorMessage}`);
    return { processed: true, jobId };
  }
}

