import { NextRequest, NextResponse } from 'next/server';
import {
  PostgresAssignmentCourseNotFoundError,
  PostgresAssignmentNotFoundError,
} from '@hg/postgres-store';
import * as fs from 'fs';
import * as path from 'path';
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
        message: 'Assignment updated but exam indexing timed out after 3 minutes',
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
        message: `Assignment updated but failed to start exam indexing: ${error.message}`,
      });
    });

    child.on('close', (code) => {
      clearTimeout(timeout);

      if (code === 0) {
        resolve({
          ok: true,
          message: 'Assignment exam re-indexed successfully',
          details: stdout.trim() || undefined,
        });
        return;
      }

      resolve({
        ok: false,
        message: 'Assignment updated but exam indexing failed',
        details: [stdout, stderr].filter(Boolean).join('\n').trim() || `Exit code: ${code}`,
      });
    });
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { courseId: string; assignmentId: string } }
) {
  const access = await requireActiveCourseRoleApiAccess(params.courseId, [
    'COURSE_ADMIN',
    'LECTURER',
  ]);
  if (access instanceof NextResponse) return access;

  const persistence = ensurePersistence();
  if (persistence instanceof NextResponse) return persistence;

  try {
    const contentType = request.headers.get('content-type') ?? '';
    let title: string | undefined;
    let openAt: string | undefined;
    let deadlineAt: string | undefined;
    let state: (typeof ASSIGNMENT_STATES)[number] | undefined | null;
    let source:
      | {
          originalName: string;
          buffer: Buffer;
          mimeType?: string;
        }
      | undefined;

    if (contentType.includes('multipart/form-data')) {
      const dataDir = process.env.HG_DATA_DIR;
      if (!dataDir) {
        return NextResponse.json(
          { ok: false, error: 'HG_DATA_DIR is not set in environment', code: 'HG_DATA_DIR_MISSING' },
          { status: 500 }
        );
      }

      const formData = await request.formData();
      title = typeof formData.get('title') === 'string' ? String(formData.get('title')).trim() : undefined;
      openAt = typeof formData.get('openAt') === 'string' ? String(formData.get('openAt')).trim() : undefined;
      deadlineAt =
        typeof formData.get('deadlineAt') === 'string' ? String(formData.get('deadlineAt')).trim() : undefined;
      const rawState = formData.get('state');
      state =
        typeof rawState === 'string' && rawState.trim().length > 0
          ? ASSIGNMENT_STATES.includes(rawState as (typeof ASSIGNMENT_STATES)[number])
            ? (rawState as (typeof ASSIGNMENT_STATES)[number])
            : null
          : undefined;

      const sourceFile = formData.get('source');
      if (sourceFile instanceof File && sourceFile.size > 0) {
        source = {
          originalName: sourceFile.name,
          buffer: Buffer.from(await sourceFile.arrayBuffer()),
          mimeType: sourceFile.type || undefined,
        };
      }

      if (state === null) {
        return NextResponse.json(
          { ok: false, error: 'state must be draft, open, or closed', code: 'BAD_REQUEST' },
          { status: 400 }
        );
      }

      const assignment = await persistence.assignments.updateAssignment({
        assignmentId: params.assignmentId,
        dataDir: path.resolve(dataDir),
        ...(title !== undefined ? { title } : {}),
        ...(openAt !== undefined ? { openAt } : {}),
        ...(deadlineAt !== undefined ? { deadlineAt } : {}),
        ...(state !== undefined ? { state } : {}),
        ...(source ? { source } : {}),
      });

      if (assignment.courseId !== params.courseId) {
        return NextResponse.json(
          { ok: false, error: 'Assignment not found', code: 'ASSIGNMENT_NOT_FOUND' },
          { status: 404 }
        );
      }

      const indexing = source ? await runExamIndexGeneration(assignment.examId) : undefined;
      return NextResponse.json({ ok: true, data: assignment, indexing });
    }

    const body = (await request.json()) as Record<string, unknown>;
    title = typeof body.title === 'string' ? body.title.trim() : undefined;
    openAt = typeof body.openAt === 'string' ? body.openAt.trim() : undefined;
    deadlineAt = typeof body.deadlineAt === 'string' ? body.deadlineAt.trim() : undefined;
    state =
      typeof body.state === 'string' &&
      ASSIGNMENT_STATES.includes(body.state as (typeof ASSIGNMENT_STATES)[number])
        ? (body.state as (typeof ASSIGNMENT_STATES)[number])
        : body.state === undefined
          ? undefined
          : null;

    if (state === null) {
      return NextResponse.json(
        { ok: false, error: 'state must be draft, open, or closed', code: 'BAD_REQUEST' },
        { status: 400 }
      );
    }

    const assignment = await persistence.assignments.updateAssignment({
      assignmentId: params.assignmentId,
      ...(title !== undefined ? { title } : {}),
      ...(openAt !== undefined ? { openAt } : {}),
      ...(deadlineAt !== undefined ? { deadlineAt } : {}),
      ...(state !== undefined ? { state } : {}),
    });

    if (assignment.courseId !== params.courseId) {
      return NextResponse.json(
        { ok: false, error: 'Assignment not found', code: 'ASSIGNMENT_NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, data: assignment });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { ok: false, error: 'Invalid JSON body', code: 'BAD_REQUEST' },
        { status: 400 }
      );
    }

    if (error instanceof PostgresAssignmentCourseNotFoundError) {
      return NextResponse.json(
        { ok: false, error: 'Course not found', code: 'COURSE_NOT_FOUND' },
        { status: 404 }
      );
    }

    if (error instanceof PostgresAssignmentNotFoundError) {
      return NextResponse.json(
        { ok: false, error: 'Assignment not found', code: 'ASSIGNMENT_NOT_FOUND' },
        { status: 404 }
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, error: `Failed to update assignment: ${message}`, code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
