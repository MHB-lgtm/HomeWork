/**
 * POST /api/notes/detect
 *
 * Body: { text: string }  (extracted text from the uploaded file)
 * Returns: DetectionResult with type, confidence, and optional questions
 *
 * This is the entry point that powers the Smart Notes "magic":
 *   upload → extract text → detect → route to the correct flow
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  detectDocumentType,
  type DetectOptions,
} from '../../../../lib/notes/docTypeDetector';
import type { DetectionResult } from '@hg/shared-schemas';

const BodySchema = z.object({
  text: z.string().min(1).max(500_000),
  useAiFallback: z.boolean().optional().default(true),
});

export async function POST(req: Request) {
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: 'Invalid request body', detail: (e as Error).message },
      { status: 400 },
    );
  }

  const opts: DetectOptions = {
    extractQuestions: true,
  };

  if (body.useAiFallback) {
    // TODO(Phase 1): wire to the existing Gemini client used by the grader worker.
    // For MVP, a stub fallback keeps the endpoint deterministic in dev/tests.
    opts.llmFallback = async (text): Promise<DetectionResult> => {
      // Example wiring (keep commented until Gemini client is imported here):
      //
      // const gemini = getGeminiClient();
      // const prompt = buildDetectPrompt(text);
      // const out = await gemini.generateStructured(prompt, DetectionResultSchema);
      // return out;

      // Dev stub — return a low-confidence unknown so heuristic wins.
      return {
        type: 'unknown',
        confidence: 0.4,
        reasoning: 'LLM fallback not yet wired (dev stub).',
      };
    };
  }

  const result = await detectDocumentType(body.text, opts);
  return NextResponse.json(result);
}
