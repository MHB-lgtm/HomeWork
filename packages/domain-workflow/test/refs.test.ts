import { describe, expect, it } from 'vitest';
import {
  createAssignmentModuleRef,
  createExamBatchModuleRef,
  createLegacyJobModuleRef,
  getModuleRefId,
  getModuleRefKey,
  isSameModuleRef,
} from '../src';

describe('module refs', () => {
  it('creates deterministic keys for legacy job refs', () => {
    const moduleRef = createLegacyJobModuleRef('job-123');

    expect(getModuleRefId(moduleRef)).toBe('job-123');
    expect(getModuleRefKey(moduleRef)).toBe('legacy_job:job-123');
  });

  it('compares legacy job refs by kind and id', () => {
    expect(
      isSameModuleRef(createLegacyJobModuleRef('job-123'), createLegacyJobModuleRef('job-123'))
    ).toBe(true);
    expect(
      isSameModuleRef(createLegacyJobModuleRef('job-123'), createLegacyJobModuleRef('job-456'))
    ).toBe(false);
  });

  it('does not consider legacy job refs equal to academic module refs', () => {
    expect(
      isSameModuleRef(createLegacyJobModuleRef('job-123'), createAssignmentModuleRef('job-123'))
    ).toBe(false);
    expect(
      isSameModuleRef(createLegacyJobModuleRef('job-123'), createExamBatchModuleRef('job-123'))
    ).toBe(false);
  });
});
