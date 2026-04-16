import * as fs from 'fs/promises';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { GeminiService } from '../services/geminiService';
import {
  PrismaExamIndexStore,
  disconnectPrismaClient,
  getPrismaClient,
} from '@hg/postgres-store';
import { ExamIndexSchema, ExamIndex } from '@hg/shared-schemas';

// Load environment variables
const envPath = path.resolve(__dirname, '../../../../.env');
dotenv.config({ path: envPath });

function printUsage(): never {
  console.error('Usage: ts-node src/scripts/generateExamIndex.ts --examId <examId> [--force]');
  console.error('');
  console.error('Required:');
  console.error('  --examId <examId>    Exam ID');
  console.error('');
  console.error('Optional:');
  console.error('  --force              Overwrite existing examIndex even if status is "confirmed"');
  console.error('');
  console.error('Example:');
  console.error('  pnpm --filter worker exam:index -- --examId exam-1234567890-abc123');
  process.exit(1);
}

function parseArgs(): { examId: string; force: boolean } {
  const args = process.argv.slice(2);
  const argsMap: Record<string, string | boolean> = {};

  // Parse arguments into a map
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      if (args[i] === '--force') {
        argsMap['--force'] = true;
      } else if (i + 1 < args.length) {
        argsMap[args[i]] = args[i + 1];
        i++;
      }
    }
  }

  const examId = argsMap['--examId'];
  const force = argsMap['--force'] === true;

  if (!examId || typeof examId !== 'string') {
    printUsage();
  }

  return {
    examId: examId as string,
    force,
  };
}

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

function containsHebrew(text: string): boolean {
  return /[\u0590-\u05FF]/.test(text);
}

function hasNonEnglishQuestionText(questions: Array<{
  displayLabel: string;
  aliases: string[];
  promptText: string;
}>): boolean {
  return questions.some((question) => {
    if (containsHebrew(question.displayLabel) || containsHebrew(question.promptText)) {
      return true;
    }
    return question.aliases.some((alias) => containsHebrew(alias));
  });
}

interface ExamRecord {
  title: string;
  assetPath: string;
}

async function loadExamMetadata(examId: string): Promise<ExamRecord> {
  const prisma = getPrismaClient();
  const row = await prisma.exam.findUnique({
    where: { domainId: examId },
    select: {
      title: true,
      asset: {
        select: {
          path: true,
        },
      },
    },
  });

  if (!row) {
    throw new Error(`Exam not found: ${examId}`);
  }

  return {
    title: row.title,
    assetPath: row.asset.path,
  };
}

