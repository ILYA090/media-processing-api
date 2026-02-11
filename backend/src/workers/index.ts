import 'dotenv/config';
import { Worker } from 'bullmq';
import { redis, QUEUE_NAMES } from '../core/queue/bullmq.js';
import { prisma } from '../core/database/prisma.js';
import { actionRegistry } from '../plugins/actions/registry.js';
import { processJob } from './processor.js';
import { config } from '../config/index.js';
import { logger, jobLogger } from '../utils/logger.js';
import type { JobData, JobResult } from '../types/index.js';

async function main() {
  logger.info('Starting worker process...');

  // Initialize database connection
  await prisma.$connect();
  logger.info('Database connected');

  // Load action plugins
  await actionRegistry.loadActions();
  logger.info(`Loaded ${actionRegistry.getAllActions().length} actions`);

  // Create workers for each queue
  const workers: Worker<JobData, JobResult>[] = [];

  for (const queueName of Object.values(QUEUE_NAMES)) {
    const worker = new Worker<JobData, JobResult>(
      queueName,
      async (job) => {
        return processJob(job);
      },
      {
        connection: redis,
        concurrency: config.queue.concurrency,
        limiter: {
          max: 10,
          duration: 1000,
        },
      }
    );

    worker.on('completed', (job, result) => {
      jobLogger.info(
        {
          jobId: job.id,
          queue: queueName,
          success: result.success,
          processingTimeMs: result.processingTimeMs,
        },
        'Job completed'
      );
    });

    worker.on('failed', (job, error) => {
      jobLogger.error(
        {
          jobId: job?.id,
          queue: queueName,
          error: error.message,
          attemptsMade: job?.attemptsMade,
        },
        'Job failed'
      );
    });

    worker.on('error', (error) => {
      jobLogger.error({ queue: queueName, error: error.message }, 'Worker error');
    });

    worker.on('stalled', (jobId) => {
      jobLogger.warn({ jobId, queue: queueName }, 'Job stalled');
    });

    workers.push(worker);
    logger.info({ queue: queueName, concurrency: config.queue.concurrency }, 'Worker started');
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Received shutdown signal');

    // Close workers
    await Promise.all(workers.map((w) => w.close()));
    logger.info('Workers closed');

    // Close database connection
    await prisma.$disconnect();
    logger.info('Database disconnected');

    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  logger.info(
    {
      queues: Object.values(QUEUE_NAMES),
      concurrency: config.queue.concurrency,
    },
    'Worker process ready'
  );
}

main().catch((error) => {
  logger.fatal({ error }, 'Worker process failed to start');
  process.exit(1);
});
