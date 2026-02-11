import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import { config } from '../../config/index.js';
import { queueLogger } from '../../utils/logger.js';
import type { JobData, JobResult } from '../../types/index.js';

// Redis connection
// @ts-expect-error — ioredis CJS/ESM interop
export const redis = new Redis(config.redis.url, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redis.on('connect', () => {
  queueLogger.info('Redis connected');
});

redis.on('error', (error: Error) => {
  queueLogger.error({ error }, 'Redis connection error');
});

// Queue names based on priority
export const QUEUE_NAMES = {
  HIGH: 'media-processing-high', // < 5MB files
  NORMAL: 'media-processing-normal', // Default
  LOW: 'media-processing-low', // > 20MB files
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// Create queues
export const queues = {
  high: new Queue<JobData, JobResult>(QUEUE_NAMES.HIGH, {
    connection: redis,
    defaultJobOptions: {
      attempts: config.queue.maxRetries,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: {
        age: 3600 * 24, // Keep completed jobs for 24 hours
        count: 1000,
      },
      removeOnFail: {
        age: 3600 * 24 * 7, // Keep failed jobs for 7 days
      },
    },
  }),
  normal: new Queue<JobData, JobResult>(QUEUE_NAMES.NORMAL, {
    connection: redis,
    defaultJobOptions: {
      attempts: config.queue.maxRetries,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: {
        age: 3600 * 24,
        count: 1000,
      },
      removeOnFail: {
        age: 3600 * 24 * 7,
      },
    },
  }),
  low: new Queue<JobData, JobResult>(QUEUE_NAMES.LOW, {
    connection: redis,
    defaultJobOptions: {
      attempts: config.queue.maxRetries,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: {
        age: 3600 * 24,
        count: 1000,
      },
      removeOnFail: {
        age: 3600 * 24 * 7,
      },
    },
  }),
};

// Determine queue based on file size
export function selectQueue(fileSizeBytes: number): QueueName {
  const sizeMB = fileSizeBytes / (1024 * 1024);

  if (sizeMB < 5) {
    return QUEUE_NAMES.HIGH;
  } else if (sizeMB > 20) {
    return QUEUE_NAMES.LOW;
  }
  return QUEUE_NAMES.NORMAL;
}

export function getQueue(name: QueueName): Queue<JobData, JobResult> {
  switch (name) {
    case QUEUE_NAMES.HIGH:
      return queues.high;
    case QUEUE_NAMES.LOW:
      return queues.low;
    default:
      return queues.normal;
  }
}

// Add job to appropriate queue
export async function addJob(
  jobData: JobData,
  fileSizeBytes: number,
  options?: { priority?: number }
): Promise<Job<JobData, JobResult>> {
  const queueName = selectQueue(fileSizeBytes);
  const queue = getQueue(queueName);

  const job = await queue.add(jobData.actionId, jobData, {
    jobId: jobData.jobId,
    priority: options?.priority ?? jobData.priority,
  });

  queueLogger.info(
    {
      jobId: job.id,
      actionId: jobData.actionId,
      queue: queueName,
      priority: jobData.priority,
    },
    'Job added to queue'
  );

  return job;
}

// Get job from any queue
export async function getJob(jobId: string): Promise<Job<JobData, JobResult> | undefined> {
  for (const queue of Object.values(queues)) {
    const job = await queue.getJob(jobId);
    if (job) {
      return job;
    }
  }
  return undefined;
}

// Remove job from queues
export async function removeJob(jobId: string): Promise<void> {
  for (const queue of Object.values(queues)) {
    const job = await queue.getJob(jobId);
    if (job) {
      await job.remove();
      queueLogger.info({ jobId }, 'Job removed from queue');
      return;
    }
  }
}

// Get queue statistics
export async function getQueueStats(): Promise<{
  high: { waiting: number; active: number; completed: number; failed: number };
  normal: { waiting: number; active: number; completed: number; failed: number };
  low: { waiting: number; active: number; completed: number; failed: number };
}> {
  const getStats = async (queue: Queue) => ({
    waiting: await queue.getWaitingCount(),
    active: await queue.getActiveCount(),
    completed: await queue.getCompletedCount(),
    failed: await queue.getFailedCount(),
  });

  return {
    high: await getStats(queues.high),
    normal: await getStats(queues.normal),
    low: await getStats(queues.low),
  };
}

// Close connections
export async function closeRedis(): Promise<void> {
  await Promise.all([queues.high.close(), queues.normal.close(), queues.low.close()]);
  await redis.quit();
  queueLogger.info('Redis connections closed');
}

// Check Redis connection
export async function checkRedisConnection(): Promise<boolean> {
  try {
    await redis.ping();
    return true;
  } catch (error) {
    queueLogger.error({ error }, 'Redis connection check failed');
    return false;
  }
}
