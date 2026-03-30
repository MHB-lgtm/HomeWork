export type CourseStatus = 'active' | 'archived';

export type AssignmentState =
  | 'draft'
  | 'open'
  | 'closed'
  | 'processing'
  | 'reviewed'
  | 'published';

export type SubmissionState =
  | 'uploaded'
  | 'superseded'
  | 'queued'
  | 'processed'
  | 'lecturer_edited'
  | 'published';

export type ReviewState =
  | 'draft'
  | 'ready_for_review'
  | 'lecturer_edited'
  | 'published';

export type ReviewVersionKind =
  | 'ai_draft'
  | 'lecturer_edit'
  | 'published_snapshot';

export type PublishedResultStatus = 'effective' | 'superseded';

export type GradebookEntryStatus = 'effective';

export type ExamBatchState =
  | 'uploaded'
  | 'processing'
  | 'reviewed'
  | 'exported';

export type FlagSource = 'ai' | 'lecturer' | 'rule';

export type FlagSeverity = 'low' | 'medium' | 'high';

export type FlagState = 'open' | 'resolved' | 'dismissed';
