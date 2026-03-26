import { describe, expect, it } from 'vitest';
import { assertCanTransitionFlagState } from '../src';

describe('flag rules', () => {
  it('allows open to resolved and open to dismissed', () => {
    expect(() => assertCanTransitionFlagState('open', 'resolved')).not.toThrow();
    expect(() => assertCanTransitionFlagState('open', 'dismissed')).not.toThrow();
  });

  it('does not allow transitions out of resolved', () => {
    expect(() => assertCanTransitionFlagState('resolved', 'open')).toThrow(
      /Invalid flag transition/
    );
  });
});
