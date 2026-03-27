import { getPrismaClient, disconnectPrismaClient } from '../src/client';
import { importFileBackedData } from '../src/import-file-backed';

const parseDataDirArg = (): string | undefined => {
  const args = process.argv.slice(2);
  const index = args.findIndex((arg) => arg === '--data-dir');
  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
};

const main = async () => {
  const prisma = getPrismaClient();

  try {
    const summary = await importFileBackedData(prisma, {
      dataDir: parseDataDirArg(),
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
