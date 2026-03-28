import * as fs from 'fs/promises';
import * as path from 'path';
import type { ExamIndex, RubricSpec } from '@hg/shared-schemas';
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

export const materializeExamCompatibility = async (args: {
  dataDir: string;
  exam: LegacyExamRecord;
  sourceAssetPath: string;
}) => {
  const targetAssetPath = path.join(args.dataDir, args.exam.examFilePath);
  const resolvedSource = path.resolve(args.sourceAssetPath);
  const resolvedTarget = path.resolve(targetAssetPath);

  if (resolvedSource !== resolvedTarget) {
    await copyFileAtomic(resolvedSource, resolvedTarget);
  } else {
    await fs.mkdir(path.dirname(resolvedTarget), { recursive: true });
  }

  await writeJsonAtomic(path.join(args.dataDir, 'exams', args.exam.examId, 'exam.json'), args.exam);
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
  await writeJsonAtomic(rubricFilePath, args.rubric);
};

export const materializeExamIndexCompatibility = async (args: {
  dataDir: string;
  examIndex: ExamIndex;
}) => {
  const examIndexPath = path.join(args.dataDir, 'exams', args.examIndex.examId, 'examIndex.json');
  await writeJsonAtomic(examIndexPath, args.examIndex);
};
