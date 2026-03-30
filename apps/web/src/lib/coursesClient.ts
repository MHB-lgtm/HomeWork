import {
  CourseSchema,
  LectureSchema,
  RagManifestSchema,
  RagQueryResponseV1Schema,
  SuggestResponseV1Schema,
} from '@hg/shared-schemas';
import type { Course, Lecture, RagManifest, ChunkHitV1, StudyPointerV1 } from '@hg/shared-schemas';

type ApiErrorPayload = {
  error?: string;
  code?: string;
};

export class CoursesClientError extends Error {
  code?: string;
  status?: number;

  constructor(message: string, options?: { code?: string; status?: number }) {
    super(message);
    this.name = 'CoursesClientError';
    this.code = options?.code;
    this.status = options?.status;
  }
}

export type CourseMembershipRole = 'COURSE_ADMIN' | 'LECTURER' | 'STUDENT';
export type CourseMembershipStatus = 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'REMOVED';

export type CourseMembershipRecord = {
  membershipId: string;
  courseId: string;
  courseTitle: string;
  userId: string;
  normalizedEmail: string | null;
  displayName: string | null;
  role: CourseMembershipRole;
  status: CourseMembershipStatus;
  joinedAt: string | null;
  invitedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

const parseErrorPayload = async (response: Response, fallback: string) => {
  const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
  const message = payload?.error && typeof payload.error === 'string' ? payload.error : fallback;
  const code = payload?.code && typeof payload.code === 'string' ? payload.code : undefined;
  return { message, code };
};

const parseCourseList = (data: unknown): Course[] => {
  const result = CourseSchema.array().safeParse(data);
  if (!result.success) {
    throw new CoursesClientError('Invalid course data');
  }
  return result.data;
};

const parseCourse = (data: unknown): Course => {
  const result = CourseSchema.safeParse(data);
  if (!result.success) {
    throw new CoursesClientError('Invalid course data');
  }
  return result.data;
};

const parseRagManifest = (data: unknown): RagManifest => {
  const result = RagManifestSchema.safeParse(data);
  if (!result.success) {
    throw new CoursesClientError('Invalid manifest data');
  }
  return result.data;
};

const parseLectureList = (data: unknown): Lecture[] => {
  const result = LectureSchema.array().safeParse(data);
  if (!result.success) {
    throw new CoursesClientError('Invalid lecture data');
  }
  const lectures = result.data;
  return [...lectures].sort((a, b) => {
    const aTime = Date.parse(a.createdAt);
    const bTime = Date.parse(b.createdAt);
    if (!Number.isNaN(aTime) && !Number.isNaN(bTime) && aTime !== bTime) {
      return bTime - aTime;
    }
    return a.lectureId.localeCompare(b.lectureId);
  });
};

const parseCourseMembershipList = (data: unknown): CourseMembershipRecord[] => {
  if (!Array.isArray(data)) {
    throw new CoursesClientError('Invalid membership data');
  }

  return data.map((entry) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new CoursesClientError('Invalid membership data');
    }

    const record = entry as Record<string, unknown>;
    const role = record.role;
    const status = record.status;
    if (
      typeof record.membershipId !== 'string' ||
      typeof record.courseId !== 'string' ||
      typeof record.courseTitle !== 'string' ||
      typeof record.userId !== 'string' ||
      (record.normalizedEmail !== null && typeof record.normalizedEmail !== 'string') ||
      (record.displayName !== null && typeof record.displayName !== 'string') ||
      (record.joinedAt !== null && typeof record.joinedAt !== 'string') ||
      (record.invitedByUserId !== null && typeof record.invitedByUserId !== 'string') ||
      typeof record.createdAt !== 'string' ||
      typeof record.updatedAt !== 'string' ||
      !['COURSE_ADMIN', 'LECTURER', 'STUDENT'].includes(String(role)) ||
      !['INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED'].includes(String(status))
    ) {
      throw new CoursesClientError('Invalid membership data');
    }

    return {
      membershipId: record.membershipId,
      courseId: record.courseId,
      courseTitle: record.courseTitle,
      userId: record.userId,
      normalizedEmail: (record.normalizedEmail as string | null) ?? null,
      displayName: (record.displayName as string | null) ?? null,
      role: role as CourseMembershipRole,
      status: status as CourseMembershipStatus,
      joinedAt: (record.joinedAt as string | null) ?? null,
      invitedByUserId: (record.invitedByUserId as string | null) ?? null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    } satisfies CourseMembershipRecord;
  });
};

const parseRagQueryResponse = (data: unknown): ChunkHitV1[] => {
  const result = RagQueryResponseV1Schema.safeParse(data);
  if (!result.success) {
    throw new CoursesClientError('Invalid query response');
  }
  return result.data.data.hits;
};

