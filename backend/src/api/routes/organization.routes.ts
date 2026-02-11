import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole, requireOrganizationAccess } from '../../core/auth/middleware.js';
import * as orgService from '../../services/organization.service.js';
import { ValidationError } from '../../utils/errors.js';

const updateOrgSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  settings: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

type UpdateOrgBody = z.infer<typeof updateOrgSchema>;

export async function organizationRoutes(fastify: FastifyInstance) {
  // Get organization
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    {
      onRequest: [authenticate, requireOrganizationAccess()],
      schema: {
        description: 'Get organization details',
        tags: ['Organizations'],
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
                  name: { type: 'string' },
                  slug: { type: 'string' },
                  email: { type: 'string' },
                  settings: { type: 'object' },
                  metadata: { type: 'object' },
                  createdAt: { type: 'string' },
                  stats: {
                    type: 'object',
                    properties: {
                      userCount: { type: 'number' },
                      apiKeyCount: { type: 'number' },
                      mediaCount: { type: 'number' },
                      jobCount: { type: 'number' },
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
      const { id } = request.params;
      const [org, stats] = await Promise.all([
        orgService.getOrganization(id),
        orgService.getOrganizationStats(id),
      ]);

      return reply.send({
        success: true,
        data: {
          id: org.id,
          name: org.name,
          slug: org.slug,
          email: org.email,
          settings: org.settings,
          metadata: org.metadata,
          createdAt: org.createdAt.toISOString(),
          stats,
        },
      });
    }
  );

  // Update organization
  fastify.put<{ Params: { id: string }; Body: UpdateOrgBody }>(
    '/:id',
    {
      onRequest: [authenticate, requireOrganizationAccess(), requireRole('OWNER', 'ADMIN')],
      schema: {
        description: 'Update organization details',
        tags: ['Organizations'],
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
            name: { type: 'string', minLength: 2, maxLength: 100 },
            email: { type: 'string', format: 'email' },
            settings: { type: 'object' },
            metadata: { type: 'object' },
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
                  slug: { type: 'string' },
                  email: { type: 'string' },
                  settings: { type: 'object' },
                  metadata: { type: 'object' },
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
      const result = updateOrgSchema.safeParse(request.body);

      if (!result.success) {
        throw new ValidationError('Invalid input', { errors: result.error.flatten() });
      }

      const org = await orgService.updateOrganization(id, result.data);

      return reply.send({
        success: true,
        data: {
          id: org.id,
          name: org.name,
          slug: org.slug,
          email: org.email,
          settings: org.settings,
          metadata: org.metadata,
          updatedAt: org.updatedAt.toISOString(),
        },
      });
    }
  );
}
