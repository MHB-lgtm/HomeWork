import * as dotenv from 'dotenv';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';
import { GeminiService } from '../services/geminiService';

// Load .env from repo root (not from current working directory)
// When using ts-node: src/scripts/geminiSmokeTest.ts -> ../../../../ = repo root
// When compiled: dist/scripts/geminiSmokeTest.js -> ../../../../ = repo root
// Fallback: if __dirname is not available, use require.main or process.cwd()
const getRepoRoot = (): string => {
  if (typeof __dirname !== 'undefined') {
    return path.resolve(__dirname, '../../../../');
  }
  // Fallback for environments where __dirname is not available
  const scriptDir = require.main ? path.dirname(require.main.filename) : process.cwd();
  return path.resolve(scriptDir, '../../../../');
};

const REPO_ROOT = getRepoRoot();
const envPath = path.join(REPO_ROOT, '.env');
dotenv.config({ path: envPath });

function printUsage(): never {
  console.error('Usage: ts-node src/scripts/geminiSmokeTest.ts --question <path> --submission <path> [--notes "<text>"]');
  console.error('');
  console.error('Required:');
  console.error('  --question <path>     Path to question file (image/PDF)');
  console.error('  --submission <path>  Path to submission file (image/PDF)');
  console.error('');
  console.error('Optional:');
  console.error('  --notes "<text>"     Grading notes');
  console.error('');
  console.error('Example:');
  console.error('  pnpm --filter worker gemini:smoke --question question.png --submission submission.jpg --notes "Check for accuracy"');
  process.exit(1);
}

function parseArgs(): { questionPath: string; submissionPath: string; notes?: string } {
  const args = process.argv.slice(2);
  const argsMap: Record<string, string> = {};

  // Parse arguments into a map
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--') && i + 1 < args.length) {
      argsMap[args[i]] = args[i + 1];
      i++;
    }
  }

  // Read into local variables
  const question = argsMap['--question'];
  const submission = argsMap['--submission'];
  const notes = argsMap['--notes'];

  // Explicit check
  if (!question || !submission) {
    printUsage();
  }

  // TypeScript now understands question and submission are defined strings
  return {
    questionPath: question,
    submissionPath: submission,
    notes,
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

async function readFileAsBase64(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  return buffer.toString('base64');
}

async function main() {
  const { questionPath, submissionPath, notes } = parseArgs();

  // Validate input file paths exist
  if (!existsSync(questionPath)) {
    console.error(`Error: Question file not found: ${questionPath}`);
    process.exit(1);
  }

  if (!existsSync(submissionPath)) {
    console.error(`Error: Submission file not found: ${submissionPath}`);
    process.exit(1);
  }

  // Read both files
  const questionBuffer = await fs.readFile(questionPath);
  const submissionBuffer = await fs.readFile(submissionPath);

  // Infer MIME types
  const questionMimeType = inferMimeType(questionPath);
  const submissionMimeType = inferMimeType(submissionPath);

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

${notes ? `Additional grading notes: ${notes}` : ''}

Return the JSON now:`;

  // Create GeminiService and generate response
  const geminiService = new GeminiService();
  const parts = [
    { text: prompt },
    questionInlinePart,
    submissionInlinePart,
  ];

  const rawOutput = await geminiService.generateFromParts(parts);

  // Print first 2000 characters
  const outputPreview = rawOutput.length > 2000 ? rawOutput.substring(0, 2000) + '...' : rawOutput;
  console.log('Raw model output (first 2000 chars):');
  console.log('---');
  console.log(outputPreview);
  console.log('---');
  console.log(`Total output length: ${rawOutput.length} characters`);
}

main().catch((error) => {
  console.error('Error in smoke test:', error);
  process.exit(1);
});

