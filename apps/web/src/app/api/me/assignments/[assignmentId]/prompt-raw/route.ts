import { NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';
import { getServerPersistence } from '@/lib/server/persistence';
import { requireStudentAssignmentAccess } from '@/lib/server/session';

export const runtime = 'nodejs';

const inferMimeType = (filePath: string): string => {
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
  };

  return mimeMap[ext] ?? 'application/octet-stream';
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

export async function GET(
  _request: Request,
  { params }: { params: { assignmentId: string } }
) {
  try {
    const access = await requireStudentAssignmentAccess(params.assignmentId);
    const persistence = ensurePersistence();
    if (persistence instanceof NextResponse) return persistence;

    const asset =
      access.access.globalRole === 'SUPER_ADMIN'
        ? await persistence.assignments.getAssignmentPromptAsset(params.assignmentId)
        : await persistence.assignments.getAssignmentPromptAssetForStudent(
            access.access.userId,
            params.assignmentId
          );

    if (!asset) {
      return NextResponse.json(
        { ok: false, error: 'Assignment PDF not found', code: 'ASSIGNMENT_PROMPT_NOT_FOUND' },
        { status: 404 }
      );
    }

    const fileBuffer = await fs.readFile(asset.path);
    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': asset.mimeType || inferMimeType(asset.path),
        'Cache-Control': 'no-store',
        ...(asset.originalName ? { 'Content-Disposition': `inline; filename="${asset.originalName}"` } : {}),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'Authentication required') {
      return NextResponse.json(
        { ok: false, error: message, code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { ok: false, error: 'Forbidden', code: 'FORBIDDEN' },
      { status: 403 }
    );
  }
}
