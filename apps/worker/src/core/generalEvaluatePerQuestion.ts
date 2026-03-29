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
import { loadExamIndexForWorker, resolveExamId } from './loadExamIndex';
import { ExamIndex, QuestionEntry } from '@hg/shared-schemas';

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

const MIN_FINDINGS_PER_QUESTION = 1;
const MAX_FINDINGS_PER_QUESTION = 2;
const MAX_FINDING_TITLE_CHARS = 60;
const MAX_FINDING_DESCRIPTION_CHARS = 120;
const MAX_FINDING_SUGGESTION_CHARS = 100;
const MAX_SUMMARY_CHARS = 420;
const MAX_SUMMARY_LINES = 3;

function compactInlineText(text: string, maxChars: number): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, maxChars).trim();
}

function compactSummaryText(summary: string): string {
  const lines = summary
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, MAX_SUMMARY_LINES);
  return lines.join('\n').slice(0, MAX_SUMMARY_CHARS).trim();
}

function normalizeFindingTextFields<T extends { title: string; description: string; suggestion?: string }>(
  finding: T
): T {
  const normalized = {
    ...finding,
    title: compactInlineText(finding.title, MAX_FINDING_TITLE_CHARS),
    description: compactInlineText(finding.description, MAX_FINDING_DESCRIPTION_CHARS),
  };

  if (finding.suggestion) {
    normalized.suggestion = compactInlineText(finding.suggestion, MAX_FINDING_SUGGESTION_CHARS);
  }

  return normalized;
}

function buildFallbackSummary(questionId: string, findings: Array<{ title: string; description: string }>): string {
  const points = findings
    .map((finding) => compactInlineText(finding.title || finding.description, 90))
    .filter(Boolean)
    .slice(0, MAX_SUMMARY_LINES);

  if (points.length === 0) {
    return compactSummaryText(`Summary for ${questionId}: review completed.`);
  }

  if (points.length === 1) {
    return compactSummaryText(`Main point: ${points[0]}`);
  }

  return compactSummaryText(points.join('\n'));
}

/**
 * Evaluate submission per-question in General mode
 * For each questionId: maps pages, extracts mini-PDF if needed, and evaluates with >=1 finding
 */
