import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createJob } from '@hg/local-job-store';
import { loadRubric, RubricNotFoundError } from '../../../lib/rubrics';
import { getExam, ExamNotFoundError } from '../../../lib/exams';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
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

    if (!submissionFile) {
      return NextResponse.json(
        { error: 'Submission file is required' },
        { status: 400 }
      );
    }

    if (!examId || !questionId) {
      return NextResponse.json(
        { error: 'examId and questionId are required' },
        { status: 400 }
      );
    }

    const DATA_DIR = path.resolve(dataDir);
    const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
    await fs.mkdir(UPLOADS_DIR, { recursive: true });

    // Load exam
    let exam;
    try {
      exam = await getExam(DATA_DIR, examId);
    } catch (error) {
      if (error instanceof ExamNotFoundError) {
        return NextResponse.json(
          { error: 'Exam not found. Create it at /exams first.' },
          { status: 404 }
        );
      }
      throw error;
    }

    // Resolve exam file path (relative to DATA_DIR)
    const examFilePath = path.join(DATA_DIR, exam.examFilePath);

    // Load rubric
    let rubric;
    try {
      rubric = await loadRubric(DATA_DIR, examId, questionId);
    } catch (error) {
      if (error instanceof RubricNotFoundError) {
        return NextResponse.json(
          { error: 'Rubric not found. Create it at /rubrics first.' },
          { status: 404 }
        );
      }
      throw error;
    }

    // Generate unique filenames for submission and optional question
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    const submissionExt = path.extname(submissionFile.name);
    const submissionFileName = `submission_${timestamp}_${random}${submissionExt}`;
    const submissionPath = path.join(UPLOADS_DIR, submissionFileName);

    // Write submission file
    const submissionBuffer = Buffer.from(await submissionFile.arrayBuffer());
    await fs.writeFile(submissionPath, submissionBuffer);

    // Write optional question file if provided and has content
    let questionPath: string | undefined;
    if (questionFile && questionFile.size > 0) {
      const questionExt = path.extname(questionFile.name);
      const questionFileName = `question_${timestamp}_${random}${questionExt}`;
      questionPath = path.join(UPLOADS_DIR, questionFileName);
      const questionBuffer = Buffer.from(await questionFile.arrayBuffer());
      await fs.writeFile(questionPath, questionBuffer);
    }

    // Create job
    const { jobId } = await createJob({
      examSourcePath: examFilePath,
      questionId,
      submissionSourcePath: submissionPath,
      questionSourcePath: questionPath,
      notes: notes || undefined,
      rubric,
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

