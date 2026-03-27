import type { GradebookEntry, PublicationRepository, PublishedResult } from '@hg/domain-workflow';
import type { PrismaClient } from '@prisma/client';
import {
  decimalToNumber,
  fromPrismaGradebookEntryStatus,
  fromPrismaPublishedResultStatus,
  moduleRefToStoredFields,
  storedFieldsToModuleRef,
  studentRefFromStoredValues,
  studentUserIdFromStudentRef,
  toDate,
  toIsoString,
  toPrismaDecimal,
  toPrismaGradebookEntryStatus,
  toPrismaPublishedResultStatus,
} from '../mappers/domain';
import {
  requireCourseRow,
  requirePublishedResultRow,
  requireReviewRow,
  requireReviewVersionRow,
  requireSubmissionRow,
} from './shared';

export class PrismaPublicationRepository implements PublicationRepository {
  constructor(
    private readonly prisma: Pick<
      PrismaClient,
      'course' | 'submission' | 'review' | 'reviewVersion' | 'publishedResult' | 'gradebookEntry'
    >
  ) {}

  async getPublishedResultsBySubmission(submissionId: string): Promise<PublishedResult[]> {
    const rows = await this.prisma.publishedResult.findMany({
      where: { submission: { domainId: submissionId } },
      orderBy: { publishedAt: 'desc' },
      include: {
        course: { select: { domainId: true } },
        submission: { select: { domainId: true, legacyJobId: true } },
        review: { select: { domainId: true } },
        sourceReviewVersion: { select: { domainId: true } },
      },
    });

    return rows.map((row) => ({
      publishedResultId: row.domainId,
      courseId: row.course.domainId,
      submissionId: row.submission.domainId,
      studentRef: studentRefFromStoredValues(row.studentUserId, row.submission.domainId),
      moduleRef: storedFieldsToModuleRef(
        row.moduleType,
        row.assignmentId,
        row.examBatchId,
        row.submission.legacyJobId
      ),
      reviewId: row.review.domainId,
      sourceReviewVersionId: row.sourceReviewVersion.domainId,
      publishedAt: toIsoString(row.publishedAt),
      status: fromPrismaPublishedResultStatus(row.status),
      finalScore: decimalToNumber(row.finalScore) ?? 0,
      maxScore: decimalToNumber(row.maxScore) ?? 0,
      summary: row.summary,
      breakdownSnapshot: row.breakdownSnapshot,
    }));
  }

  async savePublishedResult(publishedResult: PublishedResult): Promise<void> {
    const [course, submission, review, sourceReviewVersion] = await Promise.all([
      requireCourseRow(this.prisma, publishedResult.courseId),
      requireSubmissionRow(this.prisma, publishedResult.submissionId),
      requireReviewRow(this.prisma, publishedResult.reviewId),
      requireReviewVersionRow(this.prisma, publishedResult.sourceReviewVersionId),
    ]);
    const moduleFields = moduleRefToStoredFields(publishedResult.moduleRef);

    await this.prisma.publishedResult.upsert({
      where: { domainId: publishedResult.publishedResultId },
      create: {
        domainId: publishedResult.publishedResultId,
        courseId: course.id,
        submissionId: submission.id,
        studentUserId: studentUserIdFromStudentRef(publishedResult.studentRef),
        moduleType: moduleFields.moduleType,
        assignmentId: moduleFields.assignmentId,
        examBatchId: moduleFields.examBatchId,
        reviewId: review.id,
        sourceReviewVersionId: sourceReviewVersion.id,
        publishedAt: toDate(publishedResult.publishedAt),
        status: toPrismaPublishedResultStatus(publishedResult.status),
        finalScore: toPrismaDecimal(publishedResult.finalScore),
        maxScore: toPrismaDecimal(publishedResult.maxScore),
        summary: publishedResult.summary,
        breakdownSnapshot: publishedResult.breakdownSnapshot as never,
      },
      update: {
        courseId: course.id,
        submissionId: submission.id,
        studentUserId: studentUserIdFromStudentRef(publishedResult.studentRef),
        moduleType: moduleFields.moduleType,
        assignmentId: moduleFields.assignmentId,
        examBatchId: moduleFields.examBatchId,
        reviewId: review.id,
        sourceReviewVersionId: sourceReviewVersion.id,
        publishedAt: toDate(publishedResult.publishedAt),
        status: toPrismaPublishedResultStatus(publishedResult.status),
        finalScore: toPrismaDecimal(publishedResult.finalScore),
        maxScore: toPrismaDecimal(publishedResult.maxScore),
        summary: publishedResult.summary,
        breakdownSnapshot: publishedResult.breakdownSnapshot as never,
      },
    });
  }

