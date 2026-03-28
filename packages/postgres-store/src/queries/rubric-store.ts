import type { PrismaClient } from '@prisma/client';
import { RubricSpecSchema, type RubricSpec } from '@hg/shared-schemas';
import { asJsonValue } from '../mappers/domain';

const examNotFoundError = (examId: string) => new Error(`Exam not found: ${examId}`);

export class PrismaRubricStore {
  constructor(private readonly prisma: Pick<PrismaClient, 'exam' | 'rubric'>) {}

  async listRubricQuestionIds(examId: string): Promise<string[]> {
    const exam = await this.prisma.exam.findUnique({
      where: { domainId: examId },
      select: { id: true },
    });

    if (!exam) {
      return [];
    }

    const rows = await this.prisma.rubric.findMany({
      where: { examRowId: exam.id },
      select: { questionId: true },
      orderBy: { questionId: 'asc' },
    });

    return rows.map((row) => row.questionId);
  }

  async getRubric(examId: string, questionId: string): Promise<RubricSpec | null> {
    const row = await this.prisma.rubric.findFirst({
      where: {
        questionId,
        exam: {
          domainId: examId,
        },
      },
      select: {
        rawPayload: true,
      },
    });

    if (!row) {
      return null;
    }

    return RubricSpecSchema.parse(row.rawPayload);
  }

  async saveRubric(rubric: RubricSpec): Promise<RubricSpec> {
    const validated = RubricSpecSchema.parse(rubric);
    const exam = await this.prisma.exam.findUnique({
      where: { domainId: validated.examId },
      select: { id: true },
    });

    if (!exam) {
      throw examNotFoundError(validated.examId);
    }

    const existing = await this.prisma.rubric.findUnique({
      where: {
        examRowId_questionId: {
          examRowId: exam.id,
          questionId: validated.questionId,
        },
      },
      select: { id: true },
    });

    const data = {
      examRowId: exam.id,
      questionId: validated.questionId,
      title: validated.title ?? null,
      generalGuidance: validated.generalGuidance ?? null,
      criteriaJson: asJsonValue(validated.criteria),
      rawPayload: asJsonValue(validated),
    };

    if (existing) {
      await this.prisma.rubric.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await this.prisma.rubric.create({
        data,
      });
    }

    return validated;
  }
}
