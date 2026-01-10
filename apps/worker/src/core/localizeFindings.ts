import * as fs from 'fs/promises';
import * as path from 'path';
import { JobRecord } from '@hg/local-job-store';
import { GeminiService } from '../services/geminiService';
import {
  GeneralEvaluation,
  GeneralFindingsLocalizationSchema,
  Annotation,
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
    throw new Error(`Unsupported file extension for localization: ${ext}. Supported: .png, .jpg, .jpeg, .webp, .pdf`);
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

export type LocalizeFindingsInput = {
  job: JobRecord;
  generalEvaluation: GeneralEvaluation;
};

/**
 * Localize findings to bounding boxes (best-effort, does not fail the job on error)
 * Maps Findings -> evidence boxes (pageIndex + bboxNorm) and converts to ReviewRecord annotations
 */
export async function localizeFindings(
  input: LocalizeFindingsInput
): Promise<{ ok: true; annotations: Annotation[] } | { ok: false; error: string }> {
  try {
    const { job, generalEvaluation } = input;

    // Extract findings from GeneralEvaluation (handle both legacy and new formats)
    let allFindings: Array<{ findingId: string; title: string; description: string }>;
    if ('questions' in generalEvaluation && Array.isArray(generalEvaluation.questions)) {
      // New format: per-question findings
      allFindings = generalEvaluation.questions.flatMap((q) => q.findings);
    } else if ('findings' in generalEvaluation && Array.isArray(generalEvaluation.findings)) {
      // Legacy format: top-level findings
      allFindings = generalEvaluation.findings;
    } else {
      return { ok: true, annotations: [] };
    }

    // If no findings, return empty annotations
    if (allFindings.length === 0) {
      return { ok: true, annotations: [] };
    }

    // Read submission file
    const submissionBuffer = await fs.readFile(job.inputs.submissionFilePath);
    const submissionMimeType = job.inputs.submissionMimeType || inferMimeType(job.inputs.submissionFilePath);
    const submissionBase64 = submissionBuffer.toString('base64');

    // Build findings list for prompt
    const findingsList = allFindings
      .map(
        (f) =>
          `- ${f.findingId}: ${f.title} - ${f.description.substring(0, 200)}${f.description.length > 200 ? '...' : ''}`
      )
      .join('\n');

    // Determine if submission is image or PDF
    const isImage = submissionMimeType.startsWith('image/');
    const isPdf = submissionMimeType === 'application/pdf';

    // Build prompt
    const prompt = `You are locating evidence regions for each finding in the student's submission.

FINDINGS TO LOCATE:
${findingsList}

TASK:
For each finding listed above, identify the exact location(s) in the submission where the evidence for that finding appears. Draw bounding box(es) around the relevant area(s).

IMPORTANT RULES:
- Return ONLY valid JSON (no markdown, no code fences, no explanations).
- ${isImage ? 'Since this is an image file, ALWAYS use pageIndex: 0 for all boxes.' : ''}
- ${isPdf ? 'Since this is a PDF file, set the correct pageIndex (0-based: first page is 0, second page is 1, etc.) for each box.' : ''}
- Provide normalized bounding box coordinates (x, y, w, h) where:
  - x, y: top-left corner coordinates (0.0 to 1.0)
  - w, h: width and height (0.0 to 1.0)
  - All values must be in the range [0, 1]
  - w and h must be greater than 0
- Encourage 1-2 boxes per finding, but allow multiple if needed (e.g., if the same mistake appears in multiple places).
- Avoid duplicate boxes for the same finding (merge if identical regions).
- findingId must match one of the finding IDs listed above (no extras).

OUTPUT FORMAT (strict JSON):
{
  "boxes": [
    {
      "findingId": "<string>",  // must match one of the finding IDs above
      "pageIndex": <integer >= 0>,  // ${isImage ? 'always 0 for images' : '0-based page number for PDFs'}
      "bboxNorm": {
        "x": <number 0..1>,
        "y": <number 0..1>,
        "w": <number 0..1, must be > 0>,
        "h": <number 0..1, must be > 0>
      },
      "confidence": <number 0..1>  // optional, your confidence that this box correctly identifies the evidence
    }
  ]
}

Return the JSON now:`;

    // Build parts array with prompt and submission file
    const parts = [
      { text: prompt },
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
    let localizationOutput: any;

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
          localizationOutput = GeneralFindingsLocalizationSchema.parse(parsed);
        } catch (error) {
          if (attempt === 0) {
            // Retry on validation failure
            continue;
          }
          const preview = rawOutput.length > 200 ? rawOutput.substring(0, 200) : rawOutput;
          const validationError = error instanceof Error ? error.message : String(error);
          return {
            ok: false,
            error: `Localization output validation failed: ${validationError}. First 200 chars: ${preview}`,
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

    // Guardrails: validate findingId belongs to findings list
    const findingIds = new Set(allFindings.map((f) => f.findingId));
    const invalidFindingIds: string[] = [];
    for (const box of localizationOutput.boxes) {
      if (!findingIds.has(box.findingId)) {
        invalidFindingIds.push(box.findingId);
      }
    }

    if (invalidFindingIds.length > 0) {
      return {
        ok: false,
        error: `Invalid findingId(s) in boxes: ${invalidFindingIds.join(', ')}. Must be one of: ${Array.from(findingIds).join(', ')}`,
      };
    }

    // Guardrails: validate pageIndex for images (must be 0)
    if (isImage) {
      const invalidPageIndices = localizationOutput.boxes.filter((box: any) => box.pageIndex !== 0);
      if (invalidPageIndices.length > 0) {
        return {
          ok: false,
          error: `For image files, all boxes must have pageIndex: 0. Found invalid pageIndex values.`,
        };
      }
    }

    // Convert boxes -> ReviewRecord annotations
    const now = new Date().toISOString();
    const annotations: Annotation[] = localizationOutput.boxes.map((box: any) => {
      // Find the corresponding finding for label/comment
      const finding = allFindings.find((f) => f.findingId === box.findingId);
      
      // Generate stable-ish ID: ai-finding-{findingId}-{timestamp}-{rand}
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 9);
      const id = `ai-finding-${box.findingId}-${timestamp}-${random}`;

      return {
        id,
        criterionId: box.findingId, // Reuse criterionId field as generic key
        pageIndex: box.pageIndex,
        bboxNorm: box.bboxNorm,
        label: finding?.title, // Use finding title as label
        comment: finding?.description, // Use finding description as comment
        createdBy: 'ai',
        confidence: box.confidence ?? 0.5, // Default to 0.5 if not provided
        status: 'proposed',
        createdAt: now,
        updatedAt: now,
      };
    });

    return { ok: true, annotations };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: `Localization failed: ${errorMessage}`,
    };
  }
}
