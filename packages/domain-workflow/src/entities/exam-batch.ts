import type { CourseId, CourseMaterialId } from './course';
import type { ExamBatchState } from '../states';

export type ExamBatchId = string;

export interface ExamBatch {
  examBatchId: ExamBatchId;
  courseId: CourseId;
  title: string;
  materialIds: CourseMaterialId[];
  state: ExamBatchState;
  createdAt: string;
  updatedAt: string;
  exportedAt?: string;
}
