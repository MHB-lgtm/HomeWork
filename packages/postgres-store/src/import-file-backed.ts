import type { Dirent } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { ExamIndexStatus, PrismaClient } from '@prisma/client';
import {
  CourseSchema,
  ExamIndexSchema,
  LectureSchema,
  ReviewRecordSchema,
  RubricSpecSchema,
} from '@hg/shared-schemas';
import { ImportFileBackedOptions, ImportFileBackedSummary, LegacyJobRecord } from './types';
import {
  materializeCourseCompatibility,
  materializeExamCompatibility,
  materializeExamIndexCompatibility,
  materializeLectureCompatibility,
  materializeRubricCompatibility,
} from './compat/file-materialization';
import {
  deriveReviewStateFromLegacy,
  deriveSubmissionStateFromLegacy,
  getCourseDomainIdForLegacyJob,
  getExamAssetKey,
  getGradebookEntryDomainId,
  getImportedReviewVersionDomainId,
  getLectureAssetKey,
  getLectureMaterialDomainId,
  getPublishedResultDomainId,
  getReviewDomainId,
  getSubmissionAssetKey,
  getSubmissionDomainId,
  getSubmissionMaterialDomainId,
  parseLegacyJobRecord,
  PLACEHOLDER_COURSE_DOMAIN_ID,
  PLACEHOLDER_COURSE_LEGACY_KEY,
  resolveStoredPath,
} from './mappers/import';
import {
  actorKindFromReviewRecord,
  createStoredReviewRecordPayload,
  createLegacyReviewResultEnvelope,
  reviewVersionKindFromReviewRecord,
} from './mappers/review-record';
import {
  asJsonValue,
  toDate,
  toPrismaCourseMaterialKind,
  toPrismaCourseStatus,
  toPrismaDecimal,
  toPrismaGradebookEntryStatus,
  toPrismaPublishedResultStatus,
  toPrismaReviewState,
  toPrismaReviewVersionKind,
  toPrismaStoredAssetStorageKind,
  toPrismaSubmissionState,
} from './mappers/domain';
import { LegacyExamRecordSchema } from './schemas/exam';

type ImportLogger = Pick<Console, 'log' | 'warn'>;

type PlaceholderCourseRef = { id: string };
type CourseRowRef = { id: string };
type ExamRowRef = { id: string };
type CourseMaterialRef = { id: string };
type SubmissionRef = { id: string; currentPublishedResultId?: string | null };
type GradingJobRef = { id: string };

const readJsonFile = async (filePath: string): Promise<unknown | null> => {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }

    throw error;
  }
};

const readDirEntries = async (dirPath: string): Promise<Dirent[]> => {
  try {
    return await fs.readdir(dirPath, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }

    throw error;
  }
};

const createPreviewId = (kind: string, key: string): string => `dry-run:${kind}:${key}`;
const isPreviewId = (value: string): boolean => value.startsWith('dry-run:');

const createSummary = (dryRun: boolean): ImportFileBackedSummary => ({
  dryRun,
  importedCourses: 0,
  importedLectures: 0,
  importedLectureAssets: 0,
  importedExams: 0,
  importedRubrics: 0,
  importedExamIndexes: 0,
  importedJobsPending: 0,
  importedJobsRunning: 0,
  importedJobsDone: 0,
  importedJobsFailed: 0,
  importedSubmissions: 0,
  importedReviews: 0,
  importedPublishedResults: 0,
  updatedRecords: 0,
  skippedRecords: 0,
  unresolvedRecords: 0,
  failedRecords: 0,
  warningCounts: {},
  warnings: [],
  placeholderCourseDomainId: PLACEHOLDER_COURSE_DOMAIN_ID,
});

const addWarning = (
  summary: ImportFileBackedSummary,
  logger: ImportLogger,
  category: string,
  message: string
) => {
  summary.warnings.push(message);
  summary.warningCounts[category] = (summary.warningCounts[category] ?? 0) + 1;
  logger.warn(`[postgres-store] ${message}`);
};

const recordSkipped = (
  summary: ImportFileBackedSummary,
  logger: ImportLogger,
  category: string,
  message: string
) => {
  summary.skippedRecords += 1;
  addWarning(summary, logger, category, message);
};

const recordUnresolved = (
  summary: ImportFileBackedSummary,
  logger: ImportLogger,
  category: string,
  message: string
) => {
  summary.unresolvedRecords += 1;
  addWarning(summary, logger, category, message);
};

const recordFailed = (
  summary: ImportFileBackedSummary,
  logger: ImportLogger,
  category: string,
  message: string
) => {
  summary.failedRecords += 1;
  addWarning(summary, logger, category, message);
};

const countUpdated = (summary: ImportFileBackedSummary, wasExisting: boolean) => {
  if (wasExisting) {
    summary.updatedRecords += 1;
  }
};

const ensurePlaceholderCourse = async (
  prisma: PrismaClient,
  dryRun: boolean
): Promise<PlaceholderCourseRef> => {
  const existing = await prisma.course.findUnique({
    where: { domainId: PLACEHOLDER_COURSE_DOMAIN_ID },
    select: { id: true },
  });

  if (existing) {
    if (!dryRun) {
      await prisma.course.update({
        where: { id: existing.id },
        data: {
          legacyCourseKey: PLACEHOLDER_COURSE_LEGACY_KEY,
          title: 'Legacy Imported Reviews',
          status: toPrismaCourseStatus('archived'),
        },
      });
    }
    return existing;
  }

  if (dryRun) {
    return {
      id: createPreviewId('course', PLACEHOLDER_COURSE_DOMAIN_ID),
    };
  }

  return prisma.course.create({
    data: {
      domainId: PLACEHOLDER_COURSE_DOMAIN_ID,
      legacyCourseKey: PLACEHOLDER_COURSE_LEGACY_KEY,
      title: 'Legacy Imported Reviews',
      status: toPrismaCourseStatus('archived'),
    },
    select: { id: true },
  });
};

