import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole } from '../../core/auth/middleware.js';
import * as apiKeyService from '../../services/apikey.service.js';
import { ValidationError, ForbiddenError } from '../../utils/errors.js';

const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z.record(z.boolean()).optional(),
  rateLimits: z.record(z.number()).optional(),
  expiresAt: z.string().datetime().optional(),
});

const updateApiKeySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  permissions: z.record(z.boolean()).optional(),
  rateLimits: z.record(z.number()).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

type CreateApiKeyBody = z.infer<typeof createApiKeySchema>;
type UpdateApiKeyBody = z.infer<typeof updateApiKeySchema>;

export async function apiKeyRoutes(fastify: FastifyInstance) {
  // List API keys
  fastify.get<{ Querystring: { page?: string; limit?: string } }>(
    '/',
    {
      onRequest: [authenticate],
      schema: {
        description: 'List API keys for the organization',
        tags: ['API Keys'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'string' },
            limit: { type: 'string' },
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
                    name: { type: 'string' },
                    keyPrefix: { type: 'string' },
                    status: { type: 'string' },
                    permissions: { type: 'object' },
                    rateLimits: { type: 'object' },
                    expiresAt: { type: 'string', nullable: true },
                    lastUsedAt: { type: 'string', nullable: true },
                    createdAt: { type: 'string' },
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
      // Require user auth (not API key)
      if (request.authContext?.authType !== 'jwt') {
        throw new ForbiddenError('This endpoint requires user authentication');
      }

      const organizationId = request.authContext!.organizationId;
      const page = parseInt(request.query.page || '1', 10);
      const limit = Math.min(parseInt(request.query.limit || '20', 10), 100);

      const { apiKeys, total } = await apiKeyService.getApiKeys(organizationId, { page, limit });

      return reply.send({
        success: true,
        data: apiKeys.map((k) => ({
          id: k.id,
          name: k.name,
          keyPrefix: k.keyPrefix,
          status: k.status,
          permissions: k.permissions,
          rateLimits: k.rateLimits,
          expiresAt: k.expiresAt?.toISOString() || null,
          lastUsedAt: k.lastUsedAt?.toISOString() || null,
          createdAt: k.createdAt.toISOString(),
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

  // Create API key
  fastify.post<{ Body: CreateApiKeyBody }>(
    '/',
    {
      onRequest: [authenticate, requireRole('OWNER', 'ADMIN')],
      schema: {
        description: 'Create a new API key',
        tags: ['API Keys'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 100 },
            permissions: { type: 'object' },
            rateLimits: { type: 'object' },
            expiresAt: { type: 'string', format: 'date-time' },
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
                  name: { type: 'string' },
                  keyPrefix: { type: 'string' },
                  secretKey: { type: 'string' },
                  status: { type: 'string' },
                  createdAt: { type: 'string' },
                },
              },
              warning: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const result = createApiKeySchema.safeParse(request.body);
      if (!result.success) {
        throw new ValidationError('Invalid input', { errors: result.error.flatten() });
      }

      const organizationId = request.authContext!.organizationId;
      const userId = request.authContext!.user!.id;

      const { apiKey, secretKey } = await apiKeyService.createApiKey(organizationId, userId, {
        ...result.data,
        expiresAt: result.data.expiresAt ? new Date(result.data.expiresAt) : undefined,
      });

      return reply.status(201).send({
        success: true,
        data: {
          id: apiKey.id,
          name: apiKey.name,
          keyPrefix: apiKey.keyPrefix,
          secretKey,
          status: apiKey.status,
          createdAt: apiKey.createdAt.toISOString(),
        },
        warning: 'Store the secret key securely. It will not be shown again.',
      });
    }
  );

  // Get API key
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    {
      onRequest: [authenticate],
      schema: {
        description: 'Get API key details',
        tags: ['API Keys'],
        security: [{ bearerAuth: [] }],
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
                  name: { type: 'string' },
                  keyPrefix: { type: 'string' },
                  status: { type: 'string' },
                  permissions: { type: 'object' },
                  rateLimits: { type: 'object' },
                  expiresAt: { type: 'string', nullable: true },
                  lastUsedAt: { type: 'string', nullable: true },
                  createdAt: { type: 'string' },
                  updatedAt: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      if (request.authContext?.authType !== 'jwt') {
        throw new ForbiddenError('This endpoint requires user authentication');
      }

      const { id } = request.params;
      const organizationId = request.authContext!.organizationId;

      const apiKey = await apiKeyService.getApiKey(organizationId, id);

      return reply.send({
        success: true,
        data: {
          id: apiKey.id,
          name: apiKey.name,
          keyPrefix: apiKey.keyPrefix,
          status: apiKey.status,
          permissions: apiKey.permissions,
          rateLimits: apiKey.rateLimits,
          expiresAt: apiKey.expiresAt?.toISOString() || null,
          lastUsedAt: apiKey.lastUsedAt?.toISOString() || null,
          createdAt: apiKey.createdAt.toISOString(),
          updatedAt: apiKey.updatedAt.toISOString(),
        },
      });
    }
  );

  // Update API key
  fastify.put<{ Params: { id: string }; Body: UpdateApiKeyBody }>(
    '/:id',
    {
      onRequest: [authenticate, requireRole('OWNER', 'ADMIN')],
      schema: {
        description: 'Update API key',
        tags: ['API Keys'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 100 },
            permissions: { type: 'object' },
            rateLimits: { type: 'object' },
            status: { type: 'string', enum: ['ACTIVE', 'SUSPENDED'] },
            expiresAt: { type: 'string', format: 'date-time', nullable: true },
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
                  name: { type: 'string' },
                  status: { type: 'string' },
                  updatedAt: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const result = updateApiKeySchema.safeParse(request.body);

      if (!result.success) {
        throw new ValidationError('Invalid input', { errors: result.error.flatten() });
      }

      const organizationId = request.authContext!.organizationId;

      const apiKey = await apiKeyService.updateApiKey(organizationId, id, {
        ...result.data,
        expiresAt: result.data.expiresAt ? new Date(result.data.expiresAt) : result.data.expiresAt,
      });

      return reply.send({
        success: true,
        data: {
          id: apiKey.id,
          name: apiKey.name,
          status: apiKey.status,
          updatedAt: apiKey.updatedAt.toISOString(),
        },
      });
    }
  );

  // Delete API key
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    {
      onRequest: [authenticate, requireRole('OWNER', 'ADMIN')],
      schema: {
        description: 'Delete API key',
        tags: ['API Keys'],
        security: [{ bearerAuth: [] }],
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

      await apiKeyService.deleteApiKey(organizationId, id);

      return reply.send({
        success: true,
        data: { message: 'API key deleted successfully' },
      });
    }
  );

  // Rotate API key
  fastify.post<{ Params: { id: string } }>(
    '/:id/rotate',
    {
      onRequest: [authenticate, requireRole('OWNER', 'ADMIN')],
      schema: {
        description: 'Rotate API key (generate new secret)',
        tags: ['API Keys'],
        security: [{ bearerAuth: [] }],
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
                  name: { type: 'string' },
                  keyPrefix: { type: 'string' },
                  secretKey: { type: 'string' },
                },
              },
              warning: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const organizationId = request.authContext!.organizationId;

      const { apiKey, secretKey } = await apiKeyService.rotateApiKey(organizationId, id);

      return reply.send({
        success: true,
        data: {
          id: apiKey.id,
          name: apiKey.name,
          keyPrefix: apiKey.keyPrefix,
          secretKey,
        },
        warning: 'Store the new secret key securely. The old key is now invalid.',
      });
    }
  );
}
