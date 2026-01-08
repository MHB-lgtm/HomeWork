import * as fs from 'fs/promises';
import * as path from 'path';
import { JobRecord } from '@hg/local-job-store';
import { GeminiService } from '../services/geminiService';
import {
  RubricEvaluationRawSchema,
  normalizeAndValidateRubricEvaluation,
  RubricEvaluationResult,
  RubricValidationError,
} from '@hg/shared-schemas';

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

type GradeSubmissionResult = { type: 'rubric'; result: RubricEvaluationResult };

export async function gradeSubmission(job: JobRecord): Promise<GradeSubmissionResult> {
  if (!job.rubric) {
    throw new Error('Rubric is required for grading');
  }

  // Read exam file (required)
  const examBuffer = await fs.readFile(job.inputs.examFilePath);
  const examMimeType = inferMimeType(job.inputs.examFilePath);
  const examBase64 = examBuffer.toString('base64');

  // Read submission file (required)
  const submissionBuffer = await fs.readFile(job.inputs.submissionFilePath);
  const submissionMimeType = inferMimeType(job.inputs.submissionFilePath);
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

  // Log whether fallback image was attached
  console.log(`[worker] Processing job ${job.id}: exam file attached, question fallback: ${hasQuestionFallback ? 'yes' : 'no'}`);

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

  // Rubric-based grading
  const rubric = job.rubric;

  // Build prompt for rubric evaluation
  const criteriaList = rubric.criteria
    .map(
      (c: { id: string; kind: string; maxPoints: number; label: string; guidance?: string }) =>
        `- ${c.id} (${c.kind}, max ${c.maxPoints} points): ${c.label}${c.guidance ? ` - ${c.guidance}` : ''}`
    )
    .join('\n');

  const prompt = `You are a strict exam grader.

IMPORTANT:
- Grade ONLY questionId="${job.inputs.questionId}" from the exam file provided.
- The exam file is the PRIMARY source. ${hasQuestionFallback ? 'A fallback question image is also provided.' : ''}

CRITICAL RULES (must follow):
1) DO NOT correct the student's notation. Grade what is written, not what you think they meant.
2) First do a Transcription Phase (mandatory):
   - Transcribe the key mathematical lines needed for grading into LaTeX EXACTLY as they appear.
   - If the student wrote "x" (no subscript), write "x". Do NOT change it to "x_0".
   - If you cannot confidently distinguish between x and x_0, write "[AMBIGUOUS: x vs x_0]".
3) Then do the Grading Phase:
   - Base ALL scores ONLY on your transcription (not on assumptions).
   - If a crucial symbol is ambiguous (e.g., x vs x_0 in epsilon), you MUST score conservatively (stricter interpretation).

MANDATORY CONSISTENCY CHECK:
- Check whether epsilon is defined using x_0 (constant) versus x (variable).
- If epsilon depends on the variable x, it is invalid for that criterion.

Rubric for ${rubric.examId}/${rubric.questionId}:
${rubric.title ? `Title: ${rubric.title}` : ''}
${rubric.generalGuidance ? `General Guidance: ${rubric.generalGuidance}` : ''}

Criteria:
${criteriaList}

OUTPUT REQUIREMENTS:
- Return ONLY valid JSON (no markdown, no code fences, no explanations).
- Each criterion feedback MUST include:
  (a) "EVIDENCE:" followed by a short LaTeX snippet from your transcription OR "EVIDENCE: NOT_FOUND"
  (b) If ambiguity exists, include "AMBIGUITY:".

JSON format:
{
  "examId": "${rubric.examId}",
  "questionId": "${rubric.questionId}",
  "criteria": [
    { "criterionId": "<string>", "score": <integer>, "feedback": "<string>" }
  ],
  "overallFeedback": "<string>" (optional)
}

If you cannot locate the question in the exam, return:
{
  "examId": "${rubric.examId}",
  "questionId": "${rubric.questionId}",
  "error": "QUESTION_NOT_FOUND_IN_EXAM",
  "reason": "<explanation>"
}

Now perform:
Step 1: Transcription Phase.
Step 2: Grading Phase.
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

  let rawOutput: string;
  try {
    rawOutput = await geminiService.generateFromParts(parts);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Gemini API error: ${errorMessage}`);
  }

  // Parse JSON robustly
  let parsed: unknown;
  try {
    const jsonText = extractJsonFromText(rawOutput);
    parsed = JSON.parse(jsonText);
  } catch (error) {
    const preview = rawOutput.length > 200 ? rawOutput.substring(0, 200) : rawOutput;
    throw new Error(`Failed to parse JSON from Gemini response. First 200 chars: ${preview}`);
  }

  // Check for question not found error in response
  if (typeof parsed === 'object' && parsed !== null && 'error' in parsed) {
    const errorObj = parsed as { error?: string; reason?: string };
    if (errorObj.error === 'QUESTION_NOT_FOUND_IN_EXAM') {
      throw new Error(`QUESTION_NOT_FOUND_IN_EXAM: ${errorObj.reason || 'Could not locate question in exam'}`);
    }
  }

  // Validate against RubricEvaluationRawSchema
  let rawEvaluation;
  try {
    rawEvaluation = RubricEvaluationRawSchema.parse(parsed);
  } catch (error) {
    const preview = rawOutput.length > 200 ? rawOutput.substring(0, 200) : rawOutput;
    const validationError = error instanceof Error ? error.message : String(error);
    throw new Error(`RubricEvaluationRaw validation failed: ${validationError}. First 200 chars: ${preview}`);
  }

  // Normalize and validate against rubric
  try {
    const normalized = normalizeAndValidateRubricEvaluation(rubric, rawEvaluation);
    return { type: 'rubric', result: normalized };
  } catch (error) {
    if (error instanceof RubricValidationError) {
      throw new Error(`Rubric validation failed [${error.code}]: ${error.message}`);
    }
    throw error;
  }
}