const upsertStoredAsset = async (
  prisma: PrismaClient,
  dryRun: boolean,
  params: {
    assetKey: string;
    logicalBucket: string;
    absolutePath: string;
    mimeType?: string;
    originalName?: string;
  }
) => {
  let sizeBytes: number | undefined;
  try {
    const stats = await fs.stat(params.absolutePath);
    sizeBytes = stats.size;
  } catch {
    sizeBytes = undefined;
  }

  const existing = await prisma.storedAsset.findUnique({
    where: { assetKey: params.assetKey },
    select: { id: true },
  });

  if (dryRun) {
    return existing ?? { id: createPreviewId('asset', params.assetKey) };
  }

  const data = {
    storageKind: toPrismaStoredAssetStorageKind('local_file'),
    logicalBucket: params.logicalBucket,
    path: params.absolutePath,
    mimeType: params.mimeType,
    sizeBytes,
    originalName: params.originalName ?? path.basename(params.absolutePath),
  };

  if (existing) {
    return prisma.storedAsset.update({
      where: { id: existing.id },
      data,
      select: { id: true },
    });
  }

  return prisma.storedAsset.create({
    data: {
      assetKey: params.assetKey,
      ...data,
    },
    select: { id: true },
  });
};

const countImportedJob = (
  summary: ImportFileBackedSummary,
  status?: string
) => {
  switch (status) {
    case 'RUNNING':
      summary.importedJobsRunning += 1;
      break;
    case 'DONE':
      summary.importedJobsDone += 1;
      break;
    case 'FAILED':
      summary.importedJobsFailed += 1;
      break;
    case 'PENDING':
    default:
      summary.importedJobsPending += 1;
      break;
  }
};

const ensureLegacyJobCourseRow = async (
  prisma: PrismaClient,
  dryRun: boolean,
  placeholderCourse: PlaceholderCourseRef,
  job: LegacyJobRecord
): Promise<CourseRowRef> => {
  const courseDomainId = getCourseDomainIdForLegacyJob(job.inputs?.courseId);

  if (courseDomainId === PLACEHOLDER_COURSE_DOMAIN_ID) {
    return placeholderCourse;
  }

  const existingCourse = await prisma.course.findUnique({
    where: { domainId: courseDomainId },
    select: { id: true },
  });

  if (dryRun) {
    return existingCourse ?? { id: createPreviewId('course', courseDomainId) };
  }

  if (existingCourse) {
    return prisma.course.update({
      where: { id: existingCourse.id },
      data: {
        legacyCourseKey: job.inputs?.courseId ?? null,
      },
      select: { id: true },
    });
  }

  return prisma.course.create({
    data: {
      domainId: courseDomainId,
      legacyCourseKey: job.inputs?.courseId ?? null,
      title: `Imported course ${courseDomainId}`,
      status: toPrismaCourseStatus('active'),
    },
    select: { id: true },
  });
};

const loadLegacyJobs = async (
  dataDir: string,
  summary: ImportFileBackedSummary,
  logger: ImportLogger
): Promise<Map<string, LegacyJobRecord>> => {
  const jobsById = new Map<string, LegacyJobRecord>();
  const jobDirs = ['pending', 'running', 'done', 'failed'];

  for (const statusDir of jobDirs) {
    const directory = path.join(dataDir, 'jobs', statusDir);
    const files = await readDirEntries(directory);
    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith('.json')) {
        continue;
      }

      const jobPath = path.join(directory, file.name);
      const raw = await readJsonFile(jobPath);
      const job = parseLegacyJobRecord(raw);
      if (!job) {
        recordSkipped(summary, logger, 'invalid_job_file', `Skipping invalid job file: ${jobPath}`);
        continue;
      }

      jobsById.set(job.id, job);
    }
  }

  return jobsById;
};

