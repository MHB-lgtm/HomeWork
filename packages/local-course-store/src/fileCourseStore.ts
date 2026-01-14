import * as fs from 'fs/promises';
import * as path from 'path';
import { Course, CourseSchema } from '@hg/shared-schemas';
import { CourseNotFoundError, CreateCourseParams } from './types';

const getDataDir = (): string => {
  const dataDir = process.env.HG_DATA_DIR;
  if (!dataDir) {
    throw new Error('HG_DATA_DIR is not set in environment variables');
  }
  return path.resolve(dataDir);
};

let DATA_DIR: string | null = null;
let DATA_DIR_LOGGED = false;

export const getDataDirOnce = (): string => {
  if (!DATA_DIR) {
    DATA_DIR = getDataDir();
    if (!DATA_DIR_LOGGED) {
      console.log('[local-course-store] DATA_DIR:', DATA_DIR);
      DATA_DIR_LOGGED = true;
    }
  }
  return DATA_DIR;
};

const COURSES_DIR = () => path.join(getDataDirOnce(), 'courses');

export const resolveCourseDir = (courseId: string) => path.join(COURSES_DIR(), courseId);
export const resolveLectureDir = (courseId: string, lectureId: string) =>
  path.join(resolveCourseDir(courseId), 'lectures', lectureId);
export const resolveRagDir = (courseId: string) => path.join(resolveCourseDir(courseId), 'rag', 'v1');

const writeJsonAtomic = async (filePath: string, data: unknown): Promise<void> => {
  const tempFilePath = `${filePath}.tmp`;
  await fs.writeFile(tempFilePath, JSON.stringify(data, null, 2), 'utf-8');
  await fs.rename(tempFilePath, filePath);
};

const generateId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

export const ensureCourseDirs = async (courseId?: string): Promise<void> => {
  await fs.mkdir(COURSES_DIR(), { recursive: true });
  if (courseId) {
    await fs.mkdir(resolveCourseDir(courseId), { recursive: true });
    await fs.mkdir(path.join(resolveCourseDir(courseId), 'lectures'), { recursive: true });
    await fs.mkdir(resolveRagDir(courseId), { recursive: true });
  }
};

export const createCourse = async (params: CreateCourseParams): Promise<{ courseId: string }> => {
  const title = params.title.trim();
  if (!title) {
    throw new Error('title is required');
  }

  await ensureCourseDirs();

  const courseId = generateId('course');
  const now = new Date().toISOString();
  const course: Course = CourseSchema.parse({
    version: '1.0.0',
    courseId,
    title,
    createdAt: now,
    updatedAt: now,
  });

  const courseDir = resolveCourseDir(courseId);
  await fs.mkdir(courseDir, { recursive: true });

  const courseFilePath = path.join(courseDir, 'course.json');
  await writeJsonAtomic(courseFilePath, course);

  console.log(`[courses] created courseId=${courseId} title=${title}`);

  return { courseId };
};

export const getCourse = async (courseId: string): Promise<Course> => {
  const courseFilePath = path.join(resolveCourseDir(courseId), 'course.json');
  try {
    const content = await fs.readFile(courseFilePath, 'utf-8');
    const parsed = JSON.parse(content);
    return CourseSchema.parse(parsed);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new CourseNotFoundError(courseId);
    }
    throw error;
  }
};

export const listCourses = async (): Promise<Course[]> => {
  try {
    const courseDirs = await fs.readdir(COURSES_DIR(), { withFileTypes: true });
    const courses: Course[] = [];

    for (const entry of courseDirs) {
      if (!entry.isDirectory()) continue;
      const courseId = entry.name;
      const courseFilePath = path.join(resolveCourseDir(courseId), 'course.json');

      try {
        const content = await fs.readFile(courseFilePath, 'utf-8');
        const parsed = JSON.parse(content);
        const course = CourseSchema.parse(parsed);
        courses.push(course);
      } catch (error) {
        // Skip invalid or unreadable courses
        continue;
      }
    }

    courses.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return courses;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
};
