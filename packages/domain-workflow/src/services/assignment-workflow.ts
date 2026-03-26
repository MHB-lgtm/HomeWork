import type { Assignment } from '../entities/assignment';
import type { Submission } from '../entities/submission';
import type { SubmissionRepository } from '../repositories';
import { assignmentDeadlineReached, assertCanTransitionAssignmentState } from '../rules/assignment';
import { getSupersededSubmissionIds } from '../rules/submission';
import { getModuleRefKey } from '../refs';

export class AssignmentWorkflowService {
  constructor(private readonly submissionRepository?: SubmissionRepository) {}

  transitionAssignment(
    assignment: Assignment,
    nextState: Assignment['state'],
    nowIso: string
  ): Assignment {
    const deadlineReached = assignmentDeadlineReached(assignment, nowIso);
    assertCanTransitionAssignmentState(assignment.state, nextState, { deadlineReached });

    return {
      ...assignment,
      state: nextState,
      updatedAt: nowIso,
    };
  }

  async supersedeOlderSubmissions(submissions: Submission[]): Promise<string[]> {
    const first = submissions[0];
    if (!first) {
      return [];
    }

    const supersededIds = getSupersededSubmissionIds(
      submissions,
      first.studentRef,
      getModuleRefKey(first.moduleRef)
    );

    if (!this.submissionRepository) {
      return supersededIds;
    }

    for (const submissionId of supersededIds) {
      await this.submissionRepository.markSuperseded(submissionId);
    }

    return supersededIds;
  }
}