export const importFileBackedData = async (
  prisma: PrismaClient,
  options: ImportFileBackedOptions = {}
): Promise<ImportFileBackedSummary> => {
  const configuredDataDir = options.dataDir ?? process.env.HG_DATA_DIR;
  if (!configuredDataDir?.trim()) {
    throw new Error('HG_DATA_DIR is required or must be passed via --data-dir');
  }
  const dataDir = path.resolve(configuredDataDir);

  const dryRun = options.dryRun ?? false;
  const logger = options.logger ?? console;
  const summary = createSummary(dryRun);
  const placeholderCourse = await ensurePlaceholderCourse(prisma, dryRun);
  const examsByDomainId = new Map<string, ExamRowRef>();

  const courseEntries = await readDirEntries(path.join(dataDir, 'courses'));
  for (const courseEntry of courseEntries) {
    if (!courseEntry.isDirectory()) {
      continue;
    }

    try {
      const rawCourse = await readJsonFile(
        path.join(dataDir, 'courses', courseEntry.name, 'course.json')
      );
      const parsedCourse = CourseSchema.safeParse(rawCourse);
      if (!parsedCourse.success) {
        recordSkipped(summary, logger, 'invalid_course', `Skipping invalid course ${courseEntry.name}`);
        continue;
      }

      const course = parsedCourse.data;
      const existingCourse = await prisma.course.findUnique({
        where: { domainId: course.courseId },
        select: { id: true },
      });

      const courseRow: CourseRowRef =
        dryRun
          ? existingCourse ?? { id: createPreviewId('course', course.courseId) }
          : existingCourse
            ? await prisma.course.update({
                where: { id: existingCourse.id },
                data: {
                  legacyCourseKey: course.courseId,
                  title: course.title,
                  status: toPrismaCourseStatus('active'),
                  updatedAt: toDate(course.updatedAt),
                },
                select: { id: true },
              })
            : await prisma.course.create({
                data: {
                  domainId: course.courseId,
                  legacyCourseKey: course.courseId,
                  title: course.title,
                  status: toPrismaCourseStatus('active'),
                  createdAt: toDate(course.createdAt),
                  updatedAt: toDate(course.updatedAt),
                },
                select: { id: true },
              });

      summary.importedCourses += 1;
      countUpdated(summary, Boolean(existingCourse));

      if (!dryRun) {
        try {
          await materializeCourseCompatibility({
            dataDir,
            course,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          recordFailed(
            summary,
            logger,
            'course_compat_export_failed',
            `Failed to export course compatibility ${course.courseId}: ${message}`
          );
        }
      }

      const lectureEntries = await readDirEntries(
        path.join(dataDir, 'courses', courseEntry.name, 'lectures')
      );
      for (const lectureEntry of lectureEntries) {
        if (!lectureEntry.isDirectory()) {
          continue;
        }

        try {
          const rawLecture = await readJsonFile(
            path.join(
              dataDir,
              'courses',
              courseEntry.name,
              'lectures',
              lectureEntry.name,
              'lecture.json'
            )
          );
          const parsedLecture = LectureSchema.safeParse(rawLecture);
          if (!parsedLecture.success) {
            recordSkipped(
              summary,
              logger,
              'invalid_lecture',
              `Skipping invalid lecture ${course.courseId}/${lectureEntry.name}`
            );
            continue;
          }

          const lecture = parsedLecture.data;
          const absolutePath = resolveStoredPath(dataDir, lecture.assetPath);
          try {
            await fs.access(absolutePath);
          } catch {
            recordUnresolved(
              summary,
              logger,
              'missing_lecture_asset',
              `Skipping lecture with missing asset: ${course.courseId}/${lecture.lectureId}`
            );
            continue;
          }

          const existingLecture = await prisma.lecture.findUnique({
            where: { domainId: lecture.lectureId },
            select: { id: true },
          });
          const materialDomainId = getLectureMaterialDomainId(course.courseId, lecture.lectureId);
          const existingMaterial = await prisma.courseMaterial.findUnique({
            where: { domainId: materialDomainId },
            select: { id: true },
          });

          const asset = await upsertStoredAsset(prisma, dryRun, {
            assetKey: getLectureAssetKey(course.courseId, lecture.lectureId),
            logicalBucket: 'course_lectures',
            absolutePath,
            originalName: path.basename(absolutePath),
          });

          if (!dryRun) {
            if (existingLecture) {
              await prisma.lecture.update({
                where: { id: existingLecture.id },
                data: {
                  courseId: courseRow.id,
                  assetId: asset.id,
                  title: lecture.title,
                  sourceType:
                    lecture.sourceType === 'markdown'
                      ? 'MARKDOWN'
                      : lecture.sourceType === 'text'
                        ? 'TEXT'
                        : lecture.sourceType === 'transcript_vtt'
                          ? 'TRANSCRIPT_VTT'
                          : 'TRANSCRIPT_SRT',
                  assetPath: lecture.assetPath,
                  externalUrl: lecture.externalUrl ?? null,
                  updatedAt: toDate(lecture.updatedAt),
                },
                select: { id: true },
              });
            } else {
              await prisma.lecture.create({
                data: {
                  domainId: lecture.lectureId,
                  courseId: courseRow.id,
                  assetId: asset.id,
                  title: lecture.title,
                  sourceType:
                    lecture.sourceType === 'markdown'
                      ? 'MARKDOWN'
                      : lecture.sourceType === 'text'
                        ? 'TEXT'
                        : lecture.sourceType === 'transcript_vtt'
                          ? 'TRANSCRIPT_VTT'
                          : 'TRANSCRIPT_SRT',
                  assetPath: lecture.assetPath,
                  externalUrl: lecture.externalUrl ?? null,
                  createdAt: toDate(lecture.createdAt),
                  updatedAt: toDate(lecture.updatedAt),
                },
                select: { id: true },
              });
            }

            if (existingMaterial) {
              await prisma.courseMaterial.update({
                where: { id: existingMaterial.id },
                data: {
                  courseId: courseRow.id,
                  assetId: asset.id,
                  kind: toPrismaCourseMaterialKind('lecture_asset'),
                  title: lecture.title,
                  updatedAt: toDate(lecture.updatedAt),
                },
              });
            } else {
              await prisma.courseMaterial.create({
                data: {
                  domainId: materialDomainId,
                  courseId: courseRow.id,
                  assetId: asset.id,
                  kind: toPrismaCourseMaterialKind('lecture_asset'),
                  title: lecture.title,
                  createdAt: toDate(lecture.createdAt),
                  updatedAt: toDate(lecture.updatedAt),
                },
              });
            }

            try {
              await materializeLectureCompatibility({
                dataDir,
                lecture,
                sourceAssetPath: absolutePath,
              });
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              recordFailed(
                summary,
                logger,
                'lecture_compat_export_failed',
                `Failed to export lecture compatibility ${course.courseId}/${lecture.lectureId}: ${message}`
              );
            }
          }

          summary.importedLectures += 1;
          summary.importedLectureAssets += 1;
          countUpdated(summary, Boolean(existingLecture || existingMaterial));
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          recordFailed(
            summary,
            logger,
            'lecture_import_failed',
            `Failed to import lecture ${course.courseId}/${lectureEntry.name}: ${message}`
          );
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      recordFailed(
        summary,
        logger,
        'course_import_failed',
        `Failed to import course ${courseEntry.name}: ${message}`
      );
    }
  }

  const examEntries = await readDirEntries(path.join(dataDir, 'exams'));
  for (const examEntry of examEntries) {
    if (!examEntry.isDirectory()) {
      continue;
    }

    try {
      const rawExam = await readJsonFile(path.join(dataDir, 'exams', examEntry.name, 'exam.json'));
      const parsedExam = LegacyExamRecordSchema.safeParse(rawExam);
      if (!parsedExam.success) {
        recordSkipped(summary, logger, 'invalid_exam', `Skipping invalid exam ${examEntry.name}`);
        continue;
      }

      const exam = parsedExam.data;
      const absoluteAssetPath = resolveStoredPath(dataDir, exam.examFilePath);
      try {
        await fs.access(absoluteAssetPath);
      } catch {
        recordUnresolved(
          summary,
          logger,
          'missing_exam_asset',
          `Skipping exam with missing asset: ${exam.examId}`
        );
        continue;
      }

      const existingExam = await prisma.exam.findUnique({
        where: { domainId: exam.examId },
        select: { id: true },
      });

      const asset = await upsertStoredAsset(prisma, dryRun, {
        assetKey: getExamAssetKey(exam.examId),
        logicalBucket: 'exams',
        absolutePath: absoluteAssetPath,
        originalName: path.basename(absoluteAssetPath),
      });

      const examRow: ExamRowRef =
        dryRun
          ? existingExam ?? { id: createPreviewId('exam', exam.examId) }
          : existingExam
            ? await prisma.exam.update({
                where: { id: existingExam.id },
                data: {
                  title: exam.title,
                  assetId: asset.id,
                  updatedAt: toDate(exam.updatedAt),
                },
                select: { id: true },
              })
            : await prisma.exam.create({
                data: {
                  domainId: exam.examId,
                  title: exam.title,
                  assetId: asset.id,
                  createdAt: toDate(exam.createdAt),
                  updatedAt: toDate(exam.updatedAt),
                },
                select: { id: true },
              });

      examsByDomainId.set(exam.examId, examRow);
      summary.importedExams += 1;
      countUpdated(summary, Boolean(existingExam));

      if (!dryRun) {
        await materializeExamCompatibility({
          dataDir,
          exam,
          sourceAssetPath: absoluteAssetPath,
        });
      }

      const rawExamIndex = await readJsonFile(
        path.join(dataDir, 'exams', examEntry.name, 'examIndex.json')
      );
      if (rawExamIndex) {
        const parsedExamIndex = ExamIndexSchema.safeParse(rawExamIndex);
        if (!parsedExamIndex.success) {
          recordSkipped(
            summary,
            logger,
            'invalid_exam_index',
            `Skipping invalid exam index ${exam.examId}`
          );
        } else {
          const examIndex = parsedExamIndex.data;
          const existingExamIndex = dryRun
            ? existingExam
              ? await prisma.examIndex.findUnique({
                  where: { examRowId: examRow.id },
                  select: { id: true },
                })
              : null
            : await prisma.examIndex.findUnique({
                where: { examRowId: examRow.id },
                select: { id: true },
              });

          if (!dryRun) {
            const examIndexData = {
              examRowId: examRow.id,
              status:
                (examIndex.status === 'confirmed' ? 'CONFIRMED' : 'PROPOSED') as ExamIndexStatus,
              generatedAt: toDate(examIndex.generatedAt),
              updatedAt: toDate(examIndex.updatedAt),
              payloadJson: asJsonValue(examIndex),
            };

            if (existingExamIndex) {
              await prisma.examIndex.update({
                where: { id: existingExamIndex.id },
                data: examIndexData,
              });
            } else {
              await prisma.examIndex.create({
                data: examIndexData,
              });
            }

            await materializeExamIndexCompatibility({
              dataDir,
              examIndex,
            });
          }

          summary.importedExamIndexes += 1;
          countUpdated(summary, Boolean(existingExamIndex));
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      recordFailed(
        summary,
        logger,
        'exam_import_failed',
        `Failed to import exam ${examEntry.name}: ${message}`
      );
    }
  }

  const rubricExamEntries = await readDirEntries(path.join(dataDir, 'rubrics'));
  for (const rubricExamEntry of rubricExamEntries) {
    if (!rubricExamEntry.isDirectory()) {
      continue;
    }

    const examId = rubricExamEntry.name;
    const examRow =
      examsByDomainId.get(examId) ??
      (await prisma.exam.findUnique({
        where: { domainId: examId },
        select: { id: true },
      }));

    if (!examRow) {
      const rubricFiles = await readDirEntries(path.join(dataDir, 'rubrics', examId));
      for (const rubricFile of rubricFiles) {
        if (!rubricFile.isFile() || !rubricFile.name.endsWith('.json')) {
          continue;
        }

        recordUnresolved(
          summary,
          logger,
          'missing_exam_for_rubric',
          `Skipping rubric without matching exam: ${examId}/${rubricFile.name.replace(/\.json$/, '')}`
        );
      }
      continue;
    }

    const rubricFiles = await readDirEntries(path.join(dataDir, 'rubrics', examId));
    for (const rubricFile of rubricFiles) {
      if (!rubricFile.isFile() || !rubricFile.name.endsWith('.json')) {
        continue;
      }

      try {
        const rawRubric = await readJsonFile(path.join(dataDir, 'rubrics', examId, rubricFile.name));
        const parsedRubric = RubricSpecSchema.safeParse(rawRubric);
        if (!parsedRubric.success) {
          recordSkipped(
            summary,
            logger,
            'invalid_rubric',
            `Skipping invalid rubric ${examId}/${rubricFile.name.replace(/\.json$/, '')}`
          );
          continue;
        }

        const rubric = parsedRubric.data;
        const existingRubric =
          dryRun && isPreviewId(examRow.id)
            ? null
            : await prisma.rubric.findUnique({
                where: {
                  examRowId_questionId: {
                    examRowId: examRow.id,
                    questionId: rubric.questionId,
                  },
                },
                select: { id: true },
              });

        if (!dryRun) {
          const rubricData = {
            examRowId: examRow.id,
            questionId: rubric.questionId,
            title: rubric.title ?? null,
            generalGuidance: rubric.generalGuidance ?? null,
            criteriaJson: asJsonValue(rubric.criteria),
            rawPayload: asJsonValue(rubric),
          };

          if (existingRubric) {
            await prisma.rubric.update({
              where: { id: existingRubric.id },
              data: rubricData,
            });
          } else {
            await prisma.rubric.create({
              data: rubricData,
            });
          }

          await materializeRubricCompatibility({
            dataDir,
            rubric,
          });
        }

        summary.importedRubrics += 1;
        countUpdated(summary, Boolean(existingRubric));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        recordFailed(
          summary,
          logger,
          'rubric_import_failed',
          `Failed to import rubric ${examId}/${rubricFile.name.replace(/\.json$/, '')}: ${message}`
        );
      }
    }
  }

  const jobsById = await loadLegacyJobs(dataDir, summary, logger);

  for (const job of jobsById.values()) {
    try {
      const normalizedStatus: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED' =
        job.status === 'RUNNING' ||
        job.status === 'DONE' ||
        job.status === 'FAILED' ||
        job.status === 'PENDING'
          ? job.status
          : 'PENDING';

      countImportedJob(summary, normalizedStatus);

      if (!job.inputs?.submissionFilePath) {
        recordUnresolved(
          summary,
          logger,
          'missing_submission_file_path',
          `Skipping job without submission file path: ${job.id}`
        );
        continue;
      }

      if (!job.inputs.examFilePath) {
        recordUnresolved(
          summary,
          logger,
          'missing_exam_snapshot_path',
          `Skipping job without exam snapshot path: ${job.id}`
        );
        continue;
      }

      if (!job.inputs.examId) {
        recordUnresolved(
          summary,
          logger,
          'missing_exam_id',
          `Skipping job without examId: ${job.id}`
        );
        continue;
      }

      const examRow =
        examsByDomainId.get(job.inputs.examId) ??
        (await prisma.exam.findUnique({
          where: { domainId: job.inputs.examId },
          select: { id: true },
        }));

      if (!examRow) {
        recordUnresolved(
          summary,
          logger,
          'missing_exam_for_job',
          `Skipping job without matching exam: ${job.id}`
        );
        continue;
      }

      const submissionAbsolutePath = resolveStoredPath(dataDir, job.inputs.submissionFilePath);
      const examSnapshotAbsolutePath = resolveStoredPath(dataDir, job.inputs.examFilePath);
      const questionAbsolutePath = job.inputs.questionFilePath
        ? resolveStoredPath(dataDir, job.inputs.questionFilePath)
        : null;

      try {
        await fs.access(submissionAbsolutePath);
      } catch {
        recordUnresolved(
          summary,
          logger,
          'missing_submission_asset',
          `Skipping job with missing submission asset: ${job.id}`
        );
        continue;
      }

      try {
        await fs.access(examSnapshotAbsolutePath);
      } catch {
        recordUnresolved(
          summary,
          logger,
          'missing_exam_snapshot_asset',
          `Skipping job with missing exam snapshot asset: ${job.id}`
        );
        continue;
      }

      if (questionAbsolutePath) {
        try {
          await fs.access(questionAbsolutePath);
        } catch {
          recordUnresolved(
            summary,
            logger,
            'missing_question_asset',
            `Skipping job with missing question asset: ${job.id}`
          );
          continue;
        }
      }

      const resolvedCourseRow = await ensureLegacyJobCourseRow(
        prisma,
        dryRun,
        placeholderCourse,
        job
      );
      const submissionDomainId = getSubmissionDomainId(job.id);
      const submissionMaterialDomainId = getSubmissionMaterialDomainId(job.id);
      const reviewDomainId = getReviewDomainId(job.id);
      const existingSubmission = await prisma.submission.findUnique({
        where: { domainId: submissionDomainId },
        select: { id: true, currentPublishedResultId: true },
      });
      const existingSubmissionMaterial = await prisma.courseMaterial.findUnique({
        where: { domainId: submissionMaterialDomainId },
        select: { id: true },
      });
      const existingReview = await prisma.review.findUnique({
        where: { domainId: reviewDomainId },
        select: { id: true },
      });
      const existingGradingJob = await prisma.gradingJob.findUnique({
        where: { domainId: job.id },
        select: { id: true },
      });

      const submissionAsset = await upsertStoredAsset(prisma, dryRun, {
        assetKey: getSubmissionAssetKey(job.id),
        logicalBucket: 'job_submissions',
        absolutePath: submissionAbsolutePath,
        mimeType: job.inputs.submissionMimeType,
        originalName: path.basename(submissionAbsolutePath),
      });
      const examSnapshotAsset = await upsertStoredAsset(prisma, dryRun, {
        assetKey: `job-exam-snapshot:${job.id}`,
        logicalBucket: 'job_exam_snapshots',
        absolutePath: examSnapshotAbsolutePath,
        originalName: path.basename(examSnapshotAbsolutePath),
      });
      const questionAsset = questionAbsolutePath
        ? await upsertStoredAsset(prisma, dryRun, {
            assetKey: `job-question:${job.id}`,
            logicalBucket: 'job_questions',
            absolutePath: questionAbsolutePath,
            originalName: path.basename(questionAbsolutePath),
          })
        : null;

      const jobCreatedAt = job.createdAt ?? new Date().toISOString();
      const jobUpdatedAt = job.updatedAt ?? jobCreatedAt;

      const submissionMaterial: CourseMaterialRef =
        dryRun
          ? existingSubmissionMaterial ?? {
              id: createPreviewId('material', submissionMaterialDomainId),
            }
          : existingSubmissionMaterial
            ? await prisma.courseMaterial.update({
                where: { id: existingSubmissionMaterial.id },
                data: {
                  courseId: resolvedCourseRow.id,
                  assetId: submissionAsset.id,
                  kind: toPrismaCourseMaterialKind('submission_pdf'),
                  title: path.basename(submissionAbsolutePath),
                  updatedAt: toDate(jobUpdatedAt),
                },
                select: { id: true },
              })
            : await prisma.courseMaterial.create({
                data: {
                  domainId: submissionMaterialDomainId,
                  courseId: resolvedCourseRow.id,
                  assetId: submissionAsset.id,
                  kind: toPrismaCourseMaterialKind('submission_pdf'),
                  title: path.basename(submissionAbsolutePath),
                  createdAt: toDate(jobCreatedAt),
                  updatedAt: toDate(jobUpdatedAt),
                },
                select: { id: true },
              });

      const submission: SubmissionRef =
        dryRun
          ? existingSubmission ?? {
              id: createPreviewId('submission', submissionDomainId),
              currentPublishedResultId: null,
            }
          : existingSubmission
            ? await prisma.submission.update({
                where: { id: existingSubmission.id },
                data: {
                  courseId: resolvedCourseRow.id,
                  materialId: submissionMaterial.id,
                  state: toPrismaSubmissionState(
                    deriveSubmissionStateFromLegacy(job, null, false)
                  ),
                  updatedAt: toDate(jobUpdatedAt),
                },
                select: { id: true, currentPublishedResultId: true },
              })
            : await prisma.submission.create({
                data: {
                  domainId: submissionDomainId,
                  courseId: resolvedCourseRow.id,
                  studentUserId: null,
                  moduleType: 'LEGACY_JOB',
                  legacyJobId: job.id,
                  materialId: submissionMaterial.id,
                  submittedAt: toDate(jobCreatedAt),
                  state: toPrismaSubmissionState(
                    deriveSubmissionStateFromLegacy(job, null, false)
                  ),
                  createdAt: toDate(jobCreatedAt),
                  updatedAt: toDate(jobUpdatedAt),
                },
                select: { id: true, currentPublishedResultId: true },
              });

      if (!dryRun) {
        if (existingReview) {
          await prisma.review.update({
            where: { id: existingReview.id },
            data: {
              courseId: resolvedCourseRow.id,
              submissionId: submission.id,
              updatedAt: toDate(jobUpdatedAt),
            },
          });
        } else {
          await prisma.review.create({
            data: {
              domainId: reviewDomainId,
              courseId: resolvedCourseRow.id,
              submissionId: submission.id,
              state: toPrismaReviewState('draft'),
              createdAt: toDate(jobCreatedAt),
              updatedAt: toDate(jobUpdatedAt),
            },
          });
        }

        const rubric = job.rubric ? RubricSpecSchema.safeParse(job.rubric) : null;
        const rubricJsonValue = rubric && rubric.success ? asJsonValue(rubric.data) : undefined;
        const gradingMode: 'RUBRIC' | 'GENERAL' =
          job.inputs.gradingMode === 'GENERAL' ? 'GENERAL' : 'RUBRIC';
        const gradingScope: 'QUESTION' | 'DOCUMENT' =
          job.inputs.gradingScope === 'DOCUMENT' ? 'DOCUMENT' : 'QUESTION';
        const gradingJobData = {
          courseId:
            job.inputs.courseId?.trim() && resolvedCourseRow.id !== placeholderCourse.id
              ? resolvedCourseRow.id
              : null,
          submissionId: submission.id,
          examRowId: examRow.id,
          examSnapshotAssetId: examSnapshotAsset.id,
          submissionAssetId: submissionAsset.id,
          questionAssetId: questionAsset?.id ?? null,
          status: normalizedStatus,
          questionId: job.inputs.questionId?.trim() || null,
          submissionMimeType: job.inputs.submissionMimeType ?? null,
          gradingMode,
          gradingScope,
          notes: job.inputs.notes?.trim() || null,
          rubricJson: rubricJsonValue,
          resultJson: job.resultJson ? asJsonValue(job.resultJson) : undefined,
          errorMessage: job.errorMessage ?? null,
          claimedAt:
            normalizedStatus === 'RUNNING' ? toDate(jobUpdatedAt) : null,
          leaseExpiresAt:
            normalizedStatus === 'RUNNING' ? toDate(jobUpdatedAt) : null,
          completedAt:
            normalizedStatus === 'DONE' ? toDate(jobUpdatedAt) : null,
          failedAt:
            normalizedStatus === 'FAILED' ? toDate(jobUpdatedAt) : null,
          updatedAt: toDate(jobUpdatedAt),
        };

        if (existingGradingJob) {
          await prisma.gradingJob.update({
            where: { id: existingGradingJob.id },
            data: gradingJobData,
            select: { id: true },
          });
        } else {
          await prisma.gradingJob.create({
            data: {
              domainId: job.id,
              createdAt: toDate(jobCreatedAt),
              ...gradingJobData,
            },
            select: { id: true },
          });
        }
      }

      countUpdated(
        summary,
        Boolean(
          existingGradingJob ||
            existingSubmission ||
            existingSubmissionMaterial ||
            existingReview
        )
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      recordFailed(
        summary,
        logger,
        'job_import_failed',
        `Failed to import job ${job.id}: ${message}`
      );
    }
  }

  const reviewEntries = await readDirEntries(path.join(dataDir, 'reviews'));

  for (const reviewEntry of reviewEntries) {
    if (!reviewEntry.isFile() || !reviewEntry.name.endsWith('.json')) {
      continue;
    }

    try {
      const rawReview = await readJsonFile(path.join(dataDir, 'reviews', reviewEntry.name));
      const parsedReview = ReviewRecordSchema.safeParse(rawReview);
      if (!parsedReview.success) {
        recordSkipped(
          summary,
          logger,
          'invalid_review',
          `Skipping invalid review ${reviewEntry.name}`
        );
        continue;
      }

      const reviewRecord = parsedReview.data;
      const job = jobsById.get(reviewRecord.jobId);
      if (!job) {
        recordUnresolved(
          summary,
          logger,
          'missing_job',
          `Skipping review without matching job: ${reviewRecord.jobId}`
        );
        continue;
      }

      if (!job.inputs?.submissionFilePath) {
        recordUnresolved(
          summary,
          logger,
          'missing_submission_file_path',
          `Skipping review without submission file path: ${reviewRecord.jobId}`
        );
        continue;
      }

      const courseDomainId = getCourseDomainIdForLegacyJob(job.inputs.courseId);

      const importedVersionDomainId = getImportedReviewVersionDomainId(job.id);
      const publishedResultDomainId = getPublishedResultDomainId(job.id);
      const submissionDomainId = getSubmissionDomainId(job.id);
      const submissionMaterialDomainId = getSubmissionMaterialDomainId(job.id);

      let resolvedCourseRow: CourseRowRef = placeholderCourse;
      if (courseDomainId !== PLACEHOLDER_COURSE_DOMAIN_ID) {
        const existingCourse = await prisma.course.findUnique({
          where: { domainId: courseDomainId },
          select: { id: true },
        });

        resolvedCourseRow =
          dryRun
            ? existingCourse ?? { id: createPreviewId('course', courseDomainId) }
            : existingCourse
              ? await prisma.course.update({
                  where: { id: existingCourse.id },
                  data: {
                    legacyCourseKey: job.inputs.courseId ?? null,
                  },
                  select: { id: true },
                })
              : await prisma.course.create({
                  data: {
                    domainId: courseDomainId,
                    legacyCourseKey: job.inputs.courseId ?? null,
                    title: `Imported course ${courseDomainId}`,
                    status: toPrismaCourseStatus('active'),
                  },
                  select: { id: true },
                });
      } else {
        resolvedCourseRow = placeholderCourse;
      }

      const existingSubmission = await prisma.submission.findUnique({
        where: { domainId: submissionDomainId },
        select: { id: true, currentPublishedResultId: true },
      });
      const existingImportedVersion = await prisma.reviewVersion.findUnique({
        where: { domainId: importedVersionDomainId },
        select: { id: true },
      });

      const envelope = createLegacyReviewResultEnvelope(reviewRecord, job.resultJson);
      const storedReviewPayload = createStoredReviewRecordPayload(reviewRecord, {
        status: job.status,
        resultJson: job.resultJson ?? null,
        errorMessage: job.errorMessage ?? null,
        submissionMimeType: job.inputs.submissionMimeType ?? null,
        gradingMode: job.inputs.gradingMode ?? null,
        gradingScope: job.inputs.gradingScope ?? null,
      });
      const hasPublishedResult =
        typeof envelope.score === 'number' &&
        typeof envelope.maxScore === 'number' &&
        typeof envelope.summary === 'string' &&
        envelope.summary.trim().length > 0;

      const existingPublishedResult = hasPublishedResult
        ? await prisma.publishedResult.findUnique({
            where: { domainId: publishedResultDomainId },
            select: { id: true },
          })
        : null;

      const reviewWasExisting = Boolean(
        existingSubmission || existingImportedVersion || existingPublishedResult
      );

      const submissionAsset = await upsertStoredAsset(prisma, dryRun, {
        assetKey: getSubmissionAssetKey(job.id),
        logicalBucket: 'job_submissions',
        absolutePath: resolveStoredPath(dataDir, job.inputs.submissionFilePath),
        mimeType: job.inputs.submissionMimeType,
        originalName: path.basename(job.inputs.submissionFilePath),
      });

      const existingSubmissionMaterial = await prisma.courseMaterial.findUnique({
        where: { domainId: submissionMaterialDomainId },
        select: { id: true },
      });

      const submissionMaterial: CourseMaterialRef =
        dryRun
          ? existingSubmissionMaterial ?? {
              id: createPreviewId('material', submissionMaterialDomainId),
            }
          : existingSubmissionMaterial
            ? await prisma.courseMaterial.update({
                where: { id: existingSubmissionMaterial.id },
                data: {
                  courseId: resolvedCourseRow.id,
                  assetId: submissionAsset.id,
                  kind: toPrismaCourseMaterialKind('submission_pdf'),
                  title: reviewRecord.displayName ?? path.basename(job.inputs.submissionFilePath),
                  updatedAt: toDate(reviewRecord.updatedAt),
                },
                select: { id: true },
              })
            : await prisma.courseMaterial.create({
                data: {
                  domainId: submissionMaterialDomainId,
                  courseId: resolvedCourseRow.id,
                  assetId: submissionAsset.id,
                  kind: toPrismaCourseMaterialKind('submission_pdf'),
                  title: reviewRecord.displayName ?? path.basename(job.inputs.submissionFilePath),
                  createdAt: toDate(reviewRecord.createdAt),
                  updatedAt: toDate(reviewRecord.updatedAt),
                },
                select: { id: true },
              });

      const submission: SubmissionRef =
        dryRun
          ? existingSubmission ?? {
              id: createPreviewId('submission', submissionDomainId),
              currentPublishedResultId: null,
            }
          : existingSubmission
            ? await prisma.submission.update({
                where: { id: existingSubmission.id },
                data: {
                  courseId: resolvedCourseRow.id,
                  materialId: submissionMaterial.id,
                  state: toPrismaSubmissionState(
                    deriveSubmissionStateFromLegacy(job, reviewRecord, hasPublishedResult)
                  ),
                  updatedAt: toDate(job.updatedAt ?? reviewRecord.updatedAt),
                },
                select: { id: true, currentPublishedResultId: true },
              })
            : await prisma.submission.create({
                data: {
                  domainId: submissionDomainId,
                  courseId: resolvedCourseRow.id,
                  studentUserId: null,
                  moduleType: 'LEGACY_JOB',
                  legacyJobId: job.id,
                  materialId: submissionMaterial.id,
                  submittedAt: toDate(job.createdAt ?? reviewRecord.createdAt),
                  state: toPrismaSubmissionState(
                    deriveSubmissionStateFromLegacy(job, reviewRecord, hasPublishedResult)
                  ),
                  createdAt: toDate(job.createdAt ?? reviewRecord.createdAt),
                  updatedAt: toDate(job.updatedAt ?? reviewRecord.updatedAt),
                },
                select: { id: true, currentPublishedResultId: true },
              });

      if (!dryRun) {
        await prisma.$transaction(async (tx) => {
          const reviewDomainId = getReviewDomainId(job.id);
          const existingReview = await tx.review.findUnique({
            where: { domainId: reviewDomainId },
            select: { id: true, currentVersionId: true },
          });

          const reviewRow =
            existingReview
              ? await tx.review.update({
                  where: { id: existingReview.id },
                  data: {
                    courseId: resolvedCourseRow.id,
                    submissionId: submission.id,
                    updatedAt: toDate(reviewRecord.updatedAt),
                  },
                  select: { id: true, currentVersionId: true },
                })
              : await tx.review.create({
                  data: {
                    domainId: reviewDomainId,
                    courseId: resolvedCourseRow.id,
                    submissionId: submission.id,
                    state: toPrismaReviewState(
                      deriveReviewStateFromLegacy(reviewRecord, hasPublishedResult)
                    ),
                    createdAt: toDate(reviewRecord.createdAt),
                    updatedAt: toDate(reviewRecord.updatedAt),
                  },
                  select: { id: true, currentVersionId: true },
                });

          const importedVersion = existingImportedVersion
            ? await tx.reviewVersion.update({
                where: { id: existingImportedVersion.id },
                data: {
                  reviewId: reviewRow.id,
                  kind: toPrismaReviewVersionKind(reviewVersionKindFromReviewRecord(reviewRecord)),
                  actorKind: actorKindFromReviewRecord(reviewRecord),
                  actorRefRaw:
                    reviewVersionKindFromReviewRecord(reviewRecord) === 'lecturer_edit'
                      ? 'legacy-human'
                      : 'legacy-ai',
                  score:
                    typeof envelope.score === 'number' ? toPrismaDecimal(envelope.score) : null,
                  maxScore:
                    typeof envelope.maxScore === 'number'
                      ? toPrismaDecimal(envelope.maxScore)
                      : null,
                  summary: envelope.summary ?? null,
                  questionBreakdown: asJsonValue(envelope.questionBreakdown ?? null),
                  rawPayload: asJsonValue(storedReviewPayload),
                  createdAt: toDate(reviewRecord.updatedAt),
                },
                select: { id: true },
              })
            : await tx.reviewVersion.create({
                data: {
                  domainId: importedVersionDomainId,
                  reviewId: reviewRow.id,
                  kind: toPrismaReviewVersionKind(reviewVersionKindFromReviewRecord(reviewRecord)),
                  actorKind: actorKindFromReviewRecord(reviewRecord),
                  actorRefRaw:
                    reviewVersionKindFromReviewRecord(reviewRecord) === 'lecturer_edit'
                      ? 'legacy-human'
                      : 'legacy-ai',
                  score:
                    typeof envelope.score === 'number' ? toPrismaDecimal(envelope.score) : null,
                  maxScore:
                    typeof envelope.maxScore === 'number'
                      ? toPrismaDecimal(envelope.maxScore)
                      : null,
                  summary: envelope.summary ?? null,
                  questionBreakdown: asJsonValue(envelope.questionBreakdown ?? null),
                  rawPayload: asJsonValue(storedReviewPayload),
                  createdAt: toDate(reviewRecord.updatedAt),
                },
                select: { id: true },
              });

          if (!reviewRow.currentVersionId || reviewRow.currentVersionId === importedVersion.id) {
            await tx.review.update({
              where: { id: reviewRow.id },
              data: {
                currentVersionId: importedVersion.id,
                state: toPrismaReviewState(
                  deriveReviewStateFromLegacy(reviewRecord, hasPublishedResult)
                ),
                updatedAt: toDate(reviewRecord.updatedAt),
              },
            });
          }

          if (!hasPublishedResult || envelope.score === undefined || envelope.maxScore === undefined) {
            return;
          }

          const currentEffectivePublishedResult = await tx.publishedResult.findFirst({
            where: {
              submissionId: submission.id,
              status: toPrismaPublishedResultStatus('effective'),
            },
            select: { id: true },
          });

          const importedPublishedResultShouldBeEffective =
            !currentEffectivePublishedResult ||
            currentEffectivePublishedResult.id === existingPublishedResult?.id;

          const importedPublishedResultStatus = toPrismaPublishedResultStatus(
            importedPublishedResultShouldBeEffective ? 'effective' : 'superseded'
          );

          const publishedResult = existingPublishedResult
            ? await tx.publishedResult.update({
                where: { id: existingPublishedResult.id },
                data: {
                  courseId: resolvedCourseRow.id,
                  submissionId: submission.id,
                  reviewId: reviewRow.id,
                  sourceReviewVersionId: importedVersion.id,
                  publishedAt: toDate(job.updatedAt ?? reviewRecord.updatedAt),
                  status: importedPublishedResultStatus,
                  finalScore: toPrismaDecimal(envelope.score),
                  maxScore: toPrismaDecimal(envelope.maxScore),
                  summary: envelope.summary ?? 'Imported legacy result',
                  breakdownSnapshot: asJsonValue(envelope.questionBreakdown ?? null),
                },
                select: { id: true },
              })
            : await tx.publishedResult.create({
                data: {
                  domainId: publishedResultDomainId,
                  courseId: resolvedCourseRow.id,
                  submissionId: submission.id,
                  studentUserId: null,
                  moduleType: 'LEGACY_JOB',
                  reviewId: reviewRow.id,
                  sourceReviewVersionId: importedVersion.id,
                  publishedAt: toDate(job.updatedAt ?? reviewRecord.updatedAt),
                  status: importedPublishedResultStatus,
                  finalScore: toPrismaDecimal(envelope.score),
                  maxScore: toPrismaDecimal(envelope.maxScore),
                  summary: envelope.summary ?? 'Imported legacy result',
                  breakdownSnapshot: asJsonValue(envelope.questionBreakdown ?? null),
                },
                select: { id: true },
              });

          if (!importedPublishedResultShouldBeEffective) {
            return;
          }

          const existingGradebookEntry = await tx.gradebookEntry.findUnique({
            where: { domainId: getGradebookEntryDomainId(job.id) },
            select: { id: true },
          });

          if (existingGradebookEntry) {
            await tx.gradebookEntry.update({
              where: { id: existingGradebookEntry.id },
              data: {
                courseId: resolvedCourseRow.id,
                publishedResultId: publishedResult.id,
                score: toPrismaDecimal(envelope.score),
                maxScore: toPrismaDecimal(envelope.maxScore),
                status: toPrismaGradebookEntryStatus('effective'),
                publishedAt: toDate(job.updatedAt ?? reviewRecord.updatedAt),
              },
            });
          } else {
            await tx.gradebookEntry.create({
              data: {
                domainId: getGradebookEntryDomainId(job.id),
                courseId: resolvedCourseRow.id,
                studentUserId: null,
                moduleType: 'LEGACY_JOB',
                publishedResultId: publishedResult.id,
                score: toPrismaDecimal(envelope.score),
                maxScore: toPrismaDecimal(envelope.maxScore),
                status: toPrismaGradebookEntryStatus('effective'),
                publishedAt: toDate(job.updatedAt ?? reviewRecord.updatedAt),
              },
            });
          }

          if (
            !submission.currentPublishedResultId ||
            submission.currentPublishedResultId === publishedResult.id
          ) {
            await tx.submission.update({
              where: { id: submission.id },
              data: { currentPublishedResultId: publishedResult.id },
            });
          }
        }, {
          maxWait: 10_000,
          timeout: 30_000,
        });
      }

      summary.importedSubmissions += 1;
      summary.importedReviews += 1;
      if (hasPublishedResult) {
        summary.importedPublishedResults += 1;
      }
      countUpdated(summary, reviewWasExisting || Boolean(existingSubmissionMaterial));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      recordFailed(
        summary,
        logger,
        'review_import_failed',
        `Failed to import review ${reviewEntry.name}: ${message}`
      );
    }
  }

  logger.log(
    `[postgres-store] ${dryRun ? 'dry-run ' : ''}import summary courses=${summary.importedCourses} lectures=${summary.importedLectures} exams=${summary.importedExams} rubrics=${summary.importedRubrics} examIndexes=${summary.importedExamIndexes} jobsPending=${summary.importedJobsPending} jobsRunning=${summary.importedJobsRunning} jobsDone=${summary.importedJobsDone} jobsFailed=${summary.importedJobsFailed} submissions=${summary.importedSubmissions} reviews=${summary.importedReviews} published=${summary.importedPublishedResults} updated=${summary.updatedRecords} skipped=${summary.skippedRecords} unresolved=${summary.unresolvedRecords} failed=${summary.failedRecords}`
  );

  return summary;
};
