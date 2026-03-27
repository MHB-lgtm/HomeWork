import type { Course, CourseRepository } from '@hg/domain-workflow';
import type { PrismaClient } from '@prisma/client';
import { fromPrismaCourseStatus, toIsoString } from '../mappers/domain';

export class PrismaCourseRepository implements CourseRepository {
  constructor(private readonly prisma: Pick<PrismaClient, 'course'>) {}

  async getCourse(courseId: string): Promise<Course | null> {
    const row = await this.prisma.course.findUnique({
      where: { domainId: courseId },
    });

    if (!row) {
      return null;
    }

    return {
      courseId: row.domainId,
      title: row.title,
      status: fromPrismaCourseStatus(row.status),
      createdAt: toIsoString(row.createdAt),
      updatedAt: toIsoString(row.updatedAt),
    };
  }

  async listCourses(): Promise<Course[]> {
    const rows = await this.prisma.course.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => ({
      courseId: row.domainId,
      title: row.title,
      status: fromPrismaCourseStatus(row.status),
      createdAt: toIsoString(row.createdAt),
      updatedAt: toIsoString(row.updatedAt),
    }));
  }
}
