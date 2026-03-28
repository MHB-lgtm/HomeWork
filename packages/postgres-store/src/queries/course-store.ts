import type { Course } from '@hg/shared-schemas';
import { CourseSchema } from '@hg/shared-schemas';
import type { PrismaClient } from '@prisma/client';
import { PLACEHOLDER_COURSE_DOMAIN_ID } from '../mappers/import';
import { toIsoString } from '../mappers/domain';

const createCourseId = (): string =>
  `course-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

const mapCourseRow = (row: {
  domainId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}): Course =>
  CourseSchema.parse({
    version: '1.0.0',
    courseId: row.domainId,
    title: row.title,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  });

export class PrismaCourseStore {
  constructor(private readonly prisma: Pick<PrismaClient, 'course'>) {}

  async listCourses(): Promise<Course[]> {
    const rows = await this.prisma.course.findMany({
      where: {
        domainId: { not: PLACEHOLDER_COURSE_DOMAIN_ID },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return rows.map(mapCourseRow);
  }

  async getCourse(courseId: string): Promise<Course | null> {
    if (courseId === PLACEHOLDER_COURSE_DOMAIN_ID) {
      return null;
    }

    const row = await this.prisma.course.findUnique({
      where: { domainId: courseId },
      select: {
        domainId: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return row ? mapCourseRow(row) : null;
  }

  async createCourse(args: { title: string }): Promise<Course> {
    const title = args.title.trim();
    if (!title) {
      throw new Error('title is required');
    }

    const row = await this.prisma.course.create({
      data: {
        domainId: createCourseId(),
        legacyCourseKey: null,
        title,
        status: 'ACTIVE',
      },
      select: {
        domainId: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return mapCourseRow(row);
  }
}
