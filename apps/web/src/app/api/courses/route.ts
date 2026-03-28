import { NextRequest, NextResponse } from 'next/server';
import * as path from 'path';
import {
  CompatibilityMaterializationError,
  materializeCourseCompatibility,
} from '@hg/postgres-store';
import { getServerPersistence } from '../../../lib/server/persistence';

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

export async function GET() {
  const persistence = ensurePersistence();
  if (persistence instanceof NextResponse) return persistence;

  try {
    const courses = await persistence.courses.listCourses();
    return NextResponse.json({ ok: true, data: courses });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, error: `Failed to list courses: ${message}`, code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const title = (body?.title as string | undefined)?.trim();

    if (!title) {
      return NextResponse.json(
        { ok: false, error: 'title is required', code: 'BAD_REQUEST' },
        { status: 400 }
      );
    }

    const course = await persistence.courses.createCourse({ title });

    try {
      await materializeCourseCompatibility({
        dataDir: path.resolve(dataDir),
        course,
      });
    } catch (error) {
      if (error instanceof CompatibilityMaterializationError) {
        console.error('[courses] compatibility export failed', {
          courseId: course.courseId,
          targets: error.targets,
        });

        return NextResponse.json(
          {
            ok: false,
            error: 'Course saved to Postgres but compatibility export failed',
            code: error.code,
            data: { courseId: course.courseId },
          },
          { status: 500 }
        );
      }

      throw error;
    }

    return NextResponse.json({ ok: true, data: { courseId: course.courseId } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { ok: false, error: `Failed to create course: ${message}`, code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
