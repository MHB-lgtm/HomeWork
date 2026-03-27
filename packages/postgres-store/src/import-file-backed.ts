import type { Dirent } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { PrismaClient } from '@prisma/client';
import { CourseSchema, LectureSchema, ReviewRecordSchema } from '@hg/shared-schemas';
import { ImportFileBackedOptions, ImportFileBackedSummary, LegacyJobRecord } from './types';
import {
  deriveReviewStateFromLegacy,
  deriveSubmissionStateFromLegacy,
  getCourseDomainIdForLegacyJob,
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
import { actorKindFromReviewRecord, createLegacyReviewResultEnvelope, reviewVersionKindFromReviewRecord } from './mappers/review-record';
import { asJsonValue, toDate, toPrismaCourseMaterialKind, toPrismaCourseStatus, toPrismaDecimal, toPrismaGradebookEntryStatus, toPrismaPublishedResultStatus, toPrismaReviewState, toPrismaReviewVersionKind, toPrismaStoredAssetStorageKind, toPrismaSubmissionState } from './mappers/domain';

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

const ensurePlaceholderCourse = async (prisma: PrismaClient) =>
  prisma.course.upsert({
    where: { domainId: PLACEHOLDER_COURSE_DOMAIN_ID },
    create: {
      domainId: PLACEHOLDER_COURSE_DOMAIN_ID,
      legacyCourseKey: PLACEHOLDER_COURSE_LEGACY_KEY,
      title: 'Legacy Imported Reviews',
      status: toPrismaCourseStatus('archived'),
    },
    update: {
      legacyCourseKey: PLACEHOLDER_COURSE_LEGACY_KEY,
      title: 'Legacy Imported Reviews',
      status: toPrismaCourseStatus('archived'),
    },
  });

const upsertStoredAsset = async (
  prisma: PrismaClient,
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

  return prisma.storedAsset.upsert({
    where: { assetKey: params.assetKey },
    create: {
      assetKey: params.assetKey,
      storageKind: toPrismaStoredAssetStorageKind('local_file'),
      logicalBucket: params.logicalBucket,
      path: params.absolutePath,
      mimeType: params.mimeType,
      sizeBytes,
      originalName: params.originalName ?? path.basename(params.absolutePath),
    },
    update: {
      storageKind: toPrismaStoredAssetStorageKind('local_file'),
      logicalBucket: params.logicalBucket,
      path: params.absolutePath,
      mimeType: params.mimeType,
      sizeBytes,
      originalName: params.originalName ?? path.basename(params.absolutePath),
    },
  });
};

const loadLegacyJobs = async (
  dataDir: string,
  warnings: string[]
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

      const raw = await readJsonFile(path.join(directory, file.name));
      const job = parseLegacyJobRecord(raw);
      if (!job) {
        warnings.push(`Skipping invalid job file: ${path.join(directory, file.name)}`);
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

  const logger = options.logger ?? console;
  const warnings: string[] = [];
  const summary: ImportFileBackedSummary = {
    importedCourses: 0,
    importedLectureAssets: 0,
    importedSubmissions: 0,
    importedReviews: 0,
    importedPublishedResults: 0,
    warnings,
    placeholderCourseDomainId: PLACEHOLDER_COURSE_DOMAIN_ID,
  };

  await ensurePlaceholderCourse(prisma);

  const courseEntries = await readDirEntries(path.join(dataDir, 'courses'));
  for (const courseEntry of courseEntries) {
    if (!courseEntry.isDirectory()) {
      continue;
    }

    const rawCourse = await readJsonFile(
      path.join(dataDir, 'courses', courseEntry.name, 'course.json')
    );
    const parsedCourse = CourseSchema.safeParse(rawCourse);
    if (!parsedCourse.success) {
      warnings.push(`Skipping invalid course ${courseEntry.name}`);
      continue;
    }

    const course = parsedCourse.data;
    const courseRow = await prisma.course.upsert({
      where: { domainId: course.courseId },
      create: {
        domainId: course.courseId,
        legacyCourseKey: course.courseId,
        title: course.title,
        status: toPrismaCourseStatus('active'),
        createdAt: toDate(course.createdAt),
        updatedAt: toDate(course.updatedAt),
      },
      update: {
        legacyCourseKey: course.courseId,
        title: course.title,
        status: toPrismaCourseStatus('active'),
        updatedAt: toDate(course.updatedAt),
      },
    });
    summary.importedCourses += 1;

    const lectureEntries = await readDirEntries(
      path.join(dataDir, 'courses', courseEntry.name, 'lectures')
    );
    for (const lectureEntry of lectureEntries) {
      if (!lectureEntry.isDirectory()) {
        continue;
      }

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
        warnings.push(`Skipping invalid lecture ${course.courseId}/${lectureEntry.name}`);
        continue;
      }

      const lecture = parsedLecture.data;
      const absolutePath = resolveStoredPath(dataDir, lecture.assetPath);
      const asset = await upsertStoredAsset(prisma, {
        assetKey: getLectureAssetKey(course.courseId, lecture.lectureId),
        logicalBucket: 'course_lectures',
        absolutePath,
        originalName: path.basename(absolutePath),
      });

      await prisma.courseMaterial.upsert({
        where: {
          domainId: getLectureMaterialDomainId(course.courseId, lecture.lectureId),
        },
        create: {
          domainId: getLectureMaterialDomainId(course.courseId, lecture.lectureId),
          courseId: courseRow.id,
          assetId: asset.id,
          kind: toPrismaCourseMaterialKind('lecture_asset'),
          title: lecture.title,
          createdAt: toDate(lecture.createdAt),
          updatedAt: toDate(lecture.updatedAt),
        },
        update: {
          courseId: courseRow.id,
          assetId: asset.id,
          kind: toPrismaCourseMaterialKind('lecture_asset'),
          title: lecture.title,
          updatedAt: toDate(lecture.updatedAt),
        },
      });
      summary.importedLectureAssets += 1;
    }
  }

  const jobsById = await loadLegacyJobs(dataDir, warnings);
  const reviewEntries = await readDirEntries(path.join(dataDir, 'reviews'));

  for (const reviewEntry of reviewEntries) {
    if (!reviewEntry.isFile() || !reviewEntry.name.endsWith('.json')) {
      continue;
    }

    const rawReview = await readJsonFile(path.join(dataDir, 'reviews', reviewEntry.name));
    const parsedReview = ReviewRecordSchema.safeParse(rawReview);
    if (!parsedReview.success) {
      warnings.push(`Skipping invalid review ${reviewEntry.name}`);
      continue;
    }

    const reviewRecord = parsedReview.data;
    const job = jobsById.get(reviewRecord.jobId);
    if (!job) {
      warnings.push(`Skipping review without matching job: ${reviewRecord.jobId}`);
      continue;
    }

    const courseDomainId = getCourseDomainIdForLegacyJob(job.inputs?.courseId);
    const courseRow =
      courseDomainId === PLACEHOLDER_COURSE_DOMAIN_ID
        ? await prisma.course.findUniqueOrThrow({
            where: { domainId: PLACEHOLDER_COURSE_DOMAIN_ID },
          })
        : await prisma.course.upsert({
            where: { domainId: courseDomainId },
            create: {
              domainId: courseDomainId,
              legacyCourseKey: job.inputs?.courseId ?? null,
              title: `Imported course ${courseDomainId}`,
              status: toPrismaCourseStatus('active'),
            },
            update: {
              legacyCourseKey: job.inputs?.courseId ?? null,
            },
          });

    if (!job.inputs?.submissionFilePath) {
      warnings.push(`Skipping review without submission file path: ${reviewRecord.jobId}`);
      continue;
    }

    const submissionAsset = await upsertStoredAsset(prisma, {
      assetKey: getSubmissionAssetKey(job.id),
      logicalBucket: 'job_submissions',
      absolutePath: resolveStoredPath(dataDir, job.inputs.submissionFilePath),
      mimeType: job.inputs.submissionMimeType,
      originalName: path.basename(job.inputs.submissionFilePath),
    });

    const submissionMaterial = await prisma.courseMaterial.upsert({
      where: { domainId: getSubmissionMaterialDomainId(job.id) },
      create: {
        domainId: getSubmissionMaterialDomainId(job.id),
        courseId: courseRow.id,
        assetId: submissionAsset.id,
        kind: toPrismaCourseMaterialKind('submission_pdf'),
        title: reviewRecord.displayName ?? path.basename(job.inputs.submissionFilePath),
        createdAt: toDate(reviewRecord.createdAt),
        updatedAt: toDate(reviewRecord.updatedAt),
      },
      update: {
        courseId: courseRow.id,
        assetId: submissionAsset.id,
        kind: toPrismaCourseMaterialKind('submission_pdf'),
        title: reviewRecord.displayName ?? path.basename(job.inputs.submissionFilePath),
        updatedAt: toDate(reviewRecord.updatedAt),
      },
    });

    const envelope = createLegacyReviewResultEnvelope(reviewRecord, job.resultJson);
    const hasPublishedResult =
      typeof envelope.score === 'number' &&
      typeof envelope.maxScore === 'number' &&
      typeof envelope.summary === 'string' &&
      envelope.summary.trim().length > 0;

    const submission = await prisma.submission.upsert({
      where: { domainId: getSubmissionDomainId(job.id) },
      create: {
        domainId: getSubmissionDomainId(job.id),
        courseId: courseRow.id,
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
      update: {
        courseId: courseRow.id,
        materialId: submissionMaterial.id,
        state: toPrismaSubmissionState(
          deriveSubmissionStateFromLegacy(job, reviewRecord, hasPublishedResult)
        ),
        updatedAt: toDate(job.updatedAt ?? reviewRecord.updatedAt),
      },
    });
    summary.importedSubmissions += 1;

    const importedVersionDomainId = getImportedReviewVersionDomainId(job.id);

    await prisma.$transaction(async (tx) => {
      const importedVersion = await tx.reviewVersion.upsert({
        where: { domainId: importedVersionDomainId },
        create: {
          domainId: importedVersionDomainId,
          reviewId:
            (
              await tx.review.upsert({
                where: { domainId: getReviewDomainId(job.id) },
                create: {
                  domainId: getReviewDomainId(job.id),
                  courseId: courseRow.id,
                  submissionId: submission.id,
                  state: toPrismaReviewState(
                    deriveReviewStateFromLegacy(reviewRecord, hasPublishedResult)
                  ),
                  createdAt: toDate(reviewRecord.createdAt),
                  updatedAt: toDate(reviewRecord.updatedAt),
                },
                update: {
                  courseId: courseRow.id,
                  submissionId: submission.id,
                  updatedAt: toDate(reviewRecord.updatedAt),
                },
                select: { id: true },
              })
            ).id,
          kind: toPrismaReviewVersionKind(reviewVersionKindFromReviewRecord(reviewRecord)),
          actorKind: actorKindFromReviewRecord(reviewRecord),
          actorRefRaw:
            reviewVersionKindFromReviewRecord(reviewRecord) === 'lecturer_edit'
              ? 'legacy-human'
              : 'legacy-ai',
          score: typeof envelope.score === 'number' ? toPrismaDecimal(envelope.score) : null,
          maxScore:
            typeof envelope.maxScore === 'number' ? toPrismaDecimal(envelope.maxScore) : null,
          summary: envelope.summary ?? null,
          questionBreakdown: asJsonValue(envelope.questionBreakdown ?? null),
          rawPayload: asJsonValue(reviewRecord),
          createdAt: toDate(reviewRecord.updatedAt),
        },
        update: {
          kind: toPrismaReviewVersionKind(reviewVersionKindFromReviewRecord(reviewRecord)),
          actorKind: actorKindFromReviewRecord(reviewRecord),
          actorRefRaw:
            reviewVersionKindFromReviewRecord(reviewRecord) === 'lecturer_edit'
              ? 'legacy-human'
              : 'legacy-ai',
          score: typeof envelope.score === 'number' ? toPrismaDecimal(envelope.score) : null,
          maxScore:
            typeof envelope.maxScore === 'number' ? toPrismaDecimal(envelope.maxScore) : null,
          summary: envelope.summary ?? null,
          questionBreakdown: asJsonValue(envelope.questionBreakdown ?? null),
          rawPayload: asJsonValue(reviewRecord),
          createdAt: toDate(reviewRecord.updatedAt),
        },
      });

      const reviewRow = await tx.review.findUniqueOrThrow({
        where: { domainId: getReviewDomainId(job.id) },
        select: { id: true, currentVersionId: true },
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

      const publishedResult = await tx.publishedResult.upsert({
        where: { domainId: getPublishedResultDomainId(job.id) },
        create: {
          domainId: getPublishedResultDomainId(job.id),
          courseId: courseRow.id,
          submissionId: submission.id,
          studentUserId: null,
          moduleType: 'LEGACY_JOB',
          reviewId: reviewRow.id,
          sourceReviewVersionId: importedVersion.id,
          publishedAt: toDate(job.updatedAt ?? reviewRecord.updatedAt),
          status: toPrismaPublishedResultStatus('effective'),
          finalScore: toPrismaDecimal(envelope.score),
          maxScore: toPrismaDecimal(envelope.maxScore),
          summary: envelope.summary ?? 'Imported legacy result',
          breakdownSnapshot: asJsonValue(envelope.questionBreakdown ?? null),
        },
        update: {
          courseId: courseRow.id,
          submissionId: submission.id,
          reviewId: reviewRow.id,
          sourceReviewVersionId: importedVersion.id,
          publishedAt: toDate(job.updatedAt ?? reviewRecord.updatedAt),
          status: toPrismaPublishedResultStatus('effective'),
          finalScore: toPrismaDecimal(envelope.score),
          maxScore: toPrismaDecimal(envelope.maxScore),
          summary: envelope.summary ?? 'Imported legacy result',
          breakdownSnapshot: asJsonValue(envelope.questionBreakdown ?? null),
        },
      });

      await tx.gradebookEntry.upsert({
        where: { domainId: getGradebookEntryDomainId(job.id) },
        create: {
          domainId: getGradebookEntryDomainId(job.id),
          courseId: courseRow.id,
          studentUserId: null,
          moduleType: 'LEGACY_JOB',
          publishedResultId: publishedResult.id,
          score: toPrismaDecimal(envelope.score),
          maxScore: toPrismaDecimal(envelope.maxScore),
          status: toPrismaGradebookEntryStatus('effective'),
          publishedAt: toDate(job.updatedAt ?? reviewRecord.updatedAt),
        },
        update: {
          courseId: courseRow.id,
          publishedResultId: publishedResult.id,
          score: toPrismaDecimal(envelope.score),
          maxScore: toPrismaDecimal(envelope.maxScore),
          status: toPrismaGradebookEntryStatus('effective'),
          publishedAt: toDate(job.updatedAt ?? reviewRecord.updatedAt),
        },
      });

      const submissionRow = await tx.submission.findUniqueOrThrow({
        where: { id: submission.id },
        select: { currentPublishedResultId: true },
      });

      if (
        !submissionRow.currentPublishedResultId ||
        submissionRow.currentPublishedResultId === publishedResult.id
      ) {
        await tx.submission.update({
          where: { id: submission.id },
          data: { currentPublishedResultId: publishedResult.id },
        });
      }
    });

    summary.importedReviews += 1;
    if (hasPublishedResult) {
      summary.importedPublishedResults += 1;
    }
  }

  logger.log(
    `[postgres-store] import summary courses=${summary.importedCourses} lectures=${summary.importedLectureAssets} submissions=${summary.importedSubmissions} reviews=${summary.importedReviews} published=${summary.importedPublishedResults}`
  );

  return summary;
};
