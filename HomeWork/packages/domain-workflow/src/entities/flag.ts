import type { FlagSeverity, FlagSource, FlagState } from '../states';

export type FlagId = string;
export type FlagScopeType =
  | 'course'
  | 'assignment'
  | 'submission'
  | 'review'
  | 'exam_batch'
  | 'published_result'
  | 'gradebook_entry';

export interface Flag {
  flagId: FlagId;
  scopeType: FlagScopeType;
  scopeId: string;
  source: FlagSource;
  severity: FlagSeverity;
  status: FlagState;
  code: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
}
