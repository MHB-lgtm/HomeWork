import * as fs from 'fs/promises';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { GeminiService } from '../services/geminiService';
import { loadExamIndex, saveExamIndex } from '@hg/local-job-store';
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

function getDataDir(): string {
  const dataDir = process.env.HG_DATA_DIR;
  if (!dataDir) {
    throw new Error('HG_DATA_DIR is not set in environment variables');
  }
  return path.resolve(dataDir);
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

interface ExamRecord {
  examId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  examFilePath: string;
}

async function loadExamMetadata(examId: string): Promise<ExamRecord> {
  const dataDir = getDataDir();
  const examMetadataPath = path.join(dataDir, 'exams', examId, 'exam.json');

  try {
    const content = await fs.readFile(examMetadataPath, 'utf-8');
    const parsed = JSON.parse(content) as ExamRecord;
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Exam not found: ${examId}`);
    }
    throw error;
  }
}

async function main() {
  const { examId, force } = parseArgs();

  // Check if examIndex already exists (handle backward compatibility for missing promptText)
  let existingIndex: ExamIndex | null = null;
  let existingIndexRaw: any = null;
  try {
    existingIndex = await loadExamIndex(examId);
  } catch (error) {
    // If validation fails, try to load raw JSON to check if it's missing promptText
    const dataDir = getDataDir();
    const examIndexPath = path.join(dataDir, 'exams', examId, 'examIndex.json');
    try {
      const content = await fs.readFile(examIndexPath, 'utf-8');
      existingIndexRaw = JSON.parse(content);
      // Check if it's missing promptText (backward compatibility)
      const missingPromptText = existingIndexRaw.questions?.some((q: any) => !q.promptText);
      if (missingPromptText) {
        if (existingIndexRaw.status === 'proposed') {
          console.log(`[exam-index] Existing examIndex for ${examId} is missing promptText. Regenerating...`);
        } else if (existingIndexRaw.status === 'confirmed' && !force) {
          console.error(`[exam-index] Exam index for ${examId} is missing promptText and status is "confirmed". Use --force to regenerate.`);
          process.exit(1);
        }
        // Will regenerate below
      } else {
        // Validation failed for other reason, rethrow
        throw error;
      }
    } catch {
      // File doesn't exist or other error, continue
    }
  }

  if (existingIndex) {
    if (existingIndex.status === 'confirmed' && !force) {
      console.error(`[exam-index] Exam index for ${examId} already exists with status "confirmed". Use --force to overwrite.`);
      process.exit(1);
    }
  }

  // Load exam metadata
  const examMetadata = await loadExamMetadata(examId);
  const dataDir = getDataDir();
  const examFilePath = path.join(dataDir, examMetadata.examFilePath);

  // Check if exam file exists
  try {
    await fs.access(examFilePath);
  } catch {
    throw new Error(`Exam file not found: ${examFilePath}`);
  }

  // Read exam file
  const examBuffer = await fs.readFile(examFilePath);
  const examMimeType = inferMimeType(examFilePath);
  const examBase64 = examBuffer.toString('base64');

  // Build prompt
  const prompt = `You are analyzing a lecturer's exam document to identify all top-level questions.

TASK: Determine how many top-level questions exist in the attached exam document and produce a structured list.

IMPORTANT: Return ONLY valid JSON. No markdown. No explanations.

REQUIREMENTS:
- Use stable internal IDs: q1, q2, q3, ... qN (where N is the number of questions)
- order must be 1, 2, 3, ... N (contiguous starting from 1)
- displayLabel should match the exam's visible label (e.g., "Question 1", "Problem 2", "Exercise 3", etc.)
- aliases should include common variations (e.g., ["Q1", "1)", "Question 1"] for "Question 1")
- promptText must contain the actual question statement/instructions (required, non-empty, trimmed, max 800 chars)
  - Extract the exact question text from the exam document
  - If exact extraction is impossible, provide a faithful paraphrase
  - Keep it concise: truncate to 800 chars if longer
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

  // Call Gemini
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

  let rawOutput: string;
  let examIndex: ExamIndex | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[exam-index] Retrying exam index generation for ${examId} (attempt ${attempt + 1})`);
      }

      // Generate response with temperature=0 for deterministic output
      rawOutput = await geminiService.generateFromParts(parts, { temperature: 0 });

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
        throw new Error(`Failed to parse JSON from Gemini response. First 200 chars: ${preview}`);
      }

      // Validate against ExamIndexSchema
      try {
        // Ensure parsed is an object
        if (typeof parsed !== 'object' || parsed === null) {
          throw new Error('Response is not an object');
        }

        const parsedObj = parsed as Record<string, unknown>;

        // Ensure examId matches
        parsedObj.examId = examId;

        // Add required fields
        const now = new Date().toISOString();
        const examIndexData = {
          version: '1.0.0' as const,
          examId,
          generatedAt: existingIndex?.generatedAt || now,
          updatedAt: now,
          status: 'proposed' as const,
          questions: parsedObj.questions || [],
        };

        examIndex = ExamIndexSchema.parse(examIndexData);
        break;
      } catch (error) {
        const validationError = error instanceof Error ? error.message : String(error);
        if (attempt === 0) {
          // Retry with repair prompt
          const repairPrompt = `${prompt}\n\nIMPORTANT: The previous response was invalid. Please ensure:\n- questions array has at least 1 item\n- Each question has: id (q1..qN), order (1..N contiguous), displayLabel (non-empty string), aliases (array of strings), promptText (non-empty string, max 800 chars)\n- promptText must contain the actual question statement/instructions\n- All ids are unique\n- All order values are unique and contiguous starting from 1\n- Return ONLY valid JSON.`;
          parts[0] = { text: repairPrompt };
          continue;
        }
        const preview = rawOutput.length > 200 ? rawOutput.substring(0, 200) : rawOutput;
        throw new Error(`ExamIndex validation failed: ${validationError}. First 200 chars: ${preview}`);
      }
    } catch (error) {
      if (attempt === 1) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to generate exam index: ${errorMessage}`);
      }
      continue;
    }
  }

  if (!examIndex) {
    throw new Error('Failed to generate exam index after retries');
  }

  // Save exam index
  await saveExamIndex(examIndex);

  console.log(`[exam-index] Generated proposed examIndex for ${examId}: ${examIndex.questions.length} question${examIndex.questions.length !== 1 ? 's' : ''}`);
}

main().catch((error) => {
  console.error(`[exam-index] Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
