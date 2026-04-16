import { NextRequest, NextResponse } from 'next/server';
import {
  PostgresAssignmentCourseNotFoundError,
  isSupabaseObjectStorageEnabled,
} from '@hg/postgres-store';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { getServerPersistence } from '@/lib/server/persistence';
import { requireActiveCourseRoleApiAccess } from '@/lib/server/session';

export const runtime = 'nodejs';

const ASSIGNMENT_STATES = ['draft', 'open', 'closed'] as const;

type ExamIndexingResult = {
  ok: boolean;
  message: string;
  details?: string;
};

const ensurePersistence = () => {
  const persistence = getServerPersistence();
  if (!persistence) {
    return NextResponse.json(
      { ok: false, error: 'DATABASE_URL is not set in environment', code: 'DATABASE_URL_MISSING' },
      { status: 500 }
    );
  }

  return persistence;
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
  const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

  return new Promise((resolve) => {
    const args = ['--filter', 'worker', 'exam:index', '--examId', examId];
    const child = spawn(pnpmCommand, args, {
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
        message: 'Assignment created but exam indexing timed out after 3 minutes',
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
        message: `Assignment created but failed to start exam indexing: ${error.message}`,
      });
    });

    child.on('close', (code) => {
      clearTimeout(timeout);

      if (code === 0) {
        resolve({
          ok: true,
          message: 'Assignment exam indexed successfully',
          details: stdout.trim() || undefined,
        });
        return;
      }

      resolve({
        ok: false,
        message: 'Assignment created but exam indexing failed',
        details: [stdout, stderr].filter(Boolean).join('\n').trim() || `Exit code: ${code}`,
      });
    });
  });
}

const parseState = (value: FormDataEntryValue | null) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  return ASSIGNMENT_STATES.includes(normalized as (typeof ASSIGNMENT_STATES)[number])
    ? (normalized as (typeof ASSIGNMENT_STATES)[number])
    : null;
};

export async function GET(
  _request: NextRequest,
  { params }: { params: { courseId: string } }
) {
  const access = await requireActiveCourseRoleApiAccess(params.courseId, [
    'COURSE_ADMIN',
    'LECTURER',
  ]);
  if (access instanceof NextResponse) return access;

  const persistence = ensurePersistence();
  if (persistence instanceof NextResponse) return persistence;

  try {
    const assignments = await persistence.assignments.listAssignmentsByCourse(params.courseId);
    return NextResponse.json({ ok: true, data: assignments });
  } catch (error) {
    if (error instanceof PostgresAssignmentCourseNotFoundError) {
      return NextResponse.json(
        { ok: false, error: 'Course not found', code: 'COURSE_NOT_FOUND' },
        { status: 404 }
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, error: `Failed to load assignments: ${message}`, code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { courseId: string } }
) {
  const access = await requireActiveCourseRoleApiAccess(params.courseId, [
    'COURSE_ADMIN',
    'LECTURER',
  ]);
  if (access instanceof NextResponse) return access;

  const persistence = ensurePersistence();
  if (persistence instanceof NextResponse) return persistence;

  try {
    const dataDir = process.env.HG_DATA_DIR;
    if (!dataDir && !isSupabaseObjectStorageEnabled()) {
      return NextResponse.json(
        {
          ok: false,
          error: 'HG_DATA_DIR or Supabase object storage configuration is required',
          code: 'ASSET_STORAGE_MISSING',
        },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const title = (formData.get('title') as string | null)?.trim();
    const openAt = (formData.get('openAt') as string | null)?.trim();
    const deadlineAt = (formData.get('deadlineAt') as string | null)?.trim();
    const source = formData.get('source') as File | null;
    const state = parseState(formData.get('state'));

    if (!title || !openAt || !deadlineAt || !source) {
      return NextResponse.json(
        {
          ok: false,
          error: 'title, openAt, deadlineAt, and source are required',
          code: 'BAD_REQUEST',
        },
        { status: 400 }
      );
    }

    if (state === null) {
      return NextResponse.json(
        { ok: false, error: 'state must be draft, open, or closed', code: 'BAD_REQUEST' },
        { status: 400 }
      );
    }

    const assignment = await persistence.assignments.createAssignment({
      dataDir: dataDir ? path.resolve(dataDir) : undefined,
      courseId: params.courseId,
      title,
      openAt,
      deadlineAt,
      state,
      source: {
        originalName: source.name,
        buffer: Buffer.from(await source.arrayBuffer()),
        mimeType: source.type || undefined,
      },
    });

    const indexing = await runExamIndexGeneration(assignment.examId);

    return NextResponse.json({ ok: true, data: assignment, indexing });
  } catch (error) {
    if (error instanceof PostgresAssignmentCourseNotFoundError) {
      return NextResponse.json(
        { ok: false, error: 'Course not found', code: 'COURSE_NOT_FOUND' },
        { status: 404 }
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, error: `Failed to create assignment: ${message}`, code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
