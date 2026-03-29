import { getPrismaClient, disconnectPrismaClient } from '../src/client';
import { importFileBackedData } from '../src/import-file-backed';

const getCliArgs = (): string[] => process.argv.slice(2);

const parseDataDirArg = (): string | undefined => {
  const args = getCliArgs();
  const index = args.findIndex((arg) => arg === '--data-dir');
  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
};

const parseDryRunArg = (): boolean => {
  const args = process.argv.slice(2);
  return args.includes('--dry-run');
};

const parseEmitCompatFilesArg = (): boolean => {
  const args = process.argv.slice(2);
  return args.includes('--emit-compat-files');
};

const main = async () => {
  const prisma = getPrismaClient();

  try {
    const summary = await importFileBackedData(prisma, {
      dataDir: parseDataDirArg(),
      dryRun: parseDryRunArg(),
      emitCompatFiles: parseEmitCompatFilesArg(),
    });
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await disconnectPrismaClient();
  }
};

main().catch((error) => {
  console.error('[postgres-store] import failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