  async markPublishedResultsSupersededForSubmission(submissionId: string): Promise<void> {
    const submission = await requireSubmissionRow(this.prisma, submissionId);

    await this.prisma.publishedResult.updateMany({
      where: { submissionId: submission.id, status: 'EFFECTIVE' },
      data: { status: 'SUPERSEDED' },
    });
  }

  async upsertGradebookEntry(entry: GradebookEntry): Promise<void> {
    const [course, publishedResult] = await Promise.all([
      requireCourseRow(this.prisma, entry.courseId),
      requirePublishedResultRow(this.prisma, entry.publishedResultId),
    ]);
    const moduleFields = moduleRefToStoredFields(entry.moduleRef);

    await this.prisma.gradebookEntry.upsert({
      where: { domainId: entry.gradebookEntryId },
      create: {
        domainId: entry.gradebookEntryId,
        courseId: course.id,
        studentUserId: studentUserIdFromStudentRef(entry.studentRef),
        moduleType: moduleFields.moduleType,
        assignmentId: moduleFields.assignmentId,
        examBatchId: moduleFields.examBatchId,
        publishedResultId: publishedResult.id,
        score: toPrismaDecimal(entry.score),
        maxScore: toPrismaDecimal(entry.maxScore),
        status: toPrismaGradebookEntryStatus(entry.status),
        publishedAt: toDate(entry.publishedAt),
      },
      update: {
        courseId: course.id,
        studentUserId: studentUserIdFromStudentRef(entry.studentRef),
        moduleType: moduleFields.moduleType,
        assignmentId: moduleFields.assignmentId,
        examBatchId: moduleFields.examBatchId,
        publishedResultId: publishedResult.id,
        score: toPrismaDecimal(entry.score),
        maxScore: toPrismaDecimal(entry.maxScore),
        status: toPrismaGradebookEntryStatus(entry.status),
        publishedAt: toDate(entry.publishedAt),
      },
    });
  }

  async getGradebookEntryByPublishedResultId(
    publishedResultId: string
  ): Promise<GradebookEntry | null> {
    const publishedResult = await this.prisma.publishedResult.findUnique({
      where: { domainId: publishedResultId },
      select: { id: true, submission: { select: { domainId: true, legacyJobId: true } } },
    });

    if (!publishedResult) {
      return null;
    }

    const row = await this.prisma.gradebookEntry.findUnique({
      where: { publishedResultId: publishedResult.id },
      include: {
        course: { select: { domainId: true } },
      },
    });

    if (!row) {
      return null;
    }

    return {
      gradebookEntryId: row.domainId,
      courseId: row.course.domainId,
      studentRef: studentRefFromStoredValues(row.studentUserId, publishedResult.submission.domainId),
      moduleRef: storedFieldsToModuleRef(
        row.moduleType,
        row.assignmentId,
        row.examBatchId,
        publishedResult.submission.legacyJobId
      ),
      publishedResultId,
      score: decimalToNumber(row.score) ?? 0,
      maxScore: decimalToNumber(row.maxScore) ?? 0,
      status: fromPrismaGradebookEntryStatus(row.status),
      publishedAt: toIsoString(row.publishedAt),
    };
  }
}
