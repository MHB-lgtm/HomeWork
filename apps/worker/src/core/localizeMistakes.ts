import * as fs from 'fs/promises';
import * as path from 'path';
import { z } from 'zod';
import { RubricEvaluationResult, Annotation, BBoxNormSchema } from '@hg/shared-schemas';
import { GeminiService } from '../services/geminiService';

function inferMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
  };

  const mimeType = mimeMap[ext];
  if (!mimeType) {
    throw new Error(`Unsupported file extension for localization: ${ext}. Supported: .png, .jpg, .jpeg, .webp`);
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

/**
 * Schema for raw localization output from Gemini
 */
const LocalizationOutputSchema = z.object({
  annotations: z.array(
    z.object({
      criterionId: z.string(),
      pageIndex: z.literal(0),
      bboxNorm: BBoxNormSchema,
      label: z.string().optional(),
      comment: z.string().optional(),
      confidence: z.number().min(0).max(1),
    })
  ),
});

type LocalizationOutput = z.infer<typeof LocalizationOutputSchema>;

export type LocalizeInput = {
  jobId: string;
  questionId: string;
  submissionFilePath: string;
  rubricEvaluation: RubricEvaluationResult;
};

/**
 * Localize mistakes in the submission image by generating bounding box annotations
 * for criteria where score < maxPoints.
 */
export async function localizeMistakes(
  input: LocalizeInput
): Promise<{ ok: true; annotations: Annotation[] } | { ok: false; error: string }> {
  try {
    // Identify target criteria (where score < maxPoints)
    const targetCriteria = input.rubricEvaluation.criteria.filter(
      (c) => c.score < c.maxPoints
    );

    // If no target criteria, return empty annotations
    if (targetCriteria.length === 0) {
      return { ok: true, annotations: [] };
    }

    // Read submission file
    const submissionBuffer = await fs.readFile(input.submissionFilePath);
    const submissionMimeType = inferMimeType(input.submissionFilePath);
    const submissionBase64 = submissionBuffer.toString('base64');

    // Build prompt
    const criteriaList = targetCriteria
      .map(
        (c) =>
          `- ${c.criterionId} (${c.label}): Score ${c.score}/${c.maxPoints}. ${c.feedback || 'No feedback provided.'}`
      )
      .join('\n');

    const prompt = `You are analyzing a student's homework submission image to locate specific mistakes.

The student received partial credit for the following criteria (score < maxPoints):

${criteriaList}

TASK:
For each criterion listed above, identify the exact location in the submission image where the mistake or issue occurs. Draw a bounding box around the relevant area.

IMPORTANT:
- This is a single-page image (PNG/JPG), so use pageIndex: 0 for all annotations.
- Provide normalized bounding box coordinates (x, y, w, h) where:
  - x, y: top-left corner coordinates (0.0 to 1.0)
  - w, h: width and height (0.0 to 1.0)
  - All values must be in the range [0, 1]
  - w and h must be greater than 0
- For each annotation, provide:
  - criterionId: must match one of the criterion IDs listed above
  - pageIndex: 0 (single page)
  - bboxNorm: { x, y, w, h } normalized coordinates
  - label: optional short label describing the mistake
  - comment: optional brief explanation
  - confidence: your confidence level (0.0 to 1.0) that this bounding box correctly identifies the mistake

Return ONLY valid JSON (no markdown, no code fences, no explanations). The JSON must match this exact structure:

{
  "annotations": [
    {
      "criterionId": "<string>",
      "pageIndex": 0,
      "bboxNorm": {
        "x": <number 0..1>,
        "y": <number 0..1>,
        "w": <number 0..1, must be > 0>,
        "h": <number 0..1, must be > 0>
      },
      "label": "<string>" (optional),
      "comment": "<string>" (optional),
      "confidence": <number 0..1>
    }
  ]
}

Return the JSON now:`;

    // Build parts array with prompt and submission image
    const parts = [
      { text: prompt },
      {
        inlineData: {
          data: submissionBase64,
          mimeType: submissionMimeType,
        },
      },
    ];

    // Call Gemini
    const geminiService = new GeminiService();
    const rawOutput = await geminiService.generateFromParts(parts);

    // Parse JSON robustly
    let parsed: unknown;
    try {
      const jsonText = extractJsonFromText(rawOutput);
      parsed = JSON.parse(jsonText);
    } catch (error) {
      const preview = rawOutput.length > 200 ? rawOutput.substring(0, 200) : rawOutput;
      return {
        ok: false,
        error: `Failed to parse JSON from Gemini response. First 200 chars: ${preview}`,
      };
    }

    // Validate against schema
    let localizationOutput: LocalizationOutput;
    try {
      localizationOutput = LocalizationOutputSchema.parse(parsed);
    } catch (error) {
      const preview = rawOutput.length > 200 ? rawOutput.substring(0, 200) : rawOutput;
      const validationError = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        error: `Localization output validation failed: ${validationError}. First 200 chars: ${preview}`,
      };
    }

    // Guardrails: validate criterionId matches target criteria
    const targetCriterionIds = new Set(targetCriteria.map((c) => c.criterionId));
    const invalidCriterionIds: string[] = [];
    for (const ann of localizationOutput.annotations) {
      if (!targetCriterionIds.has(ann.criterionId)) {
        invalidCriterionIds.push(ann.criterionId);
      }
    }

    if (invalidCriterionIds.length > 0) {
      return {
        ok: false,
        error: `Invalid criterionId(s) in annotations: ${invalidCriterionIds.join(', ')}. Must be one of: ${Array.from(targetCriterionIds).join(', ')}`,
      };
    }

    // Convert to Annotation objects
    const now = new Date().toISOString();
    const annotations: Annotation[] = localizationOutput.annotations.map((ann: LocalizationOutput['annotations'][0]) => {
      // Generate stable-ish ID
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 9);
      const id = `ai-${ann.criterionId}-${timestamp}-${random}`;

      return {
        id,
        criterionId: ann.criterionId,
        pageIndex: ann.pageIndex,
        bboxNorm: ann.bboxNorm,
        label: ann.label,
        comment: ann.comment,
        createdBy: 'ai',
        confidence: ann.confidence,
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

