import 'dotenv/config';
import { validateEvaluationResult } from '@hg/shared-schemas';

const exampleResult = {
  score_total: 85,
  confidence: 0.9,
  summary_feedback: 'Good work overall',
  flags: [],
  criteria: [
    {
      id: 'criterion-1',
      title: 'Problem Solving',
      max_score: 30,
      score: 25,
      comment: 'Demonstrated good understanding of the problem',
      evidence: 'Solution shows correct approach',
    },
  ],
};

const validated = validateEvaluationResult(exampleResult);
console.log('Contract OK:', validated.score_total);

