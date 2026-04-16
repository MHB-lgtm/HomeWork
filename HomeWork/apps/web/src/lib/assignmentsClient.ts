'use client';

import { AssignmentSchema } from '@hg/shared-schemas';
import type { Assignment } from '@hg/shared-schemas';

type ApiErrorPayload = {
  error?: string;
  code?: string;
};

type AssignmentIndexingResult = {
  ok: boolean;
  message: string;
  details?: string;
};

export class AssignmentsClientError extends Error {
  code?: string;
  status?: number;

  constructor(message: string, options?: { code?: string; status?: number }) {
    super(message);
    this.name = 'AssignmentsClientError';
    this.code = options?.code;
    this.status = options?.status;
  }
}

const parseErrorPayload = async (response: Response, fallback: string) => {
  const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
  const message = payload?.error && typeof payload.error === 'string' ? payload.error : fallback;
  const code = payload?.code && typeof payload.code === 'string' ? payload.code : undefined;
  return { message, code };
};

const parseAssignmentList = (data: unknown): Assignment[] => {
  const result = AssignmentSchema.array().safeParse(data);
  if (!result.success) {
    throw new AssignmentsClientError('Invalid assignment data');
  }

  return result.data;
};

const parseAssignment = (data: unknown): Assignment => {
  const result = AssignmentSchema.safeParse(data);
  if (!result.success) {
    throw new AssignmentsClientError('Invalid assignment data');
  }

  return result.data;
};

export async function listCourseAssignments(courseId: string): Promise<Assignment[]> {
  const response = await fetch(`/api/courses/${courseId}/assignments`);
  if (!response.ok) {
    const { message, code } = await parseErrorPayload(response, 'Failed to load assignments');
    throw new AssignmentsClientError(message, { code, status: response.status });
  }

  const payload = await response.json().catch(() => null);
  if (!payload || payload.ok !== true) {
    throw new AssignmentsClientError('Failed to load assignments');
  }

  return parseAssignmentList(payload.data);
}

export async function createCourseAssignment(
  courseId: string,
  args: {
    title: string;
    openAt: string;
    deadlineAt: string;
    state?: Assignment['state'];
    source: File;
  }
): Promise<{ assignment: Assignment; indexing?: AssignmentIndexingResult }> {
  const formData = new FormData();
  formData.append('title', args.title);
  formData.append('openAt', args.openAt);
  formData.append('deadlineAt', args.deadlineAt);
  if (args.state) {
    formData.append('state', args.state);
  }
  formData.append('source', args.source);

  const response = await fetch(`/api/courses/${courseId}/assignments`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const { message, code } = await parseErrorPayload(response, 'Failed to create assignment');
    throw new AssignmentsClientError(message, { code, status: response.status });
  }

  const payload = await response.json().catch(() => null);
  if (!payload || payload.ok !== true) {
    throw new AssignmentsClientError('Failed to create assignment');
  }

  return {
    assignment: parseAssignment(payload.data),
    indexing:
      payload.indexing &&
      typeof payload.indexing.ok === 'boolean' &&
      typeof payload.indexing.message === 'string'
        ? {
            ok: payload.indexing.ok,
            message: payload.indexing.message,
            ...(typeof payload.indexing.details === 'string'
              ? { details: payload.indexing.details }
              : {}),
          }
        : undefined,
  };
}

export async function updateCourseAssignment(
  courseId: string,
  assignmentId: string,
  args: {
    title?: string;
    openAt?: string;
    deadlineAt?: string;
    state?: Assignment['state'];
    source?: File;
  }
): Promise<{ assignment: Assignment; indexing?: AssignmentIndexingResult }> {
  const response = await fetch(`/api/courses/${courseId}/assignments/${assignmentId}`, {
    method: 'PATCH',
    ...(args.source
      ? {
          body: (() => {
            const formData = new FormData();
            if (args.title !== undefined) formData.append('title', args.title);
            if (args.openAt !== undefined) formData.append('openAt', args.openAt);
            if (args.deadlineAt !== undefined) formData.append('deadlineAt', args.deadlineAt);
            if (args.state !== undefined) formData.append('state', args.state);
            formData.append('source', args.source);
            return formData;
          })(),
        }
      : {
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(args),
        }),
  });

  if (!response.ok) {
    const { message, code } = await parseErrorPayload(response, 'Failed to update assignment');
    throw new AssignmentsClientError(message, { code, status: response.status });
  }

  const payload = await response.json().catch(() => null);
  if (!payload || payload.ok !== true) {
    throw new AssignmentsClientError('Failed to update assignment');
  }

  return {
    assignment: parseAssignment(payload.data),
    indexing:
      payload.indexing &&
      typeof payload.indexing.ok === 'boolean' &&
      typeof payload.indexing.message === 'string'
        ? {
            ok: payload.indexing.ok,
            message: payload.indexing.message,
            ...(typeof payload.indexing.details === 'string'
              ? { details: payload.indexing.details }
              : {}),
          }
        : undefined,
  };
}

export async function listMyAssignments(): Promise<Assignment[]> {
  const response = await fetch('/api/me/assignments');
  if (!response.ok) {
    const { message, code } = await parseErrorPayload(response, 'Failed to load assignments');
    throw new AssignmentsClientError(message, { code, status: response.status });
  }

  const payload = await response.json().catch(() => null);
  if (!payload || payload.ok !== true) {
    throw new AssignmentsClientError('Failed to load assignments');
  }

  return parseAssignmentList(payload.data);
}

export async function getMyAssignment(assignmentId: string): Promise<Assignment> {
  const response = await fetch(`/api/me/assignments/${assignmentId}`);
  if (!response.ok) {
    const { message, code } = await parseErrorPayload(response, 'Failed to load assignment');
    throw new AssignmentsClientError(message, { code, status: response.status });
  }

  const payload = await response.json().catch(() => null);
  if (!payload || payload.ok !== true) {
    throw new AssignmentsClientError('Failed to load assignment');
  }

  return parseAssignment(payload.data);
}

export async function submitMyAssignment(
  assignmentId: string,
  file: File
): Promise<{ jobId: string }> {
  const formData = new FormData();
  formData.append('submission', file);

  const response = await fetch(`/api/me/assignments/${assignmentId}/submit`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const { message, code } = await parseErrorPayload(response, 'Failed to submit assignment');
    throw new AssignmentsClientError(message, { code, status: response.status });
  }

  const payload = await response.json().catch(() => null);
  if (!payload || payload.ok !== true || typeof payload.data?.jobId !== 'string') {
    throw new AssignmentsClientError('Failed to submit assignment');
  }

  return { jobId: payload.data.jobId as string };
}
