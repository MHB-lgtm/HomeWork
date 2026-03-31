'use client';

import {
  AssignmentSubmissionOpsDetailSchema,
  AssignmentSubmissionOpsRowSchema,
  StaffDashboardAssignmentRowSchema,
} from '@hg/shared-schemas';
import type {
  AssignmentSubmissionOpsDetail,
  AssignmentSubmissionOpsRow,
  StaffDashboardAssignmentRow,
} from '@hg/shared-schemas';

type ApiErrorPayload = {
  error?: string;
  code?: string;
};

export class StaffOperationsClientError extends Error {
  code?: string;
  status?: number;

  constructor(message: string, options?: { code?: string; status?: number }) {
    super(message);
    this.name = 'StaffOperationsClientError';
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

const DashboardListSchema = StaffDashboardAssignmentRowSchema.array();

export async function listStaffDashboardAssignments(): Promise<
  StaffDashboardAssignmentRow[]
> {
  const response = await fetch('/api/staff/dashboard');
  if (!response.ok) {
    const { message, code } = await parseErrorPayload(
      response,
      'Failed to load staff dashboard'
    );
    throw new StaffOperationsClientError(message, { code, status: response.status });
  }

  const payload = await response.json().catch(() => null);
  if (!payload || payload.ok !== true) {
    throw new StaffOperationsClientError('Failed to load staff dashboard');
  }

  const result = DashboardListSchema.safeParse(payload.data);
  if (!result.success) {
    throw new StaffOperationsClientError('Invalid staff dashboard data');
  }

  return result.data;
}

export async function getAssignmentSubmissionOps(
  courseId: string,
  assignmentId: string
): Promise<{
  assignment: StaffDashboardAssignmentRow;
  submissions: AssignmentSubmissionOpsRow[];
}> {
  const response = await fetch(
    `/api/courses/${courseId}/assignments/${assignmentId}/submissions`
  );
  if (!response.ok) {
    const { message, code } = await parseErrorPayload(
      response,
      'Failed to load assignment submissions'
    );
    throw new StaffOperationsClientError(message, { code, status: response.status });
  }

  const payload = await response.json().catch(() => null);
  if (!payload || payload.ok !== true) {
    throw new StaffOperationsClientError('Failed to load assignment submissions');
  }

  const assignmentResult = StaffDashboardAssignmentRowSchema.safeParse(
    payload.data?.assignment
  );
  const submissionsResult = AssignmentSubmissionOpsRowSchema.array().safeParse(
    payload.data?.submissions
  );
  if (!assignmentResult.success || !submissionsResult.success) {
    throw new StaffOperationsClientError('Invalid assignment submissions data');
  }

  return {
    assignment: assignmentResult.data,
    submissions: submissionsResult.data,
  };
}

export async function getAssignmentSubmissionDetail(
  courseId: string,
  assignmentId: string,
  submissionId: string
): Promise<AssignmentSubmissionOpsDetail> {
  const response = await fetch(
    `/api/courses/${courseId}/assignments/${assignmentId}/submissions/${submissionId}`
  );
  if (!response.ok) {
    const { message, code } = await parseErrorPayload(
      response,
      'Failed to load submission detail'
    );
    throw new StaffOperationsClientError(message, { code, status: response.status });
  }

  const payload = await response.json().catch(() => null);
  if (!payload || payload.ok !== true) {
    throw new StaffOperationsClientError('Failed to load submission detail');
  }

  const result = AssignmentSubmissionOpsDetailSchema.safeParse(payload.data);
  if (!result.success) {
    throw new StaffOperationsClientError('Invalid submission detail data');
  }

  return result.data;
}