const parseSuggestResponse = (data: unknown): StudyPointerV1[] => {
  const result = SuggestResponseV1Schema.safeParse(data);
  if (!result.success) {
    throw new CoursesClientError('Invalid suggest response');
  }
  return result.data.data.pointers;
};

export async function listCourses(): Promise<Course[]> {
  try {
    const response = await fetch('/api/courses');

    if (!response.ok) {
      const { message, code } = await parseErrorPayload(response, 'Failed to load courses');
      throw new CoursesClientError(message, { code, status: response.status });
    }

    const payload = await response.json().catch(() => null);
    if (!payload || payload.ok !== true) {
      throw new CoursesClientError('Failed to load courses');
    }

    return parseCourseList(payload.data);
  } catch (error) {
    if (error instanceof CoursesClientError) {
      throw error;
    }
    throw new CoursesClientError(error instanceof Error ? error.message : 'Failed to load courses');
  }
}

export async function getCourse(courseId: string): Promise<Course> {
  try {
    const response = await fetch(`/api/courses/${courseId}`);

    if (!response.ok) {
      const { message, code } = await parseErrorPayload(response, 'Failed to load course');
      throw new CoursesClientError(message, { code, status: response.status });
    }

    const payload = await response.json().catch(() => null);
    if (!payload || payload.ok !== true) {
      throw new CoursesClientError('Failed to load course');
    }

    return parseCourse(payload.data);
  } catch (error) {
    if (error instanceof CoursesClientError) {
      throw error;
    }
    throw new CoursesClientError(error instanceof Error ? error.message : 'Failed to load course');
  }
}

export async function createCourse(title: string): Promise<{ courseId: string }> {
  try {
    const response = await fetch('/api/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });

    if (!response.ok) {
      const { message, code } = await parseErrorPayload(response, 'Failed to create course');
      throw new CoursesClientError(message, { code, status: response.status });
    }

    const payload = await response.json().catch(() => null);
    if (!payload || payload.ok !== true || typeof payload.data?.courseId !== 'string') {
      throw new CoursesClientError('Failed to create course');
    }

    return { courseId: payload.data.courseId as string };
  } catch (error) {
    if (error instanceof CoursesClientError) {
      throw error;
    }
    throw new CoursesClientError(error instanceof Error ? error.message : 'Failed to create course');
  }
}

export async function listLectures(courseId: string): Promise<Lecture[]> {
  try {
    const response = await fetch(`/api/courses/${courseId}/lectures`);

    if (!response.ok) {
      const { message, code } = await parseErrorPayload(response, 'Failed to load lectures');
      throw new CoursesClientError(message, { code, status: response.status });
    }

    const payload = await response.json().catch(() => null);
    if (!payload || payload.ok !== true) {
      throw new CoursesClientError('Failed to load lectures');
    }

    return parseLectureList(payload.data);
  } catch (error) {
    if (error instanceof CoursesClientError) {
      throw error;
    }
    throw new CoursesClientError(error instanceof Error ? error.message : 'Failed to load lectures');
  }
}

export async function uploadLecture(
  courseId: string,
  args: { title: string; file: File; externalUrl?: string }
): Promise<{ lectureId: string }> {
  try {
    const formData = new FormData();
    formData.append('title', args.title);
    formData.append('file', args.file);
    if (args.externalUrl) {
      formData.append('externalUrl', args.externalUrl);
    }

    const response = await fetch(`/api/courses/${courseId}/lectures`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const { message, code } = await parseErrorPayload(response, 'Failed to upload lecture');
      throw new CoursesClientError(message, { code, status: response.status });
    }

    const payload = await response.json().catch(() => null);
    if (!payload || payload.ok !== true || typeof payload.data?.lectureId !== 'string') {
      throw new CoursesClientError('Failed to upload lecture');
    }

    return { lectureId: payload.data.lectureId as string };
  } catch (error) {
    if (error instanceof CoursesClientError) {
      throw error;
    }
    throw new CoursesClientError(error instanceof Error ? error.message : 'Failed to upload lecture');
  }
}

export async function getRagManifest(courseId: string): Promise<RagManifest | null> {
  try {
    const response = await fetch(`/api/courses/${courseId}/rag/manifest`);

    if (!response.ok) {
      const { message, code } = await parseErrorPayload(response, 'Failed to load RAG manifest');
      if (response.status === 404 && code === 'MANIFEST_NOT_FOUND') {
        return null;
      }
      throw new CoursesClientError(message, { code, status: response.status });
    }

    const payload = await response.json().catch(() => null);
    if (!payload || payload.ok !== true) {
      throw new CoursesClientError('Failed to load RAG manifest');
    }

    return parseRagManifest(payload.data);
  } catch (error) {
    if (error instanceof CoursesClientError) {
      throw error;
    }
    throw new CoursesClientError(error instanceof Error ? error.message : 'Failed to load RAG manifest');
  }
}

export async function rebuildRagIndex(courseId: string): Promise<{
  builtAt: string;
  lectureCount: number;
  chunkCount: number;
}> {
  try {
    const response = await fetch(`/api/courses/${courseId}/rag/rebuild`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const { message, code } = await parseErrorPayload(response, 'Failed to rebuild RAG index');
      throw new CoursesClientError(message, { code, status: response.status });
    }

    const payload = await response.json().catch(() => null);
    if (
      !payload ||
      payload.ok !== true ||
      typeof payload.data?.builtAt !== 'string' ||
      typeof payload.data?.lectureCount !== 'number' ||
      typeof payload.data?.chunkCount !== 'number'
    ) {
      throw new CoursesClientError('Failed to rebuild RAG index');
    }

    return {
      builtAt: payload.data.builtAt as string,
      lectureCount: payload.data.lectureCount as number,
      chunkCount: payload.data.chunkCount as number,
    };
  } catch (error) {
    if (error instanceof CoursesClientError) {
      throw error;
    }
    throw new CoursesClientError(error instanceof Error ? error.message : 'Failed to rebuild RAG index');
  }
}

export async function ragQuery(
  courseId: string,
  args: { query: string; k?: number }
): Promise<{ hits: ChunkHitV1[] }> {
  try {
    const response = await fetch(`/api/courses/${courseId}/rag/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: args.query, k: args.k }),
    });

    if (!response.ok) {
      const { message, code } = await parseErrorPayload(response, 'Failed to run query');
      throw new CoursesClientError(message, { code, status: response.status });
    }

    const payload = await response.json().catch(() => null);
    if (!payload) {
      throw new CoursesClientError('Failed to run query');
    }

    return { hits: parseRagQueryResponse(payload) };
  } catch (error) {
    if (error instanceof CoursesClientError) {
      throw error;
    }
    throw new CoursesClientError(error instanceof Error ? error.message : 'Failed to run query');
  }
}

export async function ragSuggest(
  courseId: string,
  args: { issueText: string; k?: number }
): Promise<{ pointers: StudyPointerV1[] }> {
  try {
    const response = await fetch(`/api/courses/${courseId}/rag/suggest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issueText: args.issueText, k: args.k }),
    });

    if (!response.ok) {
      const { message, code } = await parseErrorPayload(response, 'Failed to run suggest');
      throw new CoursesClientError(message, { code, status: response.status });
    }

    const payload = await response.json().catch(() => null);
    if (!payload) {
      throw new CoursesClientError('Failed to run suggest');
    }

    return { pointers: parseSuggestResponse(payload) };
  } catch (error) {
    if (error instanceof CoursesClientError) {
      throw error;
    }
    throw new CoursesClientError(error instanceof Error ? error.message : 'Failed to run suggest');
  }
}

