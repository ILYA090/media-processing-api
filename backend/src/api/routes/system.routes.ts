import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { checkDatabaseConnection } from '../../core/database/prisma.js';
import { checkRedisConnection, getQueueStats } from '../../core/queue/bullmq.js';
import { checkStorageConnection } from '../../core/storage/minio.js';
import { actionRegistry } from '../../plugins/actions/registry.js';
import { config } from '../../config/index.js';
import { isOpenAIConfigured, isAnthropicConfigured } from '../../plugins/ai-providers/index.js';

export async function systemRoutes(fastify: FastifyInstance) {
  // Health check
  fastify.get(
    '/health',
    {
      schema: {
        description: 'Health check endpoint',
        tags: ['System'],
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              timestamp: { type: 'string' },
              version: { type: 'string' },
              services: {
                type: 'object',
                properties: {
                  database: { type: 'string' },
                  redis: { type: 'string' },
                  storage: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const [dbOk, redisOk, storageOk] = await Promise.all([
        checkDatabaseConnection(),
        checkRedisConnection(),
        checkStorageConnection(),
      ]);

      const allHealthy = dbOk && redisOk && storageOk;

      return reply.status(allHealthy ? 200 : 503).send({
        status: allHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        services: {
          database: dbOk ? 'healthy' : 'unhealthy',
          redis: redisOk ? 'healthy' : 'unhealthy',
          storage: storageOk ? 'healthy' : 'unhealthy',
        },
      });
    }
  );

  // Supported formats
  fastify.get(
    '/supported-formats',
    {
      schema: {
        description: 'Get supported media formats',
        tags: ['System'],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  image: {
                    type: 'object',
                    properties: {
                      formats: { type: 'array', items: { type: 'string' } },
                      mimeTypes: { type: 'array', items: { type: 'string' } },
                      maxFileSizeMB: { type: 'number' },
                      maxResolution: { type: 'number' },
                    },
                  },
                  audio: {
                    type: 'object',
                    properties: {
                      formats: { type: 'array', items: { type: 'string' } },
                      mimeTypes: { type: 'array', items: { type: 'string' } },
                      maxFileSizeMB: { type: 'number' },
                      maxDurationMinutes: { type: 'number' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      return reply.send({
        success: true,
        data: {
          image: {
            formats: config.media.image.supportedFormats,
            mimeTypes: config.media.image.supportedMimeTypes,
            maxFileSizeMB: config.media.image.maxFileSizeMB,
            maxResolution: config.media.image.maxResolution,
          },
          audio: {
            formats: config.media.audio.supportedFormats,
            mimeTypes: config.media.audio.supportedMimeTypes,
            maxFileSizeMB: config.media.audio.maxFileSizeMB,
            maxDurationMinutes: config.media.audio.maxDurationMinutes,
          },
        },
      });
    }
  );

  // Rate limits info
  fastify.get(
    '/rate-limits',
    {
      schema: {
        description: 'Get rate limit information',
        tags: ['System'],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  default: {
                    type: 'object',
                    properties: {
                      requestsPerMinute: { type: 'number' },
                      requestsPerDay: { type: 'number' },
                    },
                  },
                  upload: {
                    type: 'object',
                    properties: {
                      maxFileSizeMB: { type: 'number' },
                    },
                  },
                  processing: {
                    type: 'object',
                    properties: {
                      maxConcurrentJobs: { type: 'number' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      return reply.send({
        success: true,
        data: {
          default: {
            requestsPerMinute: 100,
            requestsPerDay: 10000,
          },
          upload: {
            maxFileSizeMB: config.limits.maxFileSizeMB,
          },
          processing: {
            maxConcurrentJobs: config.queue.concurrency,
            jobTimeoutMs: config.queue.jobTimeout,
            maxRetries: config.queue.maxRetries,
          },
        },
      });
    }
  );

  // Queue statistics
  fastify.get(
    '/queue-stats',
    {
      schema: {
        description: 'Get queue statistics',
        tags: ['System'],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  high: {
                    type: 'object',
                    properties: {
                      waiting: { type: 'number' },
                      active: { type: 'number' },
                      completed: { type: 'number' },
                      failed: { type: 'number' },
                    },
                  },
                  normal: {
                    type: 'object',
                    properties: {
                      waiting: { type: 'number' },
                      active: { type: 'number' },
                      completed: { type: 'number' },
                      failed: { type: 'number' },
                    },
                  },
                  low: {
                    type: 'object',
                    properties: {
                      waiting: { type: 'number' },
                      active: { type: 'number' },
                      completed: { type: 'number' },
                      failed: { type: 'number' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const stats = await getQueueStats();

      return reply.send({
        success: true,
        data: stats,
      });
    }
  );

  // Available AI providers
  fastify.get(
    '/ai-providers',
    {
      schema: {
        description: 'Get available AI providers',
        tags: ['System'],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  openai: {
                    type: 'object',
                    properties: {
                      available: { type: 'boolean' },
                      capabilities: { type: 'array', items: { type: 'string' } },
                    },
                  },
                  anthropic: {
                    type: 'object',
                    properties: {
                      available: { type: 'boolean' },
                      capabilities: { type: 'array', items: { type: 'string' } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      return reply.send({
        success: true,
        data: {
          openai: {
            available: isOpenAIConfigured(),
            capabilities: ['transcription', 'translation', 'ocr', 'image_description', 'image_analysis'],
          },
          anthropic: {
            available: isAnthropicConfigured(),
            capabilities: ['image_description', 'image_analysis'],
          },
        },
      });
    }
  );
}
