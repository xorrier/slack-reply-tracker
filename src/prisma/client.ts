import { PrismaClient } from '@prisma/client';

/**
 * Single shared PrismaClient instance for the whole application.
 * Using a singleton prevents opening too many DB connections.
 */
export const prisma = new PrismaClient({
  log: process.env.DEBUG ? ['query', 'info', 'warn', 'error'] : ['warn', 'error'],
});
