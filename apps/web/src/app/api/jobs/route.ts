import { NextRequest, NextResponse } from 'next/server';
import * as path from 'path';
import { getServerPersistence } from '../../../lib/server/persistence';
import { requireStaffApiAccess } from '@/lib/server/session';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const access = await requireStaffApiAccess();
  if (access instanceof NextResponse) return access;

  try {
    const persistence = getServerPersistence();
    if (!persistence) {
      return NextResponse.json(
        { error: 'DATABASE_URL is not set in environment' },
        { status: 500 }
      );
    }

    const dataDir = process.env.HG_DATA_DIR;
    if (!dataDir) {
      return NextResponse.json(
        { error: 'HG_DATA_DIR is not set in environment' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const questionFile = formData.get('question') as File | null;
    const submissionFile = formData.get('submission') as File | null;
    const notes = formData.get('notes') as string | null;
    const examId = formData.get('examId') as string | null;
    const questionId = formData.get('questionId') as string | null;
    const submissionMode = formData.get('submissionMode') as string | null;
    const gradingMode = (formData.get('gradingMode') as string | null) || 'RUBRIC';
    const gradingScope = (formData.get('gradingScope') as string | null) || 'QUESTION';
    const courseId = (formData.get('courseId') as string | null)?.trim() || null;

    if (!submissionFile) {
      return NextResponse.json(
        { error: 'Submission file is required' },
        { status: 400 }
      );
    }

    if (!examId) {
      return NextResponse.json(
        { error: 'examId is required' },
        { status: 400 }
      );
    }

    // Validate gradingMode
    if (gradingMode !== 'RUBRIC' && gradingMode !== 'GENERAL') {
      return NextResponse.json(
        { error: 'gradingMode must be RUBRIC or GENERAL' },
        { status: 400 }
      );
    }

    // Validate gradingScope
    if (gradingScope !== 'QUESTION' && gradingScope !== 'DOCUMENT') {
      return NextResponse.json(
        { error: 'gradingScope must be QUESTION or DOCUMENT' },
        { status: 400 }
      );
    }

    // Validate questionId based on mode/scope
    if (gradingMode === 'RUBRIC' || (gradingMode === 'GENERAL' && gradingScope === 'QUESTION')) {
      if (!questionId) {
        return NextResponse.json(
          { error: 'questionId is required for Rubric mode or General + Question scope' },
          { status: 400 }
        );
      }
    }

    const DATA_DIR = path.resolve(dataDir);

    const exam = await persistence.exams.getExam(examId);
    if (!exam) {
      return NextResponse.json(
        { error: 'Exam not found. Create it at /exams first.' },
        { status: 404 }
      );
    }

    let rubric = null;
    if (gradingMode === 'RUBRIC') {
      if (!questionId) {
        return NextResponse.json(
          { error: 'questionId is required for Rubric mode' },
          { status: 400 }
        );
      }

      rubric = await persistence.rubrics.getRubric(examId, questionId);
      if (!rubric) {
        return NextResponse.json(
          { error: 'Rubric not found. Create it at /rubrics first.' },
          { status: 404 }
        );
      }
    }

    const submissionBuffer = Buffer.from(await submissionFile.arrayBuffer());
    let submissionMimeType: string | undefined;
    if (submissionMode === 'pdf') {
      submissionMimeType = 'application/pdf';
    } else if (submissionFile.type) {
      submissionMimeType = submissionFile.type;
    } else {
      // Infer from extension as fallback
      const ext = path.extname(submissionFile.name).toLowerCase();
      if (ext === '.pdf') {
        submissionMimeType = 'application/pdf';
      } else if (ext === '.png') {
        submissionMimeType = 'image/png';
      } else if (ext === '.jpg' || ext === '.jpeg') {
        submissionMimeType = 'image/jpeg';
      } else if (ext === '.webp') {
        submissionMimeType = 'image/webp';
      }
    }

    const { jobId } = await persistence.jobs.createJob({
      dataDir: DATA_DIR,
      courseId,
      examId,
      examSourcePath: path.resolve(DATA_DIR, exam.examFilePath),
      questionId: questionId || undefined,
      notes: notes || undefined,
      rubric,
      gradingMode: gradingMode as 'RUBRIC' | 'GENERAL',
      gradingScope: gradingScope as 'QUESTION' | 'DOCUMENT',
      submission: {
        originalName: submissionFile.name,
        buffer: submissionBuffer,
        mimeType: submissionMimeType,
      },
      question:
        questionFile && questionFile.size > 0
          ? {
              originalName: questionFile.name,
              buffer: Buffer.from(await questionFile.arrayBuffer()),
              mimeType: questionFile.type || undefined,
            }
          : null,
    });

    return NextResponse.json({ jobId });
  } catch (error) {
    console.error('Error creating job:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Failed to create job: ${errorMessage}` },
      { status: 500 }
    );
  }
}

