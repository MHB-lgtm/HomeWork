import type { Flag } from '../entities/flag';
import { assertCanTransitionFlagState } from '../rules/flag';

export class FlagService {
  transitionFlag(flag: Flag, nextState: Flag['status'], nowIso: string): Flag {
    assertCanTransitionFlagState(flag.status, nextState);

    return {
      ...flag,
      status: nextState,
      updatedAt: nowIso,
    };
  }
}
