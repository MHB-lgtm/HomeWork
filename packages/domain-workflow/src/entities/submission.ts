import type { CourseId, CourseMaterialId } from './course';
import type { ModuleRef, StudentRef } from '../refs';
import type { SubmissionState } from '../states';

export type SubmissionId = string;

export interface Submission {
  submissionId: SubmissionId;
  courseId: CourseId;
  moduleRef: ModuleRef;
  studentRef: StudentRef;
  materialId: CourseMaterialId;
  submittedAt: string;
  supersedesSubmissionId?: SubmissionId;
  state: SubmissionState;
}
