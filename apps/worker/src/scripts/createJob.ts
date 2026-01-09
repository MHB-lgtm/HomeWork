import { createJob } from '@hg/local-job-store';

function printUsage(): never {
  console.error('Usage: ts-node src/scripts/createJob.ts --exam <path> --questionId <id> --submission <path> [--question <path>] [--notes "<text>"]');
  console.error('');
  console.error('Required:');
  console.error('  --exam <path>        Path to exam file');
  console.error('  --questionId <id>    Question ID');
  console.error('  --submission <path>  Path to submission file');
  console.error('');
  console.error('Optional:');
  console.error('  --question <path>    Path to optional question image file');
  console.error('  --notes "<text>"     Grading notes');
  console.error('');
  console.error('Example:');
  console.error('  pnpm --filter worker job:create --exam exam.pdf --questionId "q1" --submission submission.jpg --question question.png --notes "Check for accuracy"');
  process.exit(1);
}

function parseArgs(): { examPath: string; questionId: string; submissionPath: string; questionPath?: string; notes?: string } {
  const args = process.argv.slice(2);
  const argsMap: Record<string, string> = {};

  // Parse arguments into a map
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--') && i + 1 < args.length) {
      argsMap[args[i]] = args[i + 1];
      i++;
    }
  }

  // Read into local variables
  const exam = argsMap['--exam'];
  const questionId = argsMap['--questionId'];
  const submission = argsMap['--submission'];
  const question = argsMap['--question'];
  const notes = argsMap['--notes'];

  // Explicit check
  if (!exam || !questionId || !submission) {
    printUsage();
  }

  // TypeScript now understands exam, questionId, and submission are defined strings
  return {
    examPath: exam,
    questionId: questionId,
    submissionPath: submission,
    questionPath: question,
    notes,
  };
}

async function main() {
  const { examPath, questionId, submissionPath, questionPath, notes } = parseArgs();

  const result = await createJob({
    examSourcePath: examPath,
    questionId: questionId,
    submissionSourcePath: submissionPath,
    questionSourcePath: questionPath,
    notes,
  });

  console.log(`Created job: ${result.jobId}`);
  console.log(`Job file location: data/jobs/pending/${result.jobId}.json`);
}

main().catch((error) => {
  console.error('Error creating job:', error);
  process.exit(1);
});
