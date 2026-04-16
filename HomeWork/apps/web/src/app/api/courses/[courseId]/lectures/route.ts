import { NextRequest, NextResponse } from 'next/server';
import {
  PostgresCourseNotFoundError,
  PostgresUnsupportedLectureTypeError,
} from '@hg/postgres-store';
import * as path from 'path';
import { getServerPersistence } from '../../../../../lib/server/persistence';
import { requireActiveCourseRoleApiAccess } from '@/lib/server/session';

export const runtime = 'nodejs';

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
    const lectures = await persistence.lectures.listLectures(params.courseId);
    return NextResponse.json({ ok: true, data: lectures });
  } catch (error) {
    if (error instanceof PostgresCourseNotFoundError) {
      return NextResponse.json(
        { ok: false, error: 'Course not found', code: 'COURSE_NOT_FOUND' },
        { status: 404 }
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, error: `Failed to list lectures: ${message}`, code: 'INTERNAL_ERROR' },
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
    if (!dataDir) {
      return NextResponse.json(
        { ok: false, error: 'HG_DATA_DIR is not set in environment', code: 'HG_DATA_DIR_MISSING' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const title = (formData.get('title') as string | null)?.trim();
    const file = formData.get('file') as File | null;
    const externalUrl = (formData.get('externalUrl') as string | null)?.trim();

    if (!title) {
      return NextResponse.json(
        { ok: false, error: 'title is required', code: 'BAD_REQUEST' },
        { status: 400 }
      );
    }

    if (!file) {
      return NextResponse.json(
        { ok: false, error: 'file is required', code: 'BAD_REQUEST' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { lecture } = await persistence.lectures.createLecture({
      dataDir: path.resolve(dataDir),
      courseId: params.courseId,
      title,
      originalName: file.name,
      buffer,
      contentType: file.type,
      externalUrl: externalUrl || undefined,
    });

    return NextResponse.json({ ok: true, data: { lectureId: lecture.lectureId } });
  } catch (error) {
    if (error instanceof PostgresUnsupportedLectureTypeError) {
      return NextResponse.json(
        { ok: false, error: error.message, code: 'UNSUPPORTED_LECTURE_TYPE' },
        { status: 415 }
      );
    }

    if (error instanceof PostgresCourseNotFoundError) {
      return NextResponse.json(
        { ok: false, error: 'Course not found', code: 'COURSE_NOT_FOUND' },
        { status: 404 }
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, error: `Failed to upload lecture: ${message}`, code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
