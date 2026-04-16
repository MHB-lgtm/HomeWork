'use client';

import {
  StudentAssignmentResultSchema,
  StudentAssignmentStatusSchema,
  type StudentAssignmentResult,
  type StudentAssignmentStatus,
} from '@hg/shared-schemas';

type ApiErrorPayload = {
  error?: string;
  code?: string;
};

export class ResultsClientError extends Error {
  code?: string;
  status?: number;

  constructor(message: string, options?: { code?: string; status?: number }) {
    super(message);
    this.name = 'ResultsClientError';
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

const parseStatusList = (data: unknown): StudentAssignmentStatus[] => {
  const result = StudentAssignmentStatusSchema.array().safeParse(data);
  if (!result.success) {
    throw new ResultsClientError('Invalid student result status data');
  }

  return result.data;
};

const parseResult = (data: unknown): StudentAssignmentResult => {
  const result = StudentAssignmentResultSchema.safeParse(data);
  if (!result.success) {
    throw new ResultsClientError('Invalid student result data');
  }

  return result.data;
};

export async function listMyResults(): Promise<StudentAssignmentStatus[]> {
  const response = await fetch('/api/me/results');
  if (!response.ok) {
    const { message, code } = await parseErrorPayload(response, 'Failed to load results');
    throw new ResultsClientError(message, { code, status: response.status });
  }

  const payload = await response.json().catch(() => null);
  if (!payload || payload.ok !== true) {
    throw new ResultsClientError('Failed to load results');
  }

  return parseStatusList(payload.data);
}

export async function getMyResult(assignmentId: string): Promise<StudentAssignmentResult> {
  const response = await fetch(`/api/me/results/${assignmentId}`);
  if (!response.ok) {
    const { message, code } = await parseErrorPayload(response, 'Failed to load result');
    throw new ResultsClientError(message, { code, status: response.status });
  }

  const payload = await response.json().catch(() => null);
  if (!payload || payload.ok !== true) {
    throw new ResultsClientError('Failed to load result');
  }

  return parseResult(payload.data);
}
