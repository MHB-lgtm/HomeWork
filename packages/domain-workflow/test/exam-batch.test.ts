import { describe, expect, it } from 'vitest';
import { assertCanTransitionExamBatchState } from '../src';

describe('exam batch rules', () => {
  it('allows reviewed to exported', () => {
    expect(() => assertCanTransitionExamBatchState('reviewed', 'exported')).not.toThrow();
  });

  it('rejects uploaded to exported', () => {
    expect(() => assertCanTransitionExamBatchState('uploaded', 'exported')).toThrow(
      /Invalid exam batch transition/
    );
  });
});
