import * as fs from 'fs/promises';
import * as path from 'path';
import { JobRecord } from '@hg/local-job-store';
import { GeminiService } from '../services/geminiService';
import { GeneralEvaluationSchema, GeneralEvaluation } from '@hg/shared-schemas';

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

type GeneralEvaluateResult = { type: 'general'; result: GeneralEvaluation };

/**
 * Evaluate submission in General mode (findings-only, no scoring)
 */
export async function generalEvaluateSubmission(job: JobRecord): Promise<GeneralEvaluateResult> {
  const gradingMode = job.inputs.gradingMode || 'RUBRIC';
  const gradingScope = job.inputs.gradingScope || 'QUESTION';

  if (gradingMode !== 'GENERAL') {
    throw new Error('generalEvaluateSubmission can only be used for GENERAL grading mode');
  }

  // Read exam file (required)
  const examBuffer = await fs.readFile(job.inputs.examFilePath);
  const examMimeType = inferMimeType(job.inputs.examFilePath);
  const examBase64 = examBuffer.toString('base64');

  // Read submission file (required)
  const submissionBuffer = await fs.readFile(job.inputs.submissionFilePath);
  const submissionMimeType = job.inputs.submissionMimeType || inferMimeType(job.inputs.submissionFilePath);
  const submissionBase64 = submissionBuffer.toString('base64');

  // Read optional question image if provided
  let questionInlinePart: { inlineData: { data: string; mimeType: string } } | null = null;
  const hasQuestionFallback = Boolean(job.inputs.questionFilePath);

  if (job.inputs.questionFilePath) {
    const questionBuffer = await fs.readFile(job.inputs.questionFilePath);
    const questionMimeType = inferMimeType(job.inputs.questionFilePath);
    const questionBase64 = questionBuffer.toString('base64');
    questionInlinePart = {
      inlineData: {
        data: questionBase64,
        mimeType: questionMimeType,
      },
    };
  }

  console.log(`[worker] Processing General mode job ${job.id}: scope=${gradingScope}, question fallback: ${hasQuestionFallback ? 'yes' : 'no'}`);

  // Build inlineData parts
  const examInlinePart = {
    inlineData: {
      data: examBase64,
      mimeType: examMimeType,
    },
  };

  const submissionInlinePart = {
    inlineData: {
      data: submissionBase64,
      mimeType: submissionMimeType,
    },
  };

  // Build prompt based on scope
  const examId = path.basename(job.inputs.examFilePath, path.extname(job.inputs.examFilePath));
  const questionId = job.inputs.questionId || '';

  let scopeInstruction: string;
  let scopeJson: { type: 'QUESTION'; questionId: string } | { type: 'DOCUMENT' };

  if (gradingScope === 'QUESTION') {
    if (!questionId) {
      throw new Error('questionId is required for QUESTION scope');
    }
    scopeInstruction = `Focus ONLY on questionId="${questionId}" from the exam file. Do NOT evaluate other questions.`;
    scopeJson = { type: 'QUESTION', questionId };
  } else {
    scopeInstruction = 'Evaluate the ENTIRE submission document. Look for mistakes across all questions.';
    scopeJson = { type: 'DOCUMENT' };
  }

  const prompt = `You are a strict exam evaluator. Your task is to find ALL mistakes and issues in the student's submission.

IMPORTANT:
- Return ONLY valid JSON (no markdown, no code fences, no explanations before or after).
- NO scoring. Only list findings (mistakes, issues, problems).
- Be strict: list every mistake you can find.
- No duplicates: merge similar issues into a single finding.
- Use stable IDs: F1, F2, F3, ... up to F30 maximum.

${scopeInstruction}
- The exam file is the PRIMARY source. ${hasQuestionFallback ? 'A fallback question image is also provided.' : ''}

CRITICAL RULES:
1) DO NOT correct the student's notation. Identify what is wrong, not what you think they meant.
2) Be specific: each finding should clearly identify what is wrong and where.
3) Severity levels:
   - "critical": Fundamental errors that invalidate the solution
   - "major": Significant mistakes that affect correctness
   - "minor": Small errors, typos, or minor issues
4) Confidence: 0.0 to 1.0 (how certain you are about this finding)
5) Suggestion (optional): How to fix or improve

JSON format (strict):
{
  "examId": "${examId}",
  "scope": ${JSON.stringify(scopeJson)},
  "findings": [
    {
      "findingId": "F1",
      "title": "Short title of the issue",
      "description": "Detailed description of what is wrong",
      "severity": "critical" | "major" | "minor",
      "confidence": 0.95,
      "suggestion": "Optional suggestion for improvement"
    }
  ],
  "overallSummary": "Optional overall summary of the evaluation"
}

If the submission is perfect (no mistakes found), return:
{
  "examId": "${examId}",
  "scope": ${JSON.stringify(scopeJson)},
  "findings": [],
  "overallSummary": "No mistakes found. The submission appears to be correct."
}

Return the JSON now.`;

  // Create GeminiService and generate response
  const geminiService = new GeminiService();
  const parts = [
    { text: prompt },
    examInlinePart,
    submissionInlinePart,
  ];

  // Add optional question image part if provided
  if (questionInlinePart) {
    parts.push(questionInlinePart);
  }

  // Retry logic: try once, retry once if validation fails
  let rawOutput: string;
  let parsed: unknown;
  let generalEvaluation: GeneralEvaluation | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[worker] Retrying General evaluation for job ${job.id} (attempt ${attempt + 1})`);
      }

      // Generate response from Gemini
      rawOutput = await geminiService.generateFromParts(parts);

      // Parse JSON robustly
      try {
        const jsonText = extractJsonFromText(rawOutput);
        parsed = JSON.parse(jsonText);
      } catch (error) {
        const preview = rawOutput.length > 200 ? rawOutput.substring(0, 200) : rawOutput;
        throw new Error(`Failed to parse JSON from Gemini response. First 200 chars: ${preview}`);
      }

      // Validate against GeneralEvaluationSchema
      try {
        generalEvaluation = GeneralEvaluationSchema.parse(parsed);
        // Success - break out of retry loop
        break;
      } catch (error) {
        const validationError = error instanceof Error ? error.message : String(error);
        if (attempt === 0) {
          // First attempt failed validation, retry
          console.warn(`[worker] General evaluation validation failed (attempt ${attempt + 1}): ${validationError}`);
          continue;
        } else {
          // Second attempt also failed
          const preview = rawOutput.length > 200 ? rawOutput.substring(0, 200) : rawOutput;
          throw new Error(`GeneralEvaluation validation failed after retry: ${validationError}. First 200 chars: ${preview}`);
        }
      }
    } catch (error) {
      if (attempt === 0 && error instanceof Error && error.message.includes('validation failed')) {
        // Validation error - retry
        continue;
      }
      // Other errors or second attempt failed - throw
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Gemini API error: ${errorMessage}`);
    }
  }

  if (!generalEvaluation) {
    throw new Error('Failed to generate General evaluation after retries');
  }

  return { type: 'general', result: generalEvaluation };
}
