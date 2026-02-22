import { NextRequest, NextResponse } from 'next/server';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { createExam, listExams, ExamLoadError } from '../../../lib/exams';

export const runtime = 'nodejs';

type ExamIndexingResult = {
  ok: boolean;
  message: string;
  details?: string;
};

function findWorkspaceRoot(startDir: string): string {
  let current = path.resolve(startDir);

  while (true) {
    const workspaceMarker = path.join(current, 'pnpm-workspace.yaml');
    if (fs.existsSync(workspaceMarker)) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return startDir;
}

async function runExamIndexGeneration(examId: string): Promise<ExamIndexingResult> {
  const workspaceRoot = findWorkspaceRoot(process.cwd());

  return new Promise((resolve) => {
    const args = ['--filter', 'worker', 'exam:index', '--', '--examId', examId];
    const child = spawn('pnpm', args, {
      cwd: workspaceRoot,
      env: process.env,
      shell: true,
    });

    let stdout = '';
    let stderr = '';

    const timeout = setTimeout(() => {
      child.kill();
      resolve({
        ok: false,
        message: 'Exam created but auto-indexing timed out after 3 minutes',
        details: [stdout, stderr].filter(Boolean).join('\n').trim(),
      });
    }, 180000);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      clearTimeout(timeout);
      resolve({
        ok: false,
        message: `Exam created but failed to start auto-indexing: ${error.message}`,
      });
    });

    child.on('close', (code) => {
      clearTimeout(timeout);

      if (code === 0) {
        resolve({
          ok: true,
          message: 'Exam indexed successfully',
          details: stdout.trim() || undefined,
        });
        return;
      }

      resolve({
        ok: false,
        message: 'Exam created but auto-indexing failed',
        details: [stdout, stderr].filter(Boolean).join('\n').trim() || `Exit code: ${code}`,
      });
    });
  });
}

/**
 * POST /api/exams
 * Create a new exam package
 */
export async function POST(request: NextRequest) {
  try {
    const dataDir = process.env.HG_DATA_DIR;
    if (!dataDir) {
      return NextResponse.json(
        { error: 'HG_DATA_DIR is not set in environment', code: 'HG_DATA_DIR_MISSING' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const title = formData.get('title') as string | null;
    const examFile = formData.get('examFile') as File | null;

    if (!title || !title.trim()) {
      return NextResponse.json(
        { error: 'title is required', code: 'BAD_REQUEST' },
        { status: 400 }
      );
    }

    if (!examFile) {
      return NextResponse.json(
        { error: 'examFile is required', code: 'BAD_REQUEST' },
        { status: 400 }
      );
    }

    const DATA_DIR = path.resolve(dataDir);
    const examFileBuffer = Buffer.from(await examFile.arrayBuffer());

    const { examId } = await createExam(
      DATA_DIR,
      title.trim(),
      examFile.name,
      examFileBuffer
    );

    const indexing = await runExamIndexGeneration(examId);

    return NextResponse.json({
      examId,
      indexing,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Failed to create exam: ${errorMessage}`, code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/exams
 * List all exams
 */
export async function GET(request: NextRequest) {
  try {
    const dataDir = process.env.HG_DATA_DIR;
    if (!dataDir) {
      return NextResponse.json(
        { error: 'HG_DATA_DIR is not set in environment', code: 'HG_DATA_DIR_MISSING' },
        { status: 500 }
      );
    }

    const DATA_DIR = path.resolve(dataDir);
    const exams = await listExams(DATA_DIR);

    return NextResponse.json(exams);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Failed to list exams: ${errorMessage}`, code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

