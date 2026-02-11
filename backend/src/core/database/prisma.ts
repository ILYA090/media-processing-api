import { PrismaClient } from '@prisma/client';
import { dbLogger } from '../../utils/logger.js';

const globalForPrisma = global as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: [
      { level: 'query', emit: 'event' },
      { level: 'error', emit: 'event' },
      { level: 'warn', emit: 'event' },
    ],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Log queries in development
prisma.$on('query' as never, (e: { query: string; params: string; duration: number }) => {
  if (process.env.NODE_ENV === 'development') {
    dbLogger.debug(
      {
        query: e.query,
        params: e.params,
        duration: `${e.duration}ms`,
      },
      'Database query'
    );
  }
});

prisma.$on('error' as never, (e: { message: string }) => {
  dbLogger.error({ message: e.message }, 'Database error');
});

prisma.$on('warn' as never, (e: { message: string }) => {
  dbLogger.warn({ message: e.message }, 'Database warning');
});

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    dbLogger.error({ error }, 'Database connection check failed');
    return false;
  }
}
