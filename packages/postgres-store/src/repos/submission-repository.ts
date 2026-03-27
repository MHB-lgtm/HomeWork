import type { Submission, SubmissionRepository } from '@hg/domain-workflow';
import { getModuleRefKey } from '@hg/domain-workflow';
import type { PrismaClient } from '@prisma/client';
import {
  fromPrismaSubmissionState,
  moduleRefToStoredFields,
  storedFieldsToModuleRef,
  studentRefFromStoredValues,
  studentUserIdFromStudentRef,
  toDate,
  toIsoString,
  toPrismaSubmissionState,
} from '../mappers/domain';
import { requireCourseMaterialRow, requireCourseRow } from './shared';

export class PrismaSubmissionRepository implements SubmissionRepository {
  constructor(
    private readonly prisma: Pick<PrismaClient, 'course' | 'courseMaterial' | 'submission'>
  ) {}

  async getSubmission(submissionId: string): Promise<Submission | null> {
    const row = await this.prisma.submission.findUnique({
      where: { domainId: submissionId },
      include: {
        course: { select: { domainId: true } },
        material: { select: { domainId: true } },
      },
    });

    if (!row) {
      return null;
    }

    return {
      submissionId: row.domainId,
      courseId: row.course.domainId,
      moduleRef: storedFieldsToModuleRef(
        row.moduleType,
        row.assignmentId,
        row.examBatchId,
        row.legacyJobId
      ),
      studentRef: studentRefFromStoredValues(row.studentUserId, row.domainId),
      materialId: row.material.domainId,
      submittedAt: toIsoString(row.submittedAt),
      supersedesSubmissionId: undefined,
      state: fromPrismaSubmissionState(row.state),
    };
  }

  async listSubmissionsForStudentModule(
    studentRef: string,
    moduleRefKey: string
  ): Promise<Submission[]> {
    const studentUserId = studentUserIdFromStudentRef(studentRef);
    const rows = await this.prisma.submission.findMany({
      where: studentUserId ? { studentUserId } : { studentUserId: null },
      include: {
        course: { select: { domainId: true } },
        material: { select: { domainId: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });

    return rows
      .map((row) => ({
        submissionId: row.domainId,
        courseId: row.course.domainId,
        moduleRef: storedFieldsToModuleRef(
          row.moduleType,
          row.assignmentId,
          row.examBatchId,
          row.legacyJobId
        ),
        studentRef: studentRefFromStoredValues(row.studentUserId, row.domainId),
        materialId: row.material.domainId,
        submittedAt: toIsoString(row.submittedAt),
        supersedesSubmissionId: undefined,
        state: fromPrismaSubmissionState(row.state),
      }))
      .filter((submission) => submission.studentRef === studentRef)
      .filter((submission) => getModuleRefKey(submission.moduleRef) === moduleRefKey);
  }

  async saveSubmission(submission: Submission): Promise<void> {
    const [course, material] = await Promise.all([
      requireCourseRow(this.prisma, submission.courseId),
      requireCourseMaterialRow(this.prisma, submission.materialId),
    ]);
    const moduleFields = moduleRefToStoredFields(submission.moduleRef);

    await this.prisma.submission.upsert({
      where: { domainId: submission.submissionId },
      create: {
        domainId: submission.submissionId,
        courseId: course.id,
        studentUserId: studentUserIdFromStudentRef(submission.studentRef),
        moduleType: moduleFields.moduleType,
        assignmentId: moduleFields.assignmentId,
        examBatchId: moduleFields.examBatchId,
        legacyJobId:
          submission.moduleRef.kind === 'legacy_job' ? submission.moduleRef.legacyJobId : null,
        materialId: material.id,
        submittedAt: toDate(submission.submittedAt),
        state: toPrismaSubmissionState(submission.state),
      },
      update: {
        courseId: course.id,
        studentUserId: studentUserIdFromStudentRef(submission.studentRef),
        moduleType: moduleFields.moduleType,
        assignmentId: moduleFields.assignmentId,
        examBatchId: moduleFields.examBatchId,
        legacyJobId:
          submission.moduleRef.kind === 'legacy_job' ? submission.moduleRef.legacyJobId : null,
        materialId: material.id,
        submittedAt: toDate(submission.submittedAt),
        state: toPrismaSubmissionState(submission.state),
      },
    });
  }

  async markSuperseded(submissionId: string): Promise<void> {
    await this.prisma.submission.update({
      where: { domainId: submissionId },
      data: { state: toPrismaSubmissionState('superseded') },
    });
  }
}
