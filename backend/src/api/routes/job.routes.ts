import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../../core/auth/middleware.js';
import * as jobService from '../../services/job.service.js';
import * as mediaService from '../../services/media.service.js';
import { ValidationError } from '../../utils/errors.js';
import type { JobStatus } from '../../types/index.js';

const createJobSchema = z.object({
  mediaId: z.string().uuid(),
  actionId: z.string().min(1),
  parameters: z.record(z.unknown()).optional(),
  priority: z.number().min(1).max(100).optional(),
});

type CreateJobBody = z.infer<typeof createJobSchema>;

export async function jobRoutes(fastify: FastifyInstance) {
  // Create processing job
  fastify.post<{ Body: CreateJobBody }>(
    '/process',
    {
      onRequest: [authenticate],
      schema: {
        description: 'Create a new processing job',
        tags: ['Jobs'],
        security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
        body: {
          type: 'object',
          required: ['mediaId', 'actionId'],
          properties: {
            mediaId: { type: 'string', format: 'uuid' },
            actionId: { type: 'string' },
            parameters: { type: 'object', additionalProperties: true },
            priority: { type: 'number', minimum: 1, maximum: 100 },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  mediaId: { type: 'string' },
                  actionId: { type: 'string' },
                  status: { type: 'string' },
                  priority: { type: 'number' },
                  createdAt: { type: 'string' },
                  queuedAt: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const result = createJobSchema.safeParse(request.body);
      if (!result.success) {
        throw new ValidationError('Invalid input', { errors: result.error.flatten() });
      }

      const organizationId = request.authContext!.organizationId;
      const userId = request.authContext?.user?.id;
      const apiKeyId = request.authContext?.apiKey?.id;

      const job = await jobService.createJob({
        organizationId,
        userId,
        apiKeyId,
        mediaId: result.data.mediaId,
        actionId: result.data.actionId,
        parameters: result.data.parameters,
        priority: result.data.priority,
      });

      return reply.status(201).send({
        success: true,
        data: jobService.formatJobResponse(job),
      });
    }
  );

  // List jobs
  fastify.get<{
    Querystring: {
      page?: string;
      limit?: string;
      status?: string;
      mediaId?: string;
    };
  }>(
    '/jobs',
    {
      onRequest: [authenticate],
      schema: {
        description: 'List processing jobs',
        tags: ['Jobs'],
        security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'string' },
            limit: { type: 'string' },
            status: {
              type: 'string',
              enum: ['pending', 'queued', 'processing', 'completed', 'failed', 'cancelled'],
            },
            mediaId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    mediaId: { type: 'string' },
                    actionId: { type: 'string' },
                    actionCategory: { type: 'string' },
                    parameters: { type: 'object', additionalProperties: true },
                    status: { type: 'string' },
                    priority: { type: 'number' },
                    resultType: { type: 'string', nullable: true },
                    resultMediaId: { type: 'string', nullable: true },
                    resultData: { type: 'object', nullable: true, additionalProperties: true },
                    errorCode: { type: 'string', nullable: true },
                    errorMessage: { type: 'string', nullable: true },
                    processingTimeMs: { type: 'number', nullable: true },
                    createdAt: { type: 'string' },
                    queuedAt: { type: 'string', nullable: true },
                    startedAt: { type: 'string', nullable: true },
                    completedAt: { type: 'string', nullable: true },
                  },
                },
              },
              meta: {
                type: 'object',
                properties: {
                  page: { type: 'number' },
                  limit: { type: 'number' },
                  total: { type: 'number' },
                  totalPages: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const organizationId = request.authContext!.organizationId;
      const userId = request.authContext?.user?.id;
      const page = parseInt(request.query.page || '1', 10);
      const limit = Math.min(parseInt(request.query.limit || '20', 10), 100);

      const { jobs, total } = await jobService.getJobs(organizationId, {
        page,
        limit,
        status: request.query.status as JobStatus | undefined,
        mediaId: request.query.mediaId,
        userId,
      });

      return reply.send({
        success: true,
        data: jobs.map(jobService.formatJobResponse),
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    }
  );

  // Get job by ID
  fastify.get<{ Params: { id: string } }>(
    '/jobs/:id',
    {
      onRequest: [authenticate],
      schema: {
        description: 'Get job details',
        tags: ['Jobs'],
        security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  mediaId: { type: 'string' },
                  actionId: { type: 'string' },
                  actionCategory: { type: 'string' },
                  parameters: { type: 'object', additionalProperties: true },
                  status: { type: 'string' },
                  priority: { type: 'number' },
                  resultType: { type: 'string', nullable: true },
                  resultMediaId: { type: 'string', nullable: true },
                  resultData: { type: 'object', nullable: true, additionalProperties: true },
                  errorCode: { type: 'string', nullable: true },
                  errorMessage: { type: 'string', nullable: true },
                  processingTimeMs: { type: 'number', nullable: true },
                  createdAt: { type: 'string' },
                  queuedAt: { type: 'string', nullable: true },
                  startedAt: { type: 'string', nullable: true },
                  completedAt: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const organizationId = request.authContext!.organizationId;
      const userId = request.authContext?.user?.id;

      const job = await jobService.getJobById(organizationId, id, userId);

      return reply.send({
        success: true,
        data: jobService.formatJobResponse(job),
      });
    }
  );

  // Get job result
  fastify.get<{ Params: { id: string } }>(
    '/jobs/:id/result',
    {
      onRequest: [authenticate],
      schema: {
        description: 'Get job result',
        tags: ['Jobs'],
        security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  type: { type: 'string' },
                  data: { type: 'object' },
                  mediaId: { type: 'string' },
                  downloadUrl: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const organizationId = request.authContext!.organizationId;
      const userId = request.authContext?.user?.id;

      const result = await jobService.getJobResult(organizationId, id, userId);

      const response: Record<string, unknown> = {
        type: result.type,
        data: result.data,
      };

      // If result is a file, include download URL
      if (result.mediaId) {
        response.mediaId = result.mediaId;
        response.downloadUrl = `/api/v1/media/${result.mediaId}/download`;
      }

      return reply.send({
        success: true,
        data: response,
      });
    }
  );

  // Cancel or delete job
  fastify.delete<{
    Params: { id: string };
    Querystring: { permanent?: string; deleteResultFile?: string };
  }>(
    '/jobs/:id',
    {
      onRequest: [authenticate],
      schema: {
        description: 'Cancel or permanently delete a processing job',
        tags: ['Jobs'],
        security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            permanent: { type: 'string', enum: ['true', 'false'] },
            deleteResultFile: { type: 'string', enum: ['true', 'false'] },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  status: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const organizationId = request.authContext!.organizationId;
      const userId = request.authContext?.user?.id;
      const permanent = request.query.permanent === 'true';
      const deleteResultFile = request.query.deleteResultFile === 'true';

      if (permanent) {
        await jobService.deleteJob(organizationId, id, userId, deleteResultFile);
        return reply.send({
          success: true,
          data: {
            id,
            status: 'deleted',
            message: deleteResultFile
              ? 'Job and result file deleted'
              : 'Job deleted',
          },
        });
      }

      const job = await jobService.cancelJob(organizationId, id, userId);
      return reply.send({
        success: true,
        data: {
          id: job.id,
          status: job.status.toLowerCase(),
          message: 'Job cancelled successfully',
        },
      });
    }
  );
}
