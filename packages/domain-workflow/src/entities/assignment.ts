import type { CourseId, CourseMaterialId, WeekId } from './course';
import type { AssignmentState } from '../states';

export type AssignmentId = string;

export interface Assignment {
  assignmentId: AssignmentId;
  courseId: CourseId;
  weekId: WeekId;
  title: string;
  openAt: string;
  deadlineAt: string;
  materialIds: CourseMaterialId[];
  state: AssignmentState;
  createdAt: string;
  updatedAt: string;
}
