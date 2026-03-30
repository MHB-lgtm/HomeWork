import { describe, expect, it } from 'vitest';
import { assertCanTransitionReviewState } from '../src';

describe('review rules', () => {
  it('allows ready_for_review to published', () => {
    expect(() => assertCanTransitionReviewState('ready_for_review', 'published')).not.toThrow();
  });

  it('rejects published back to draft', () => {
    expect(() => assertCanTransitionReviewState('published', 'draft')).toThrow(
      /Invalid review transition/
    );
  });
});