async function main() {
  const { examId, force } = parseArgs();
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set in environment variables');
  }

  const prisma = getPrismaClient();
  const examIndexStore = new PrismaExamIndexStore(prisma);

  try {
    let existingIndex: ExamIndex | null = null;
    try {
      existingIndex = await examIndexStore.getExamIndex(examId);
    } catch (error) {
      console.warn(
        `[exam-index] Failed to load existing Postgres exam index for ${examId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    if (existingIndex?.status === 'confirmed' && !force) {
      throw new Error(
        `Exam index for ${examId} already exists with status "confirmed". Use --force to overwrite.`
      );
    }

    const examMetadata = await loadExamMetadata(examId);
    const examFilePath = examMetadata.assetPath;

    try {
      await fs.access(examFilePath);
    } catch {
      throw new Error(`Exam file not found: ${examFilePath}`);
    }

    const examBuffer = await fs.readFile(examFilePath);
    const examMimeType = inferMimeType(examFilePath);
    const examBase64 = examBuffer.toString('base64');

    const prompt = `You are analyzing a lecturer's exam document to identify all top-level questions.

TASK: Determine how many top-level questions exist in the attached exam document and produce a structured list.

IMPORTANT: Return ONLY valid JSON. No markdown. No explanations.

REQUIREMENTS:
- Use stable internal IDs: q1, q2, q3, ... qN (where N is the number of questions)
- order must be 1, 2, 3, ... N (contiguous starting from 1)
- displayLabel must be in English (e.g., "Question 1", "Problem 2", "Exercise 3")
- aliases should include common English variations (e.g., ["Q1", "1)", "Question 1"] for "Question 1")
- promptText must contain the actual question statement/instructions (required, non-empty, trimmed, max 800 chars)
  - Extract the question meaning from the exam document and write it in English
  - If the original exam is not in English, translate faithfully to English
  - If exact extraction is impossible, provide a faithful English paraphrase
  - Keep it concise: truncate to 800 chars if longer
- All textual fields in output must be English-only: displayLabel, aliases, promptText
- Keep it simple: do NOT create subquestions (q2a, q2b) unless they are clearly labeled as separate top-level questions in the exam
- Minimum 1 question required

JSON format (strict):
{
  "examId": "${examId}",
  "questions": [
    {
      "id": "q1",
      "order": 1,
      "displayLabel": "Question 1",
      "aliases": ["Q1", "1)", "Question 1"],
      "promptText": "Solve the following equation: x^2 + 5x + 6 = 0"
    },
    {
      "id": "q2",
      "order": 2,
      "displayLabel": "Problem 2",
      "aliases": ["Q2", "2)", "Problem 2"],
      "promptText": "Find the derivative of f(x) = x^3 - 2x^2 + 1"
    }
  ]
}

Return the JSON now:`;

    const geminiService = new GeminiService();
    const parts = [
      { text: prompt },
      {
        inlineData: {
          data: examBase64,
          mimeType: examMimeType,
        },
      },
    ];

    let rawOutput = '';
    let examIndex: ExamIndex | null = null;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`[exam-index] Retrying exam index generation for ${examId} (attempt ${attempt + 1})`);
        }

        rawOutput = await geminiService.generateFromParts(parts, { temperature: 0 });

        const jsonText = extractJsonFromText(rawOutput);
        const parsed = JSON.parse(jsonText) as Record<string, unknown>;
        parsed.examId = examId;

        const now = new Date().toISOString();
        const candidateExamIndex = ExamIndexSchema.parse({
          version: '1.0.0' as const,
          examId,
          generatedAt: existingIndex?.generatedAt || now,
          updatedAt: now,
          status: 'proposed' as const,
          questions: parsed.questions || [],
        });

        const requiresEnglishRepair = hasNonEnglishQuestionText(
          candidateExamIndex.questions.map((question) => ({
            displayLabel: question.displayLabel,
            aliases: question.aliases,
            promptText: question.promptText,
          }))
        );

        if (requiresEnglishRepair) {
          if (attempt === 0) {
            parts[0] = {
              text: `${prompt}\n\nIMPORTANT: The previous response included non-English text. Rewrite ALL text fields in English only:\n- displayLabel must be English\n- aliases must be English\n- promptText must be English\n- Preserve question meaning and order\n- Return ONLY valid JSON.`,
            };
            continue;
          }

          throw new Error('Gemini response still contains non-English text in question metadata');
        }

        examIndex = candidateExamIndex;
        break;
      } catch (error) {
        if (attempt === 0) {
          parts[0] = {
            text: `${prompt}\n\nIMPORTANT: The previous response was invalid. Please ensure:\n- questions array has at least 1 item\n- Each question has: id (q1..qN), order (1..N contiguous), displayLabel (non-empty English string), aliases (array of English strings), promptText (non-empty English string, max 800 chars)\n- promptText must contain the question statement/instructions in English\n- All ids are unique\n- All order values are unique and contiguous starting from 1\n- Return ONLY valid JSON.`,
          };
          continue;
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        const preview = rawOutput.length > 200 ? rawOutput.substring(0, 200) : rawOutput;
        throw new Error(`Failed to generate exam index: ${errorMessage}. First 200 chars: ${preview}`);
      }
    }

    if (!examIndex) {
      throw new Error('Failed to generate exam index after retries');
    }

    const savedExamIndex = await examIndexStore.saveExamIndex(examIndex);

    console.log(
      `[exam-index] Generated proposed examIndex for ${savedExamIndex.examId}: ${savedExamIndex.questions.length} question${savedExamIndex.questions.length !== 1 ? 's' : ''}`
    );
  } finally {
    await disconnectPrismaClient();
  }
}

main().catch((error) => {
  console.error(`[exam-index] Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