export async function generalEvaluatePerQuestion(job: JobRecord): Promise<GeneralEvaluatePerQuestionResult> {
  const gradingMode = job.inputs.gradingMode || 'RUBRIC';
  const gradingScope = job.inputs.gradingScope || 'QUESTION';

  if (gradingMode !== 'GENERAL') {
    throw new Error('generalEvaluatePerQuestion can only be used for GENERAL grading mode');
  }

  // Resolve examId from the DB-authored runtime job payload.
  const examId = await resolveExamId(job);
  if (!examId) {
    console.warn(`[worker] Cannot resolve examId for job ${job.id}, falling back to DOCUMENT scope`);
    // Fallback: use single "DOCUMENT" questionId
    const questionEntries = [{ questionId: 'DOCUMENT' }];
    const examBuffer = await fs.readFile(job.inputs.examFilePath);
    const examMimeType = inferMimeType(job.inputs.examFilePath);
    const examBase64 = examBuffer.toString('base64');
    const submissionBuffer = await fs.readFile(job.inputs.submissionFilePath);
    const submissionMimeType = job.inputs.submissionMimeType || inferMimeType(job.inputs.submissionFilePath);
    const submissionBase64 = submissionBuffer.toString('base64');
    const scopeInstruction = 'Evaluate the ENTIRE submission document. Look for mistakes across all questions.';
    const prompt = `You are a strict exam evaluator. Your task is to find the most important mistakes and strengths in the student's submission.

IMPORTANT:
- Return ONLY valid JSON (no markdown, no code fences, no explanations).
- NO scoring. Only list findings (mistakes/issues and strengths).
- Be concise and specific.
- No duplicates: merge similar issues into a single finding.
- Use stable IDs: DOCUMENT-F1, DOCUMENT-F2 (prefixed with DOCUMENT).

${scopeInstruction}

CRITICAL REQUIREMENTS:
1) You MUST return at least 1 finding and at most 2 findings.
2) Use kind="issue" for mistakes/problems and kind="strength" for positive points.
3) If no issues are found, return at least one meaningful strength finding.
4) For issues: include severity ("critical", "major", or "minor").
5) For strengths: severity is optional/ignored.
6) Confidence: 0.0 to 1.0 (how certain you are about this finding).
7) Suggestion (optional): How to fix or improve.
8) Each finding must be short and to the point:
   - title: short phrase (keep it brief)
   - description: one short, focused sentence
9) "overallSummary" is REQUIRED and can be up to 3 short lines.

JSON format (strict):
{
  "questionId": "DOCUMENT",
  "findings": [
    {
      "findingId": "DOCUMENT-F1",
      "title": "<short title>",
      "description": "<one short focused sentence>",
      "kind": "issue" | "strength",
      "severity": "critical" | "major" | "minor",
      "confidence": <number 0..1>,
      "suggestion": "<optional suggestion>"
    }
  ],
  "overallSummary": "<required summary, up to 3 short lines>"
}

Return the JSON now:`;

    const parts = [
      { text: prompt },
      { inlineData: { data: examBase64, mimeType: examMimeType } },
      { inlineData: { data: submissionBase64, mimeType: submissionMimeType } },
    ];

    const geminiService = new GeminiService();
    const rawOutput = await geminiService.generateFromParts(parts);
    const jsonText = extractJsonFromText(rawOutput);
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    const findingsArray = Array.isArray(parsed.findings) ? parsed.findings : [];
    if (findingsArray.length < MIN_FINDINGS_PER_QUESTION) {
      throw new Error(
        `Invalid findings: must have at least ${MIN_FINDINGS_PER_QUESTION} finding, got ${findingsArray.length}`
      );
    }

    const findings = findingsArray
      .slice(0, MAX_FINDINGS_PER_QUESTION)
      .map((f: unknown) => normalizeFindingTextFields(FindingSchema.parse(f)));
    const overallSummary =
      compactSummaryText(typeof parsed.overallSummary === 'string' ? parsed.overallSummary : '') ||
      buildFallbackSummary('DOCUMENT', findings);
    
    const result: GeneralEvaluation = {
      examId: 'unknown',
      scope: { type: 'DOCUMENT' },
      questions: [{
        questionId: 'DOCUMENT',
        findings,
        overallSummary,
      }],
    };

    return { type: 'general', result: GeneralEvaluationSchema.parse(result) };
  }

  // Read exam file (required)
  const examBuffer = await fs.readFile(job.inputs.examFilePath);
  const examMimeType = inferMimeType(job.inputs.examFilePath);
  const examBase64 = examBuffer.toString('base64');

  // Determine questionIds and question metadata
  let questionEntries: Array<{ questionId: string; order?: number; displayLabel?: string; promptText?: string; aliases?: string[] }> = [];
  
  if (gradingScope === 'QUESTION') {
    const questionId = job.inputs.questionId;
    if (!questionId) {
      throw new Error('questionId is required for QUESTION scope');
    }
    questionEntries = [{ questionId }];
  } else {
    // DOCUMENT scope: try the DB-backed exam index first, then fall back to a single DOCUMENT scope.
    const examIndex = await loadExamIndexForWorker(examId);
    if (examIndex && examIndex.questions && examIndex.questions.length > 0) {
      // Use ExamIndex: sort by order and extract metadata
      questionEntries = examIndex.questions
        .sort((a, b) => a.order - b.order)
        .map((q: QuestionEntry) => ({
          questionId: q.id,
          order: q.order,
          displayLabel: q.displayLabel,
          promptText: q.promptText,
          aliases: q.aliases,
        }));
      console.log(`[worker] Using ExamIndex for examId=${examId}: ${questionEntries.length} questions`);
    } else {
      // Fallback: derive ordered question ids from the stored exam index payload.
      const questionIds = await listExamQuestionIds(examId);
      if (questionIds.length > 0) {
        questionEntries = questionIds.map((id) => ({ questionId: id }));
        console.log(`[worker] Loaded ordered question ids for examId=${examId}: ${questionIds.length} questions`);
      } else {
        // Final fallback: use single "DOCUMENT" questionId
        questionEntries = [{ questionId: 'DOCUMENT' }];
        console.log(`[worker] No stored exam index for examId=${examId}, using DOCUMENT scope`);
      }
    }
  }

  console.log(`[worker] Processing General mode per-question job ${job.id}: scope=${gradingScope}, questions=${questionEntries.length}`);

  // Read submission file once
  const submissionBuffer = await fs.readFile(job.inputs.submissionFilePath);
  const submissionMimeType = job.inputs.submissionMimeType || inferMimeType(job.inputs.submissionFilePath);
  const isPdf = submissionMimeType === 'application/pdf';

  // Process each question sequentially
  const questionEvaluations: QuestionEvaluation[] = [];

  for (const questionEntry of questionEntries) {
    const { questionId, order, displayLabel, promptText, aliases } = questionEntry;
    console.log(`[worker] Processing question ${questionId}${displayLabel ? ` (${displayLabel})` : ''}...`);

    let pageIndices: number[] | undefined;
    let mappingConfidence: number | undefined;
    let submissionPart: { inlineData: { data: string; mimeType: string } };

    // Step 1: Map pages (if not DOCUMENT)
    if (questionId !== 'DOCUMENT') {
      // Create a temporary job-like object for mapping with question metadata
      const mappingJob: JobRecord = {
        ...job,
        inputs: {
          ...job.inputs,
          questionId,
          gradingScope: 'QUESTION',
        },
      };
      const mappingResult = await mapQuestionPages(mappingJob, {
        displayLabel,
        aliases: aliases || [],
        promptText,
      });
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
        : promptText
        ? `Focus ONLY on this specific question from the exam:\n\nQUESTION: ${promptText}\n\n${displayLabel ? `(Label: ${displayLabel})` : `(Question ID: ${questionId})`}\n\nDo NOT evaluate other questions.`
        : `Focus ONLY on questionId="${questionId}"${displayLabel ? ` (${displayLabel})` : ''} from the exam file. Do NOT evaluate other questions.`;

    const prompt = `You are a strict exam evaluator. Your task is to find the most important mistakes and strengths in the student's submission for a specific question.

IMPORTANT:
- Return ONLY valid JSON (no markdown, no code fences, no explanations).
- NO scoring. Only list findings (mistakes/issues and strengths).
- Be concise and specific.
- No duplicates: merge similar issues into a single finding.
- Use stable IDs: ${questionId}-F1, ${questionId}-F2 (prefixed with questionId).

${scopeInstruction}

CRITICAL REQUIREMENTS:
1) You MUST return at least 1 finding and at most 2 findings.
2) Use kind="issue" for mistakes/problems and kind="strength" for positive points.
3) If no issues are found, return at least one meaningful strength finding.
4) For issues: include severity ("critical", "major", or "minor").
5) For strengths: severity is optional/ignored.
6) Confidence: 0.0 to 1.0 (how certain you are about this finding).
7) Suggestion (optional): How to fix or improve.
8) Each finding must be short and to the point:
   - title: short phrase (keep it brief)
   - description: one short, focused sentence
9) "overallSummary" is REQUIRED and can be up to 3 short lines.

JSON format (strict):
{
  "questionId": "${questionId}",
  "findings": [
    {
      "findingId": "${questionId}-F1",
      "title": "<short title>",
      "description": "<one short focused sentence>",
      "kind": "issue" | "strength",
      "severity": "critical" | "major" | "minor",  // required for issues, optional for strengths
      "confidence": <number 0..1>,
      "suggestion": "<optional suggestion>"
    }
  ],
  "overallSummary": "<required summary for this question, up to 3 short lines>"
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
        if (
          findingsArray.length < MIN_FINDINGS_PER_QUESTION ||
          findingsArray.length > MAX_FINDINGS_PER_QUESTION
        ) {
          if (attempt === 0) {
            // Retry with repair prompt
            const repairPrompt = `${prompt}\n\nIMPORTANT REPAIR: Return 1-2 findings only and include required overallSummary (up to 3 short lines).`;
            parts[0] = { text: repairPrompt };
            continue;
          }
          if (findingsArray.length < MIN_FINDINGS_PER_QUESTION) {
            throw new Error(
              `Invalid findings: must have at least ${MIN_FINDINGS_PER_QUESTION} finding, got ${findingsArray.length}`
            );
          }
        }

        // Validate each finding
        const findings = findingsArray
          .slice(0, MAX_FINDINGS_PER_QUESTION)
          .map((f: unknown) => normalizeFindingTextFields(FindingSchema.parse(f)));

        let overallSummary = compactSummaryText(
          typeof parsedObj.overallSummary === 'string' ? parsedObj.overallSummary : ''
        );
        if (!overallSummary) {
          if (attempt === 0) {
            const repairPrompt = `${prompt}\n\nIMPORTANT REPAIR: overallSummary is required and should be up to 3 short lines.`;
            parts[0] = { text: repairPrompt };
            continue;
          }
          overallSummary = buildFallbackSummary(questionId, findings);
        }

        // Build question evaluation with metadata
        questionEval = {
          questionId,
          order,
          displayLabel,
          promptText,
          pageIndices,
          mappingConfidence,
          findings,
          overallSummary,
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
      ? { type: 'QUESTION' as const, questionId: questionEntries[0].questionId }
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
