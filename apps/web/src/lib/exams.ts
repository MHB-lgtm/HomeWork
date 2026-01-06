import * as fs from 'fs/promises';
import * as path from 'path';

export interface ExamMetadata {
  examId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  examFilePath: string;
}

export interface ExamRecord {
  examId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  examFilePath: string;
}

/**
 * Error types for exam operations
 */
export class ExamNotFoundError extends Error {
  constructor(examId: string) {
    super(`Exam not found: ${examId}`);
    this.name = 'ExamNotFoundError';
  }
}

export class ExamLoadError extends Error {
  constructor(message: string) {
    super(`Failed to load exam: ${message}`);
    this.name = 'ExamLoadError';
  }
}

/**
 * Get the exam directory path
 */
export function getExamDir(dataDir: string, examId: string): string {
  return path.join(dataDir, 'exams', examId);
}

/**
 * Get the exam metadata file path
 */
export function getExamMetadataPath(dataDir: string, examId: string): string {
  return path.join(getExamDir(dataDir, examId), 'exam.json');
}

/**
 * Get the assets directory path for an exam
 */
export function getExamAssetsDir(dataDir: string, examId: string): string {
  return path.join(getExamDir(dataDir, examId), 'assets');
}

/**
 * Write file atomically (write to temp file, then rename)
 */
async function writeFileAtomic(filePath: string, content: string): Promise<void> {
  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, content, 'utf-8');
  await fs.rename(tempPath, filePath);
}

/**
 * Create a new exam
 */
export async function createExam(
  dataDir: string,
  title: string,
  examFileName: string,
  examFileBuffer: Buffer
): Promise<{ examId: string }> {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  const examId = `exam-${timestamp}-${random}`;

  const examDir = getExamDir(dataDir, examId);
  const assetsDir = getExamAssetsDir(dataDir, examId);
  const examMetadataPath = getExamMetadataPath(dataDir, examId);

  // Create directories
  await fs.mkdir(assetsDir, { recursive: true });

  // Save exam file with unique name preserving extension
  const ext = path.extname(examFileName);
  const baseName = path.basename(examFileName, ext);
  const uniqueFileName = `${baseName}_${timestamp}_${random}${ext}`;
  const examFilePath = path.join(assetsDir, uniqueFileName);
  await fs.writeFile(examFilePath, examFileBuffer);

  // Create metadata
  const now = new Date().toISOString();
  const metadata: ExamRecord = {
    examId,
    title,
    createdAt: now,
    updatedAt: now,
    examFilePath: path.relative(dataDir, examFilePath),
  };

  // Write metadata atomically
  await writeFileAtomic(examMetadataPath, JSON.stringify(metadata, null, 2));

  return { examId };
}

/**
 * List all exams
 */
export async function listExams(dataDir: string): Promise<ExamMetadata[]> {
  const examsDir = path.join(dataDir, 'exams');

  try {
    const examDirs = await fs.readdir(examsDir, { withFileTypes: true });
    const exams: ExamMetadata[] = [];

    for (const dir of examDirs) {
      if (!dir.isDirectory()) continue;

      const examId = dir.name;
      const metadataPath = getExamMetadataPath(dataDir, examId);

      try {
        const content = await fs.readFile(metadataPath, 'utf-8');
        const metadata: ExamRecord = JSON.parse(content);
        exams.push({
          examId: metadata.examId,
          title: metadata.title,
          createdAt: metadata.createdAt,
          updatedAt: metadata.updatedAt,
          examFilePath: metadata.examFilePath,
        });
      } catch (error) {
        // Skip exams with invalid metadata
        continue;
      }
    }

    // Sort by createdAt desc
    exams.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return exams;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // Exams directory doesn't exist yet, return empty array
      return [];
    }
    throw new ExamLoadError(
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * Get a single exam by ID
 */
export async function getExam(dataDir: string, examId: string): Promise<ExamRecord> {
  const metadataPath = getExamMetadataPath(dataDir, examId);

  try {
    const content = await fs.readFile(metadataPath, 'utf-8');
    const metadata: ExamRecord = JSON.parse(content);
    return metadata;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new ExamNotFoundError(examId);
    }
    throw new ExamLoadError(
      error instanceof Error ? error.message : String(error)
    );
  }
}

