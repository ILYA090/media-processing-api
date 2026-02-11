import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../../core/auth/middleware.js';
import * as usageService from '../../services/usage.service.js';
import type { UsageActionType } from '../../types/index.js';

export async function usageRoutes(fastify: FastifyInstance) {
  // Get usage summary
  fastify.get<{
    Querystring: {
      startDate?: string;
      endDate?: string;
      userId?: string;
      apiKeyId?: string;
    };
  }>(
    '/',
    {
      onRequest: [authenticate],
      schema: {
        description: 'Get usage summary for the organization',
        tags: ['Usage'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            startDate: { type: 'string', format: 'date-time' },
            endDate: { type: 'string', format: 'date-time' },
            userId: { type: 'string', format: 'uuid' },
            apiKeyId: { type: 'string', format: 'uuid' },
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
                  totalRequests: { type: 'number' },
                  totalUploads: { type: 'number' },
                  totalProcessing: { type: 'number' },
                  totalDownloads: { type: 'number' },
                  totalBytesUploaded: { type: 'string' },
                  totalProcessingTimeMs: { type: 'number' },
                  totalAiTokensUsed: { type: 'number' },
                  totalCreditsUsed: { type: 'number' },
                  jobsCompleted: { type: 'number' },
                  jobsFailed: { type: 'number' },
                  jobsPending: { type: 'number' },
                  jobsTotal: { type: 'number' },
                  mediaCount: { type: 'number' },
                  storageBytesUsed: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const organizationId = request.authContext!.organizationId;
      const currentUserId = request.authContext?.user?.id;

      const summary = await usageService.getUsageSummary(organizationId, {
        startDate: request.query.startDate ? new Date(request.query.startDate) : undefined,
        endDate: request.query.endDate ? new Date(request.query.endDate) : undefined,
        userId: currentUserId,
        apiKeyId: request.query.apiKeyId,
      });

      return reply.send({
        success: true,
        data: {
          ...summary,
          totalBytesUploaded: summary.totalBytesUploaded.toString(),
          storageBytesUsed: summary.storageBytesUsed.toString(),
        },
      });
    }
  );

  // Get detailed usage
  fastify.get<{
    Querystring: {
      startDate?: string;
      endDate?: string;
      groupBy?: string;
    };
  }>(
    '/detailed',
    {
      onRequest: [authenticate],
      schema: {
        description: 'Get detailed usage breakdown',
        tags: ['Usage'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            startDate: { type: 'string', format: 'date-time' },
            endDate: { type: 'string', format: 'date-time' },
            groupBy: { type: 'string', enum: ['day', 'week', 'month'] },
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
                  byAction: { type: 'object', additionalProperties: true },
                  byMediaType: { type: 'object', additionalProperties: true },
                  byEndpoint: { type: 'object', additionalProperties: true },
                  byDay: { type: 'object', additionalProperties: true },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const organizationId = request.authContext!.organizationId;
      const currentUserId = request.authContext?.user?.id;

      const detailed = await usageService.getDetailedUsage(organizationId, {
        startDate: request.query.startDate ? new Date(request.query.startDate) : undefined,
        endDate: request.query.endDate ? new Date(request.query.endDate) : undefined,
        groupBy: request.query.groupBy as 'day' | 'week' | 'month' | undefined,
        userId: currentUserId,
      });

      return reply.send({
        success: true,
        data: detailed,
      });
    }
  );

  // Get usage records
  fastify.get<{
    Querystring: {
      page?: string;
      limit?: string;
      startDate?: string;
      endDate?: string;
      actionType?: string;
    };
  }>(
    '/records',
    {
      onRequest: [authenticate],
      schema: {
        description: 'Get usage records',
        tags: ['Usage'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'string' },
            limit: { type: 'string' },
            startDate: { type: 'string', format: 'date-time' },
            endDate: { type: 'string', format: 'date-time' },
            actionType: { type: 'string', enum: ['upload', 'process', 'download', 'api_call'] },
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
                    actionType: { type: 'string' },
                    actionId: { type: 'string', nullable: true },
                    endpoint: { type: 'string' },
                    httpMethod: { type: 'string' },
                    responseStatus: { type: 'number' },
                    timestamp: { type: 'string' },
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
      const currentUserId = request.authContext?.user?.id;
      const page = parseInt(request.query.page || '1', 10);
      const limit = Math.min(parseInt(request.query.limit || '50', 10), 100);

      const { records, total } = await usageService.getUsageRecords(organizationId, {
        page,
        limit,
        startDate: request.query.startDate ? new Date(request.query.startDate) : undefined,
        endDate: request.query.endDate ? new Date(request.query.endDate) : undefined,
        actionType: request.query.actionType as UsageActionType | undefined,
        userId: currentUserId,
      });

      return reply.send({
        success: true,
        data: records.map((r) => ({
          id: r.id,
          actionType: r.actionType.toLowerCase(),
          actionId: r.actionId,
          mediaType: r.mediaType,
          endpoint: r.endpoint,
          httpMethod: r.httpMethod,
          responseStatus: r.responseStatus,
          processingTimeMs: r.processingTimeMs,
          timestamp: r.timestamp.toISOString(),
        })),
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    }
  );
}
