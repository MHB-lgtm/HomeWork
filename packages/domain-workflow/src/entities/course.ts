import type { AssetRef } from '../refs';
import type { CourseStatus } from '../states';

export type CourseId = string;
export type WeekId = string;
export type CourseMaterialId = string;

export type CourseMaterialKind =
  | 'assignment_prompt'
  | 'assignment_solution'
  | 'exam_original'
  | 'exam_model_solution'
  | 'submission_pdf'
  | 'derived_artifact'
  | 'export_bundle'
  | 'lecture_asset';

export interface Course {
  courseId: CourseId;
  title: string;
  status: CourseStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Week {
  weekId: WeekId;
  courseId: CourseId;
  order: number;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface CourseMaterial {
  materialId: CourseMaterialId;
  courseId: CourseId;
  kind: CourseMaterialKind;
  assetRef: AssetRef;
  title?: string;
  createdAt: string;
  updatedAt: string;
}
