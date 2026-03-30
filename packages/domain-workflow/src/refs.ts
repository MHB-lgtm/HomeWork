export type StudentRef = string;

export type ActorRef = string;

export type AssignmentModuleRef = {
  kind: 'assignment';
  assignmentId: string;
};

export type ExamBatchModuleRef = {
  kind: 'exam_batch';
  examBatchId: string;
};

export type LegacyJobModuleRef = {
  kind: 'legacy_job';
  legacyJobId: string;
};

export type ModuleRef = AssignmentModuleRef | ExamBatchModuleRef | LegacyJobModuleRef;

export type AssetStorageKind = 'local_file' | 'object_storage' | 'unknown';

export interface AssetRef {
  assetId: string;
  storageKind: AssetStorageKind;
  logicalBucket: string;
  path: string;
  mimeType?: string;
  sizeBytes?: number;
  originalName?: string;
}

export const asStudentRef = (value: string): StudentRef => value;

export const asActorRef = (value: string): ActorRef => value;

export const createAssignmentModuleRef = (assignmentId: string): AssignmentModuleRef => ({
  kind: 'assignment',
  assignmentId,
});

export const createExamBatchModuleRef = (examBatchId: string): ExamBatchModuleRef => ({
  kind: 'exam_batch',
  examBatchId,
});

export const createLegacyJobModuleRef = (legacyJobId: string): LegacyJobModuleRef => ({
  kind: 'legacy_job',
  legacyJobId,
});

export const getModuleRefId = (moduleRef: ModuleRef): string =>
  moduleRef.kind === 'assignment'
    ? moduleRef.assignmentId
    : moduleRef.kind === 'exam_batch'
      ? moduleRef.examBatchId
      : moduleRef.legacyJobId;

export const getModuleRefKey = (moduleRef: ModuleRef): string =>
  `${moduleRef.kind}:${getModuleRefId(moduleRef)}`;

export const isSameModuleRef = (left: ModuleRef, right: ModuleRef): boolean =>
  left.kind === right.kind && getModuleRefId(left) === getModuleRefId(right);
