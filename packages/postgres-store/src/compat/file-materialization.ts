import * as fs from 'fs/promises';
import * as path from 'path';
import type { Course, ExamIndex, Lecture, RubricSpec } from '@hg/shared-schemas';
import type { LegacyExamRecord } from '../types';

const writeJsonAtomic = async (filePath: string, data: unknown): Promise<void> => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempFilePath = `${filePath}.tmp`;
  await fs.writeFile(tempFilePath, JSON.stringify(data, null, 2), 'utf-8');
  await fs.rename(tempFilePath, filePath);
};

const copyFileAtomic = async (sourcePath: string, targetPath: string): Promise<void> => {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  const tempFilePath = `${targetPath}.tmp`;
  await fs.copyFile(sourcePath, tempFilePath);
  await fs.rename(tempFilePath, targetPath);
};

export class CompatibilityMaterializationError extends Error {
  readonly code = 'COMPAT_EXPORT_FAILED';

  constructor(
    readonly entityType: string,
    readonly entityId: string,
    readonly targets: string[],
    cause: unknown
  ) {
    const details = targets.join(', ');
    const causeMessage = cause instanceof Error ? cause.message : String(cause);
    super(
      `Compatibility export failed for ${entityType} "${entityId}" (${details}): ${causeMessage}`
    );
    this.name = 'CompatibilityMaterializationError';
  }
}

const wrapMaterializationError = async <T>(
  args: {
    entityType: string;
    entityId: string;
    targets: string[];
  },
  action: () => Promise<T>
): Promise<T> => {
  try {
    return await action();
  } catch (error) {
    throw new CompatibilityMaterializationError(
      args.entityType,
      args.entityId,
      args.targets,
      error
    );
  }
};

export const materializeExamCompatibility = async (args: {
  dataDir: string;
  exam: LegacyExamRecord;
  sourceAssetPath: string;
}) => {
  const targetAssetPath = path.join(args.dataDir, args.exam.examFilePath);
  const examJsonPath = path.join(args.dataDir, 'exams', args.exam.examId, 'exam.json');

  await wrapMaterializationError(
    {
      entityType: 'exam',
      entityId: args.exam.examId,
      targets: [examJsonPath, targetAssetPath],
    },
    async () => {
      const resolvedSource = path.resolve(args.sourceAssetPath);
      const resolvedTarget = path.resolve(targetAssetPath);

      if (resolvedSource !== resolvedTarget) {
        await copyFileAtomic(resolvedSource, resolvedTarget);
      } else {
        await fs.mkdir(path.dirname(resolvedTarget), { recursive: true });
      }

      await writeJsonAtomic(examJsonPath, args.exam);
    }
  );
};

export const materializeRubricCompatibility = async (args: {
  dataDir: string;
  rubric: RubricSpec;
}) => {
  const rubricFilePath = path.join(
    args.dataDir,
    'rubrics',
    args.rubric.examId,
    `${args.rubric.questionId}.json`
  );

  await wrapMaterializationError(
    {
      entityType: 'rubric',
      entityId: `${args.rubric.examId}/${args.rubric.questionId}`,
      targets: [rubricFilePath],
    },
    async () => {
      await writeJsonAtomic(rubricFilePath, args.rubric);
    }
  );
};

export const materializeExamIndexCompatibility = async (args: {
  dataDir: string;
  examIndex: ExamIndex;
}) => {
  const examIndexPath = path.join(args.dataDir, 'exams', args.examIndex.examId, 'examIndex.json');

  await wrapMaterializationError(
    {
      entityType: 'exam_index',
      entityId: args.examIndex.examId,
      targets: [examIndexPath],
    },
    async () => {
      await writeJsonAtomic(examIndexPath, args.examIndex);
    }
  );
};

export const materializeCourseCompatibility = async (args: {
  dataDir: string;
  course: Course;
}) => {
  const courseDir = path.join(args.dataDir, 'courses', args.course.courseId);
  const lecturesDir = path.join(courseDir, 'lectures');
  const ragDir = path.join(courseDir, 'rag', 'v1');
  const courseFilePath = path.join(courseDir, 'course.json');

  await wrapMaterializationError(
    {
      entityType: 'course',
      entityId: args.course.courseId,
      targets: [courseFilePath],
    },
    async () => {
      await fs.mkdir(lecturesDir, { recursive: true });
      await fs.mkdir(ragDir, { recursive: true });
      await writeJsonAtomic(courseFilePath, args.course);
    }
  );
};

export const materializeLectureCompatibility = async (args: {
  dataDir: string;
  lecture: Lecture;
  sourceAssetPath: string;
}) => {
  const lectureDir = path.join(
    args.dataDir,
    'courses',
    args.lecture.courseId,
    'lectures',
    args.lecture.lectureId
  );
  const lectureFilePath = path.join(lectureDir, 'lecture.json');
  const targetAssetPath = path.join(args.dataDir, args.lecture.assetPath);

  await wrapMaterializationError(
    {
      entityType: 'lecture',
      entityId: `${args.lecture.courseId}/${args.lecture.lectureId}`,
      targets: [lectureFilePath, targetAssetPath],
    },
    async () => {
      const resolvedSource = path.resolve(args.sourceAssetPath);
      const resolvedTarget = path.resolve(targetAssetPath);

      if (resolvedSource !== resolvedTarget) {
        await copyFileAtomic(resolvedSource, resolvedTarget);
      } else {
        await fs.mkdir(path.dirname(resolvedTarget), { recursive: true });
      }

      await writeJsonAtomic(lectureFilePath, args.lecture);
    }
  );
};
