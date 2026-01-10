import * as fs from 'fs/promises';
import * as path from 'path';
import { JobRecord } from '@hg/local-job-store';
import { GeminiService } from '../services/geminiService';
import {
  GeneralEvaluationSchema,
  GeneralEvaluation,
  QuestionEvaluation,
  FindingSchema,
} from '@hg/shared-schemas';
import { listExamQuestionIds } from './listExamQuestionIds';
import { mapQuestionPages } from './mapQuestionPages';
import { extractMiniPdf } from './extractMiniPdf';

function inferMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
  };

  const mimeType = mimeMap[ext];
  if (!mimeType) {
    throw new Error(`Unsupported file extension: ${ext}. Supported: .png, .jpg, .jpeg, .webp, .pdf`);
  }

  return mimeType;
}

function extractJsonFromText(text: string): string {
  // Remove markdown code fences if present
  let cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

  // Find first { and last }
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('No valid JSON object found in response');
  }

  return cleaned.substring(firstBrace, lastBrace + 1);
}

type GeneralEvaluatePerQuestionResult = { type: 'general'; result: GeneralEvaluation };

/**
 * Evaluate submission per-question in General mode
 * For each questionId: maps pages, extracts mini-PDF if needed, and evaluates with >=3 findings
 */
export async function generalEvaluatePerQuestion(job: JobRecord): Promise<GeneralEvaluatePerQuestionResult> {
  const gradingMode = job.inputs.gradingMode || 'RUBRIC';
  const gradingScope = job.inputs.gradingScope || 'QUESTION';

  if (gradingMode !== 'GENERAL') {
    throw new Error('generalEvaluatePerQuestion can only be used for GENERAL grading mode');
  }

  // Read exam file (required)
  const examBuffer = await fs.readFile(job.inputs.examFilePath);
  const examMimeType = inferMimeType(job.inputs.examFilePath);
  const examBase64 = examBuffer.toString('base64');
  const examId = path.basename(job.inputs.examFilePath, path.extname(job.inputs.examFilePath));

  // Determine questionIds
  let questionIds: string[];
  if (gradingScope === 'QUESTION') {
    const questionId = job.inputs.questionId;
    if (!questionId) {
      throw new Error('questionId is required for QUESTION scope');
    }
    questionIds = [questionId];
  } else {
    // DOCUMENT scope: list questionIds from rubrics
    questionIds = await listExamQuestionIds(examId);
    if (questionIds.length === 0) {
      // Fallback: use single "DOCUMENT" questionId
      questionIds = ['DOCUMENT'];
    }
  }

  console.log(`[worker] Processing General mode per-question job ${job.id}: scope=${gradingScope}, questions=${questionIds.length}`);

  // Read submission file once
  const submissionBuffer = await fs.readFile(job.inputs.submissionFilePath);
  const submissionMimeType = job.inputs.submissionMimeType || inferMimeType(job.inputs.submissionFilePath);
  const isPdf = submissionMimeType === 'application/pdf';

  // Process each question sequentially
  const questionEvaluations: QuestionEvaluation[] = [];

  for (const questionId of questionIds) {
    console.log(`[worker] Processing question ${questionId}...`);

    let pageIndices: number[] | undefined;
    let mappingConfidence: number | undefined;
    let submissionPart: { inlineData: { data: string; mimeType: string } };

    // Step 1: Map pages (if not DOCUMENT)
    if (questionId !== 'DOCUMENT') {
      // Create a temporary job-like object for mapping
      const mappingJob: JobRecord = {
        ...job,
        inputs: {
          ...job.inputs,
          questionId,
          gradingScope: 'QUESTION',
        },
      };
      const mappingResult = await mapQuestionPages(mappingJob);
      if (mappingResult.ok) {
        pageIndices = mappingResult.mapping.pageIndices;
        mappingConfidence = mappingResult.mapping.confidence;
      } else {
        console.warn(`[worker] Question ${questionId} mapping failed: ${mappingResult.error}, using full submission`);
      }
    }

    // Step 2: Prepare submission part (mini-PDF or original)
    if (isPdf && pageIndices && pageIndices.length > 0) {
      const extractResult = await extractMiniPdf(
        job.inputs.submissionFilePath,
        pageIndices,
        job.id,
        questionId
      );
      if (extractResult.ok) {
        // Use mini-PDF
        const miniPdfBuffer = await fs.readFile(extractResult.outputPath);
        const miniPdfBase64 = miniPdfBuffer.toString('base64');
        submissionPart = {
          inlineData: {
            data: miniPdfBase64,
            mimeType: 'application/pdf',
          },
        };
        console.log(`[worker] Using mini-PDF for question ${questionId}`);
      } else {
        // Fallback to original submission
        console.warn(`[worker] Mini-PDF extraction failed for question ${questionId}: ${extractResult.error}, using original submission`);
        submissionPart = {
          inlineData: {
            data: submissionBuffer.toString('base64'),
            mimeType: submissionMimeType,
          },
        };
      }
    } else {
      // Use original submission (image or PDF without mapping)
      submissionPart = {
        inlineData: {
          data: submissionBuffer.toString('base64'),
          mimeType: submissionMimeType,
        },
      };
    }

    // Step 3: Build prompt and call Gemini
    const scopeInstruction =
      questionId === 'DOCUMENT'
        ? 'Evaluate the ENTIRE submission document. Look for mistakes across all questions.'
        : `Focus ONLY on questionId="${questionId}" from the exam file. Do NOT evaluate other questions.`;

    const prompt = `You are a strict exam evaluator. Your task is to find ALL mistakes and strengths in the student's submission for a specific question.

IMPORTANT:
- Return ONLY valid JSON (no markdown, no code fences, no explanations).
- NO scoring. Only list findings (mistakes/issues and strengths).
- Be strict: list every mistake and strength you can find.
- No duplicates: merge similar issues into a single finding.
- Use stable IDs: ${questionId}-F1, ${questionId}-F2, ${questionId}-F3, ... (prefixed with questionId).

${scopeInstruction}

CRITICAL REQUIREMENTS:
1) You MUST return at least 3 findings.
2) You MUST include at least 1 finding with kind="strength" (what the student did well).
3) You MUST include at least 1 finding with kind="issue" (mistakes/problems).
4) For issues: include severity ("critical", "major", or "minor").
5) For strengths: severity is optional/ignored.
6) Confidence: 0.0 to 1.0 (how certain you are about this finding).
7) Suggestion (optional): How to fix or improve.

JSON format (strict):
{
  "questionId": "${questionId}",
  "findings": [
    {
      "findingId": "${questionId}-F1",
      "title": "<short title>",
      "description": "<detailed description>",
      "kind": "issue" | "strength",
      "severity": "critical" | "major" | "minor",  // required for issues, optional for strengths
      "confidence": <number 0..1>,
      "suggestion": "<optional suggestion>"
    },
    ...
  ],
  "overallSummary": "<optional summary for this question>"
}

Return the JSON now:`;

    // Build parts array
    const parts = [
      { text: prompt },
      {
        inlineData: {
          data: examBase64,
          mimeType: examMimeType,
        },
      },
      submissionPart,
    ];

    // Call Gemini with retry logic
    const geminiService = new GeminiService();
    let rawOutput: string;
    let questionEval: QuestionEvaluation | null = null;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        // Generate response
        rawOutput = await geminiService.generateFromParts(parts);

        // Parse JSON robustly
        let parsed: unknown;
        try {
          const jsonText = extractJsonFromText(rawOutput);
          parsed = JSON.parse(jsonText);
        } catch (error) {
          if (attempt === 0) {
            // Retry on JSON parse failure
            continue;
          }
          throw new Error(`Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`);
        }

        // Validate structure (must have questionId and findings)
        if (typeof parsed !== 'object' || parsed === null) {
          throw new Error('Response is not an object');
        }

        const parsedObj = parsed as Record<string, unknown>;
        if (parsedObj.questionId !== questionId) {
          throw new Error(`questionId mismatch: expected "${questionId}", got "${parsedObj.questionId}"`);
        }

        // Validate findings array
        const findingsArray = Array.isArray(parsedObj.findings) ? parsedObj.findings : [];
        if (findingsArray.length < 3) {
          if (attempt === 0) {
            // Retry with repair prompt
            const repairPrompt = `${prompt}\n\nIMPORTANT: You must return at least 3 findings, including at least 1 strength and 1 issue. Please try again.`;
            parts[0] = { text: repairPrompt };
            continue;
          }
          throw new Error(`Invalid findings: must have at least 3 findings, got ${findingsArray.length}`);
        }

        // Validate each finding
        const findings = findingsArray.map((f: unknown) => FindingSchema.parse(f));
        const strengths = findings.filter((f) => f.kind === 'strength');
        const issues = findings.filter((f) => f.kind !== 'strength'); // includes undefined (defaults to issue)

        if (strengths.length < 1 || issues.length < 1) {
          if (attempt === 0) {
            // Retry with repair prompt
            const repairPrompt = `${prompt}\n\nIMPORTANT: You must include at least 1 finding with kind="strength" and at least 1 finding with kind="issue". Please try again.`;
            parts[0] = { text: repairPrompt };
            continue;
          }
          throw new Error(`Invalid findings: must include at least 1 strength and 1 issue. Got ${strengths.length} strengths and ${issues.length} issues.`);
        }

        // Build question evaluation
        questionEval = {
          questionId,
          pageIndices,
          mappingConfidence,
          findings,
          overallSummary: typeof parsedObj.overallSummary === 'string' ? parsedObj.overallSummary : undefined,
        };

        // Success - break out of retry loop
        break;
      } catch (error) {
        if (attempt === 1) {
          // Last attempt failed
          const errorMessage = error instanceof Error ? error.message : String(error);
          throw new Error(`Failed to evaluate question ${questionId}: ${errorMessage}`);
        }
        // Retry on error
        continue;
      }
    }

    if (!questionEval) {
      throw new Error(`Failed to evaluate question ${questionId} after retries`);
    }

    questionEvaluations.push(questionEval);
    console.log(`[worker] Question ${questionId} evaluated: ${questionEval.findings.length} findings`);
  }

  // Build final GeneralEvaluation
  const scope =
    gradingScope === 'QUESTION'
      ? { type: 'QUESTION' as const, questionId: questionIds[0] }
      : { type: 'DOCUMENT' as const };

  const result: GeneralEvaluation = {
    examId,
    scope,
    questions: questionEvaluations,
  };

  // Validate final result
  const validated = GeneralEvaluationSchema.parse(result);

  return { type: 'general', result: validated };
}
