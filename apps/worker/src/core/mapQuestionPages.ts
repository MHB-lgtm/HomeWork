import * as fs from 'fs/promises';
import * as path from 'path';
import { JobRecord } from '@hg/local-job-store';
import { GeminiService } from '../services/geminiService';
import { QuestionMappingSchema, QuestionMapping } from '@hg/shared-schemas';

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

export type MapQuestionPagesResult = { ok: true; mapping: QuestionMapping } | { ok: false; error: string };

/**
 * Map questionId to page indices where its answer appears in the submission
 * Best-effort: failures don't fail the job
 */
export async function mapQuestionPages(job: JobRecord): Promise<MapQuestionPagesResult> {
  try {
    const gradingMode = job.inputs.gradingMode || 'RUBRIC';
    const gradingScope = job.inputs.gradingScope || 'QUESTION';
    const questionId = job.inputs.questionId;

    if (gradingMode !== 'GENERAL') {
      return { ok: false, error: 'mapQuestionPages can only be used for GENERAL grading mode' };
    }

    if (gradingScope !== 'QUESTION') {
      return { ok: false, error: 'mapQuestionPages can only be used for QUESTION scope' };
    }

    if (!questionId) {
      return { ok: false, error: 'questionId is required for QUESTION scope mapping' };
    }

    // Read exam file (required)
    const examBuffer = await fs.readFile(job.inputs.examFilePath);
    const examMimeType = inferMimeType(job.inputs.examFilePath);
    const examBase64 = examBuffer.toString('base64');

    // Read submission file (required)
    const submissionBuffer = await fs.readFile(job.inputs.submissionFilePath);
    const submissionMimeType = job.inputs.submissionMimeType || inferMimeType(job.inputs.submissionFilePath);
    const submissionBase64 = submissionBuffer.toString('base64');

    console.log(`[worker] Mapping question ${questionId} pages for job ${job.id}`);

    // Build prompt
    const prompt = `You are analyzing a student's homework submission to locate where a specific question's answer appears.

TASK:
Locate where the student's answer to questionId="${questionId}" appears in the submission.

IMPORTANT:
- Return ONLY valid JSON (no markdown, no code fences, no explanations).
- For PDF submissions: identify which page(s) contain the answer (0-based: first page is 0, second page is 1, etc.).
- For image submissions: always return pageIndices: [0] since it's a single-page image.
- pageIndices must be unique, sorted (ascending), and between 1-10 pages.
- confidence: your confidence level (0.0 to 1.0) that these pages contain the answer.
- If unsure, return your best guess with lower confidence and a reasonable page range.

OUTPUT FORMAT (strict JSON):
{
  "questionId": "${questionId}",
  "pageIndices": [<integer >= 0>, ...],  // 0-based, unique, sorted, length 1..10
  "confidence": <number 0..1>
}

Return the JSON now:`;

    // Build parts array with prompt, exam file, and submission file
    const parts = [
      { text: prompt },
      {
        inlineData: {
          data: examBase64,
          mimeType: examMimeType,
        },
      },
      {
        inlineData: {
          data: submissionBase64,
          mimeType: submissionMimeType,
        },
      },
    ];

    // Call Gemini with retry logic (one retry on validation failure)
    const geminiService = new GeminiService();
    let rawOutput: string;
    let mapping: QuestionMapping | null = null;

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
          const preview = rawOutput.length > 200 ? rawOutput.substring(0, 200) : rawOutput;
          return {
            ok: false,
            error: `Failed to parse JSON from Gemini response. First 200 chars: ${preview}`,
          };
        }

        // Validate against schema
        try {
          mapping = QuestionMappingSchema.parse(parsed);
        } catch (error) {
          if (attempt === 0) {
            // Retry on validation failure
            continue;
          }
          const preview = rawOutput.length > 200 ? rawOutput.substring(0, 200) : rawOutput;
          const validationError = error instanceof Error ? error.message : String(error);
          return {
            ok: false,
            error: `Question mapping validation failed: ${validationError}. First 200 chars: ${preview}`,
          };
        }

        // Validate questionId matches
        if (mapping.questionId !== questionId) {
          return {
            ok: false,
            error: `questionId mismatch: expected "${questionId}", got "${mapping.questionId}"`,
          };
        }

        // Success - break out of retry loop
        break;
      } catch (error) {
        if (attempt === 1) {
          // Last attempt failed
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            ok: false,
            error: `Gemini API call failed: ${errorMessage}`,
          };
        }
        // Retry on API error
        continue;
      }
    }

    if (!mapping) {
      return {
        ok: false,
        error: 'Failed to get mapping after retries',
      };
    }

    console.log(`[worker] Question ${questionId} mapped to pages: [${mapping.pageIndices.join(', ')}] (confidence: ${mapping.confidence})`);
    return { ok: true, mapping };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: `Question mapping failed: ${errorMessage}`,
    };
  }
}
