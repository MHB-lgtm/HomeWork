import { CourseNotFoundError, IndexNotBuiltError, suggestStudyPointers } from '@hg/local-course-store';
import { StudyPointerV1 } from '@hg/shared-schemas';
import { JobRecord } from '@hg/local-job-store';

const MAX_TARGETS = 10;
const MAX_POINTERS_PER_TARGET = 3;

type StudyPointerTarget = {
  targetType: 'criterion' | 'finding';
  targetId: string;
  questionId?: string;
  issueText: string;
  severityRank: number;
  order: number;
};

export type StudyPointersPayload = {
  version: '1.0.0';
  courseId: string;
  method: 'lexical_v1';
  pointersByTarget: Array<{
    targetType: 'criterion' | 'finding';
    targetId: string;
    questionId?: string;
    pointers: StudyPointerV1[];
  }>;
};

const buildCriterionIssueText = (criterion: {
  label: string;
  feedback: string;
  guidance?: string;
}): string => {
  const parts = [criterion.label, criterion.feedback];
  if (criterion.guidance) {
    parts.push(criterion.guidance);
  }
  return parts.filter(Boolean).join('\n');
};

const buildFindingIssueText = (finding: {
  title: string;
  description?: string;
  suggestion?: string;
}): string => {
  const parts = [finding.title, finding.description, finding.suggestion];
  return parts.filter(Boolean).join('\n');
};

const severityRank = (severity?: string): number => {
  if (severity === 'critical') return 3;
  if (severity === 'major') return 2;
  if (severity === 'minor') return 1;
  return 0;
};

const extractRubricTargets = (resultJson: any): StudyPointerTarget[] => {
  const rubric = resultJson?.rubricEvaluation;
  if (!rubric?.criteria || !Array.isArray(rubric.criteria)) {
    return [];
  }

  const targets: StudyPointerTarget[] = [];
  rubric.criteria.forEach((criterion: any, index: number) => {
    if (criterion.score < criterion.maxPoints) {
      targets.push({
        targetType: 'criterion',
        targetId: criterion.criterionId,
        issueText: buildCriterionIssueText(criterion),
        severityRank: 0,
        order: index,
      });
    }
  });

  return targets.slice(0, MAX_TARGETS);
};

const extractGeneralTargets = (resultJson: any): StudyPointerTarget[] => {
  const general = resultJson?.generalEvaluation;
  if (!general) {
    return [];
  }

  const targets: StudyPointerTarget[] = [];
  let orderCounter = 0;

  if (Array.isArray(general.questions)) {
    general.questions.forEach((question: any) => {
      if (!Array.isArray(question.findings)) {
        return;
      }
      question.findings.forEach((finding: any) => {
        if (finding.kind === 'strength') {
          return;
        }
        targets.push({
          targetType: 'finding',
          targetId: finding.findingId,
          questionId: question.questionId,
          issueText: buildFindingIssueText(finding),
          severityRank: severityRank(finding.severity),
          order: orderCounter++,
        });
      });
    });
  } else if (Array.isArray(general.findings)) {
    const questionId = general.scope?.type === 'QUESTION' ? general.scope.questionId : undefined;
    general.findings.forEach((finding: any) => {
      if (finding.kind === 'strength') {
        return;
      }
      targets.push({
        targetType: 'finding',
        targetId: finding.findingId,
        questionId,
        issueText: buildFindingIssueText(finding),
        severityRank: severityRank(finding.severity),
        order: orderCounter++,
      });
    });
  }

  const hasSeverity = targets.some((target) => target.severityRank > 0);
  if (hasSeverity) {
    targets.sort((a, b) => {
      if (b.severityRank !== a.severityRank) {
        return b.severityRank - a.severityRank;
      }
      return a.order - b.order;
    });
  }

  return targets.slice(0, MAX_TARGETS);
};

const extractTargets = (resultJson: any): StudyPointerTarget[] => {
  if (resultJson?.mode === 'GENERAL' || resultJson?.generalEvaluation) {
    return extractGeneralTargets(resultJson);
  }
  return extractRubricTargets(resultJson);
};

export async function attachStudyPointers(args: {
  job: JobRecord;
  resultJson: any;
}): Promise<StudyPointersPayload | null> {
  const { job, resultJson } = args;
  const courseId = job.inputs.courseId;

  if (!courseId) {
    console.log(`[job:${job.id}] studyPointers skipped: no courseId`);
    return null;
  }

  const targets = extractTargets(resultJson);
  if (targets.length === 0) {
    console.log(`[job:${job.id}] studyPointers: courseId=${courseId} targets=0 attached=0`);
    return {
      version: '1.0.0',
      courseId,
      method: 'lexical_v1',
      pointersByTarget: [],
    };
  }

  const pointersByTarget: StudyPointersPayload['pointersByTarget'] = [];

  for (const target of targets) {
    try {
      const result = await suggestStudyPointers(courseId, {
        issueText: target.issueText,
        k: MAX_POINTERS_PER_TARGET,
      });
      pointersByTarget.push({
        targetType: target.targetType,
        targetId: target.targetId,
        questionId: target.questionId,
        pointers: result.pointers,
      });
    } catch (error) {
      if (error instanceof IndexNotBuiltError) {
        console.log(`[job:${job.id}] studyPointers disabled: INDEX_NOT_BUILT courseId=${courseId}`);
        return {
          version: '1.0.0',
          courseId,
          method: 'lexical_v1',
          pointersByTarget: [],
        };
      }
      if (error instanceof CourseNotFoundError) {
        console.log(`[job:${job.id}] studyPointers disabled: COURSE_NOT_FOUND courseId=${courseId}`);
        return {
          version: '1.0.0',
          courseId,
          method: 'lexical_v1',
          pointersByTarget: [],
        };
      }

      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[job:${job.id}] studyPointers target error: ${message}`);
      pointersByTarget.push({
        targetType: target.targetType,
        targetId: target.targetId,
        questionId: target.questionId,
        pointers: [],
      });
    }
  }

  console.log(
    `[job:${job.id}] studyPointers: courseId=${courseId} targets=${targets.length} attached=${pointersByTarget.length}`
  );

  return {
    version: '1.0.0',
    courseId,
    method: 'lexical_v1',
    pointersByTarget,
  };
}
