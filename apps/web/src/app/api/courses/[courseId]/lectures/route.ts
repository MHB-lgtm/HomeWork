import { NextRequest, NextResponse } from 'next/server';
import {
  CourseNotFoundError,
  UnsupportedLectureTypeError,
  listLectures,
  uploadLecture,
} from '@hg/local-course-store';

export const runtime = 'nodejs';

const ensureDataDir = () => {
  if (!process.env.HG_DATA_DIR) {
    return NextResponse.json(
      { ok: false, error: 'HG_DATA_DIR is not set in environment' },
      { status: 500 }
    );
  }
  return null;
};

export async function GET(
  _request: NextRequest,
  { params }: { params: { courseId: string } }
) {
  const dataDirError = ensureDataDir();
  if (dataDirError) return dataDirError;

  try {
    const lectures = await listLectures(params.courseId);
    return NextResponse.json({ ok: true, data: lectures });
  } catch (error) {
    if (error instanceof CourseNotFoundError) {
      return NextResponse.json(
        { ok: false, error: 'Course not found' },
        { status: 404 }
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, error: `Failed to list lectures: ${message}` },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { courseId: string } }
) {
  const dataDirError = ensureDataDir();
  if (dataDirError) return dataDirError;

  try {
    const formData = await request.formData();
    const title = (formData.get('title') as string | null)?.trim();
    const file = formData.get('file') as File | null;
    const externalUrl = (formData.get('externalUrl') as string | null)?.trim();

    if (!title) {
      return NextResponse.json(
        { ok: false, error: 'title is required' },
        { status: 400 }
      );
    }

    if (!file) {
      return NextResponse.json(
        { ok: false, error: 'file is required' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { lectureId } = await uploadLecture({
      courseId: params.courseId,
      title,
      originalName: file.name,
      buffer,
      contentType: file.type,
      externalUrl: externalUrl || undefined,
    });

    return NextResponse.json({ ok: true, data: { lectureId } });
  } catch (error) {
    if (error instanceof UnsupportedLectureTypeError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 415 }
      );
    }

    if (error instanceof CourseNotFoundError) {
      return NextResponse.json(
        { ok: false, error: 'Course not found' },
        { status: 404 }
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, error: `Failed to upload lecture: ${message}` },
      { status: 500 }
    );
  }
}
