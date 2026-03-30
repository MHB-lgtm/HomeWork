import { getPrismaClient, disconnectPrismaClient } from '../src/client';
import { exportRuntimeJobsToLegacyQueue } from '../src/compat/rollback-export';

const getCliArgs = (): string[] => process.argv.slice(2);

const parseArgValue = (flag: string): string | undefined => {
  const args = getCliArgs();
  const index = args.findIndex((arg) => arg === flag);
  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
};

const resolveDataDir = (): string => {
  const fromArg = parseArgValue('--data-dir');
  const fromEnv = process.env.HG_DATA_DIR;
  const value = fromArg ?? fromEnv;
  if (!value) {
    throw new Error('HG_DATA_DIR is required for rollback export (or pass --data-dir)');
  }

  return value;
};

const main = async () => {
  const prisma = getPrismaClient();

  try {
    const summary = await exportRuntimeJobsToLegacyQueue(prisma, {
      dataDir: resolveDataDir(),
      jobId: parseArgValue('--job-id'),
      logger: console,
    });
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await disconnectPrismaClient();
  }
};

main().catch((error) => {
  console.error(
    '[postgres-store] rollback export failed:',
    error instanceof Error ? error.message : error
  );
  process.exitCode = 1;
});
