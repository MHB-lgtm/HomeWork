import * as fs from 'fs/promises';
import * as path from 'path';
import { GeminiService } from '../services/geminiService';
import {
  GeneralFindingsLocalizationV1Schema,
  Finding,
  Annotation,
} from '@hg/shared-schemas';
import type { WorkerJobRecord } from '../types/workerJobRecord';

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

export type LocalizeFindingsPerQuestionInput = {
  job: WorkerJobRecord;
  questionId: string;
  pageIndices?: number[]; // original submission pages selected for mini-PDF (0-based)
  miniPdfPath?: string; // created in PR B; contains full pages in the same order as pageIndices
  findings: Finding[];
};

export type LocalizeFindingsPerQuestionResult =
  | { ok: true; annotations: Annotation[] }
  | { ok: false; error: string };

/**
 * Localize findings to bounding boxes for a single question (best-effort, does not fail the job on error)
 * If mini-PDF was used, translates pageIndex from mini-PDF coordinates to original submission coordinates
 */
export async function localizeFindingsPerQuestion(
  input: LocalizeFindingsPerQuestionInput
): Promise<LocalizeFindingsPerQuestionResult> {
  try {
    const { job, questionId, pageIndices, miniPdfPath, findings } = input;

    // If no findings, return empty annotations
    if (findings.length === 0) {
      return { ok: true, annotations: [] };
    }

    // Step 1: Choose the document to localize on
    let submissionPart: { inlineData: { data: string; mimeType: string } };
    let isUsingMiniPdf = false;

    if (miniPdfPath) {
      try {
        // Check if mini-PDF exists
        await fs.access(miniPdfPath);
        const miniPdfBuffer = await fs.readFile(miniPdfPath);
        const miniPdfBase64 = miniPdfBuffer.toString('base64');
        submissionPart = {
          inlineData: {
            data: miniPdfBase64,
            mimeType: 'application/pdf',
          },
        };
        isUsingMiniPdf = true;
        console.log(`[worker] Using mini-PDF for question ${questionId} localization`);
      } catch {
        // Mini-PDF doesn't exist or can't be read - fallback to original
        console.warn(`[worker] Mini-PDF not found for question ${questionId}, using original submission`);
        const submissionBuffer = await fs.readFile(job.inputs.submissionFilePath);
        const submissionMimeType = job.inputs.submissionMimeType || inferMimeType(job.inputs.submissionFilePath);
        submissionPart = {
          inlineData: {
            data: submissionBuffer.toString('base64'),
            mimeType: submissionMimeType,
          },
        };
      }
    } else {
      // Use original submission
      const submissionBuffer = await fs.readFile(job.inputs.submissionFilePath);
      const submissionMimeType = job.inputs.submissionMimeType || inferMimeType(job.inputs.submissionFilePath);
      submissionPart = {
        inlineData: {
          data: submissionBuffer.toString('base64'),
          mimeType: submissionMimeType,
        },
      };
    }

    const isImage = submissionPart.inlineData.mimeType.startsWith('image/');
    const isPdf = submissionPart.inlineData.mimeType === 'application/pdf';

    // Step 2: Build findings list for prompt
    const findingsList = findings
      .map(
        (f) =>
          `- ${f.findingId}: ${f.title} - ${f.description.substring(0, 150)}${f.description.length > 150 ? '...' : ''}`
      )
      .join('\n');

    // Step 3: Build prompt
    const prompt = `You are locating evidence regions for each finding in the student's submission.

FINDINGS TO LOCATE:
${findingsList}

TASK:
For each finding listed above, identify the exact location(s) in the submission where the evidence for that finding appears. Draw bounding box(es) around the relevant area(s).

IMPORTANT RULES:
- Return ONLY valid JSON (no markdown, no code fences, no explanations).
- ${isImage ? 'Since this is an image file, ALWAYS use pageIndex: 0 for all boxes.' : ''}
- ${isPdf ? 'Since this is a PDF file, set the correct pageIndex (0-based: first page is 0, second page is 1, etc.) for each box relative to the document you are analyzing.' : ''}
- Provide normalized bounding box coordinates (x, y, w, h) where:
  - x, y: top-left corner coordinates (0.0 to 1.0)
  - w, h: width and height (0.0 to 1.0)
  - All values must be in the range [0, 1]
  - w and h must be greater than 0
- Encourage 1-2 boxes per finding, but allow multiple if needed (e.g., if the same mistake appears in multiple places).
- Avoid duplicate boxes for the same finding (merge if identical regions).
- findingId must match one of the finding IDs listed above (no extras).
- If truly no evidence exists for a finding, you may return 0 boxes for it, but prefer at least 1 box per finding.

OUTPUT FORMAT (strict JSON):
{
  "boxes": [
    {
      "findingId": "<string>",  // must match one of the finding IDs above
      "pageIndex": <integer >= 0>,  // ${isImage ? 'always 0 for images' : '0-based page number relative to the document you are analyzing'}
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

    // Step 4: Call Gemini with retry logic
    const geminiService = new GeminiService();
    const parts = [{ text: prompt }, submissionPart];
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
          localizationOutput = GeneralFindingsLocalizationV1Schema.parse(parsed);
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

    // Step 5: Guardrails - validate findingId belongs to findings list
    const findingIds = new Set(findings.map((f) => f.findingId));
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

    // Step 6: Guardrails - validate pageIndex for images (must be 0)
    if (isImage) {
      const invalidPageIndices = localizationOutput.boxes.filter((box: any) => box.pageIndex !== 0);
      if (invalidPageIndices.length > 0) {
        return {
          ok: false,
          error: `For image files, all boxes must have pageIndex: 0. Found invalid pageIndex values.`,
        };
      }
    }

    // Step 7: Translate pageIndex if mini-PDF was used
    // If miniPdfPath was used AND pageIndices[] exists:
    //   - The model returns pageIndex relative to mini-PDF page order (0..miniPages-1)
    //   - Translate: originalPageIndex = pageIndices[miniPageIndex]
    //   - Keep bboxNorm unchanged (since we copied full pages)
    const translatedBoxes = localizationOutput.boxes.map((box: any) => {
      let originalPageIndex = box.pageIndex;

      if (isUsingMiniPdf && pageIndices && pageIndices.length > 0) {
        // Translate from mini-PDF page index to original submission page index
        if (box.pageIndex >= 0 && box.pageIndex < pageIndices.length) {
          originalPageIndex = pageIndices[box.pageIndex];
        } else {
          // Invalid pageIndex in mini-PDF - log warning but use as-is
          console.warn(
            `[worker] Invalid pageIndex ${box.pageIndex} in mini-PDF for question ${questionId} (mini-PDF has ${pageIndices.length} pages), using as-is`
          );
        }
      }

      return {
        ...box,
        pageIndex: originalPageIndex,
      };
    });

    // Step 8: Convert boxes -> ReviewRecord annotations
    const now = new Date().toISOString();
    const annotations: Annotation[] = translatedBoxes.map((box: any) => {
      // Find the corresponding finding for label/comment
      const finding = findings.find((f) => f.findingId === box.findingId);

      // Generate stable-ish ID: ai-{findingId}-{timestamp}-{rand}
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 9);
      const id = `ai-${box.findingId}-${timestamp}-${random}`;

      return {
        id,
        criterionId: box.findingId, // Reuse criterionId field as generic key
        pageIndex: box.pageIndex, // Translated originalPageIndex
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

    console.log(`[worker] Question ${questionId} localization: ${annotations.length} annotations generated`);
    return { ok: true, annotations };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: `Localization failed: ${errorMessage}`,
    };
  }
}
