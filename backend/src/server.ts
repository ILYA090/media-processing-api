import 'dotenv/config';
import { buildApp } from './app.js';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { prisma } from './core/database/prisma.js';
import { redis, closeRedis } from './core/queue/bullmq.js';
import { ensureBucket } from './core/storage/minio.js';
import { actionRegistry } from './plugins/actions/registry.js';

async function main() {
  try {
    // Initialize database connection
    logger.info('Connecting to database...');
    await prisma.$connect();
    logger.info('Database connected');

    // Initialize Redis connection
    logger.info('Connecting to Redis...');
    await redis.ping();
    logger.info('Redis connected');

    // Initialize MinIO bucket
    logger.info('Initializing storage...');
    await ensureBucket();
    logger.info('Storage initialized');

    // Load action plugins
    logger.info('Loading action plugins...');
    await actionRegistry.loadActions();
    logger.info(`Loaded ${actionRegistry.getAllActions().length} actions`);

    // Build and start the server
    const app = await buildApp();

    await app.listen({
      port: config.server.port,
      host: '0.0.0.0',
    });

    logger.info(
      {
        port: config.server.port,
        env: config.env,
        docs: `${config.server.baseUrl}/docs`,
      },
      'Server started'
    );
  } catch (error) {
    logger.fatal({ error }, 'Failed to start server');
    await cleanup();
    process.exit(1);
  }
}

async function cleanup() {
  try {
    await prisma.$disconnect();
    await closeRedis();
  } catch (error) {
    logger.error({ error }, 'Error during cleanup');
  }
}

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled Rejection');
});

process.on('uncaughtException', (error) => {
  logger.fatal({ error }, 'Uncaught Exception');
  cleanup().finally(() => process.exit(1));
});

main();