export async function listCourseMemberships(courseId: string): Promise<CourseMembershipRecord[]> {
  try {
    const response = await fetch(`/api/courses/${courseId}/memberships`);

    if (!response.ok) {
      const { message, code } = await parseErrorPayload(response, 'Failed to load memberships');
      throw new CoursesClientError(message, { code, status: response.status });
    }

    const payload = await response.json().catch(() => null);
    if (!payload || payload.ok !== true) {
      throw new CoursesClientError('Failed to load memberships');
    }

    return parseCourseMembershipList(payload.data);
  } catch (error) {
    if (error instanceof CoursesClientError) {
      throw error;
    }
    throw new CoursesClientError(error instanceof Error ? error.message : 'Failed to load memberships');
  }
}

export async function upsertCourseMembership(
  courseId: string,
  args: {
    email: string;
    displayName?: string | null;
    role: CourseMembershipRole;
    status: CourseMembershipStatus;
  }
): Promise<CourseMembershipRecord> {
  try {
    const response = await fetch(`/api/courses/${courseId}/memberships`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });

    if (!response.ok) {
      const { message, code } = await parseErrorPayload(response, 'Failed to save membership');
      throw new CoursesClientError(message, { code, status: response.status });
    }

    const payload = await response.json().catch(() => null);
    if (!payload || payload.ok !== true) {
      throw new CoursesClientError('Failed to save membership');
    }

    const memberships = parseCourseMembershipList([payload.data]);
    return memberships[0];
  } catch (error) {
    if (error instanceof CoursesClientError) {
      throw error;
    }
    throw new CoursesClientError(error instanceof Error ? error.message : 'Failed to save membership');
  }
}
