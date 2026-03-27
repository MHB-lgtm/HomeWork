import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __hgPrismaClient: PrismaClient | undefined;
}

export const getPrismaClient = (): PrismaClient => {
  if (!global.__hgPrismaClient) {
    global.__hgPrismaClient = new PrismaClient();
  }

  return global.__hgPrismaClient;
};

export const disconnectPrismaClient = async (): Promise<void> => {
  if (!global.__hgPrismaClient) {
    return;
  }

  await global.__hgPrismaClient.$disconnect();
  global.__hgPrismaClient = undefined;
};
