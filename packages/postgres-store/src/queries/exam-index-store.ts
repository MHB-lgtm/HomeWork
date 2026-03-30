import type { ExamIndexStatus, PrismaClient } from '@prisma/client';
import { ExamIndexSchema, type ExamIndex } from '@hg/shared-schemas';
import { asJsonValue, toDate, toIsoString } from '../mappers/domain';

const toStoredStatus = (status: ExamIndex['status']): ExamIndexStatus =>
  status === 'confirmed' ? 'CONFIRMED' : 'PROPOSED';

const mapExamIndex = (payload: unknown): ExamIndex => ExamIndexSchema.parse(payload);

export class PrismaExamIndexStore {
  constructor(private readonly prisma: Pick<PrismaClient, 'exam' | 'examIndex'>) {}

  async getExamIndex(examId: string): Promise<ExamIndex | null> {
    const row = await this.prisma.examIndex.findFirst({
      where: {
        exam: {
          domainId: examId,
        },
      },
      select: {
        payloadJson: true,
      },
    });

    if (!row) {
      return null;
    }

    return mapExamIndex(row.payloadJson);
  }

  async saveExamIndex(examIndex: ExamIndex): Promise<ExamIndex> {
    const validated = ExamIndexSchema.parse(examIndex);
    const exam = await this.prisma.exam.findUnique({
      where: { domainId: validated.examId },
      select: { id: true },
    });

    if (!exam) {
      throw new Error(`Exam not found: ${validated.examId}`);
    }

    const existing = await this.prisma.examIndex.findUnique({
      where: { examRowId: exam.id },
      select: { id: true, generatedAt: true },
    });

    const normalized: ExamIndex = {
      ...validated,
      generatedAt: existing ? toIsoString(existing.generatedAt) : validated.generatedAt,
      updatedAt: validated.updatedAt,
    };

    const data = {
      examRowId: exam.id,
      status: toStoredStatus(normalized.status),
      generatedAt: toDate(normalized.generatedAt),
      updatedAt: toDate(normalized.updatedAt),
      payloadJson: asJsonValue(normalized),
    };

    if (existing) {
      await this.prisma.examIndex.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await this.prisma.examIndex.create({
        data,
      });
    }

    return normalized;
  }
}
