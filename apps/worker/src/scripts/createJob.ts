import { createJob } from '@hg/local-job-store';

function printUsage(): never {
  console.error('Usage: ts-node src/scripts/createJob.ts --question <path> --submission <path> [--notes "<text>"]');
  console.error('');
  console.error('Required:');
  console.error('  --question <path>     Path to question file');
  console.error('  --submission <path>  Path to submission file');
  console.error('');
  console.error('Optional:');
  console.error('  --notes "<text>"     Grading notes');
  console.error('');
  console.error('Example:');
  console.error('  pnpm --filter worker job:create --question question.pdf --submission submission.jpg --notes "Check for accuracy"');
  process.exit(1);
}

function parseArgs(): { questionPath: string; submissionPath: string; notes?: string } {
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
  const question = argsMap['--question'];
  const submission = argsMap['--submission'];
  const notes = argsMap['--notes'];

  // Explicit check
  if (!question || !submission) {
    printUsage();
  }

  // TypeScript now understands question and submission are defined strings
  return {
    questionPath: question,
    submissionPath: submission,
    notes,
  };
}

async function main() {
  const { questionPath, submissionPath, notes } = parseArgs();

  const result = await createJob({
    questionSourcePath: questionPath,
    submissionSourcePath: submissionPath,
    notes,
  });

  console.log(`Created job: ${result.jobId}`);
  console.log(`Job file location: data/jobs/pending/${result.jobId}.json`);
}

main().catch((error) => {
  console.error('Error creating job:', error);
  process.exit(1);
});
