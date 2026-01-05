import * as fs from 'fs/promises';
import * as path from 'path';
import { JobRecord } from '../storage/types';
import { GeminiService } from '../services/geminiService';
import { validateEvaluationResult, EvaluationResult } from '@hg/shared-schemas';

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

export async function gradeSubmission(job: JobRecord): Promise<EvaluationResult> {
  // Read both files
  const questionBuffer = await fs.readFile(job.inputs.questionFilePath);
  const submissionBuffer = await fs.readFile(job.inputs.submissionFilePath);

  // Infer MIME types
  const questionMimeType = inferMimeType(job.inputs.questionFilePath);
  const submissionMimeType = inferMimeType(job.inputs.submissionFilePath);

  // Convert to base64
  const questionBase64 = questionBuffer.toString('base64');
  const submissionBase64 = submissionBuffer.toString('base64');

  // Build inlineData parts
  const questionInlinePart = {
    inlineData: {
      data: questionBase64,
      mimeType: questionMimeType,
    },
  };

  const submissionInlinePart = {
    inlineData: {
      data: submissionBase64,
      mimeType: submissionMimeType,
    },
  };

  // Build prompt
  const prompt = `You are grading a student's homework submission. Analyze the question image and the student's submission image.

Return ONLY valid JSON (no markdown, no code fences, no explanations). The JSON must match this exact structure:

{
  "score_total": <number between 0 and 100>,
  "confidence": <number between 0 and 1>,
  "summary_feedback": "<string>",
  "flags": [<array of strings>],
  "criteria": [
    {
      "id": "<string>",
      "title": "<string>",
      "max_score": <number>,
      "score": <number>,
      "comment": "<string>",
      "evidence": "<string>" (optional)
    }
  ]
}

${job.inputs.notes ? `Additional grading notes: ${job.inputs.notes}` : ''}

Return the JSON now:`;

  // Create GeminiService and generate response
  const geminiService = new GeminiService();
  const parts = [
    { text: prompt },
    questionInlinePart,
    submissionInlinePart,
  ];

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

  // Validate against schema
  try {
    return validateEvaluationResult(parsed);
  } catch (error) {
    const preview = rawOutput.length > 200 ? rawOutput.substring(0, 200) : rawOutput;
    const validationError = error instanceof Error ? error.message : String(error);
    throw new Error(`Validation failed: ${validationError}. First 200 chars of response: ${preview}`);
  }
}

