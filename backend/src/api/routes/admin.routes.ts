import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, requireSuperAdmin } from '../../core/auth/middleware.js';
import {
  listOrganizations,
  createOrganization,
  deleteOrganization,
  listUsersInOrganization,
  deleteUser,
} from '../../services/admin.service.js';
import { ValidationError, DuplicateError } from '../../utils/errors.js';
import { validatePasswordStrength } from '../../core/auth/password.js';
import { prisma } from '../../core/database/prisma.js';

const createOrgSchema = z.object({
  name: z.string().min(2).max(100),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8),
  adminName: z.string().min(2).max(100),
});

export async function adminRoutes(fastify: FastifyInstance) {
  // All admin routes require authentication + super admin
  fastify.addHook('onRequest', authenticate);
  fastify.addHook('onRequest', requireSuperAdmin);

  // List organizations
  fastify.get<{
    Querystring: { page?: string; limit?: string };
  }>(
    '/organizations',
    {
      schema: {
        description: 'List all organizations (super admin only)',
        tags: ['Admin'],
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
            additionalProperties: true,
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: true,
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    slug: { type: 'string' },
                    email: { type: 'string' },
                  },
                },
              },
              meta: {
                type: 'object',
                additionalProperties: true,
                properties: {
                  total: { type: 'number' },
                  totalPages: { type: 'number' },
                  page: { type: 'number' },
                  limit: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const page = parseInt(request.query.page || '1', 10);
      const limit = Math.min(parseInt(request.query.limit || '20', 10), 100);
      const result = await listOrganizations(page, limit);

      return reply.send({
        success: true,
        data: result.organizations,
        meta: {
          total: result.total,
          totalPages: result.totalPages,
          page,
          limit,
        },
      });
    }
  );

  // Create organization
  fastify.post<{ Body: z.infer<typeof createOrgSchema> }>(
    '/organizations',
    {
      schema: {
        description: 'Create a new organization with admin user (super admin only)',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['name', 'adminEmail', 'adminPassword', 'adminName'],
          properties: {
            name: { type: 'string', minLength: 2, maxLength: 100 },
            adminEmail: { type: 'string', format: 'email' },
            adminPassword: { type: 'string', minLength: 8 },
            adminName: { type: 'string', minLength: 2, maxLength: 100 },
          },
        },
        response: {
          201: {
            type: 'object',
            additionalProperties: true,
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                additionalProperties: true,
                properties: {
                  organization: {
                    type: 'object',
                    additionalProperties: true,
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string' },
                      slug: { type: 'string' },
                    },
                  },
                  user: {
                    type: 'object',
                    additionalProperties: true,
                    properties: {
                      id: { type: 'string' },
                      email: { type: 'string' },
                      name: { type: 'string' },
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
      const parsed = createOrgSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError('Invalid input', { errors: parsed.error.flatten() });
      }

      const { name, adminEmail, adminPassword, adminName } = parsed.data;

      const passwordCheck = validatePasswordStrength(adminPassword);
      if (!passwordCheck.valid) {
        throw new ValidationError('Password does not meet requirements', {
          errors: passwordCheck.errors,
        });
      }

      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      // Check uniqueness
      const [existingOrg, existingUser] = await Promise.all([
        prisma.organization.findUnique({ where: { slug } }),
        prisma.user.findFirst({ where: { email: adminEmail.toLowerCase() } }),
      ]);

      if (existingOrg) throw new DuplicateError('Organization', 'name');
      if (existingUser) throw new DuplicateError('User', 'email');

      const result = await createOrganization({
        name,
        slug,
        adminEmail,
        adminPassword,
        adminName,
      });

      return reply.status(201).send({
        success: true,
        data: {
          organization: {
            id: result.organization.id,
            name: result.organization.name,
            slug: result.organization.slug,
          },
          user: {
            id: result.user.id,
            email: result.user.email,
            name: result.user.name,
          },
        },
      });
    }
  );

  // Delete organization (soft delete)
  fastify.delete<{ Params: { orgId: string } }>(
    '/organizations/:orgId',
    {
      schema: {
        description: 'Soft delete an organization (super admin only)',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['orgId'],
          properties: {
            orgId: { type: 'string' },
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
      await deleteOrganization(request.params.orgId);
      return reply.send({
        success: true,
        data: { message: 'Organization deleted' },
      });
    }
  );

  // List users in organization
  fastify.get<{
    Params: { orgId: string };
    Querystring: { page?: string; limit?: string };
  }>(
    '/organizations/:orgId/users',
    {
      schema: {
        description: 'List users in an organization (super admin only)',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['orgId'],
          properties: {
            orgId: { type: 'string' },
          },
        },
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
            additionalProperties: true,
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                additionalProperties: true,
                properties: {
                  users: {
                    type: 'array',
                    items: {
                      type: 'object',
                      additionalProperties: true,
                      properties: {
                        id: { type: 'string' },
                        email: { type: 'string' },
                        name: { type: 'string' },
                        role: { type: 'string' },
                        status: { type: 'string' },
                      },
                    },
                  },
                  organization: {
                    type: 'object',
                    additionalProperties: true,
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string' },
                    },
                  },
                },
              },
              meta: {
                type: 'object',
                additionalProperties: true,
                properties: {
                  total: { type: 'number' },
                  totalPages: { type: 'number' },
                  page: { type: 'number' },
                  limit: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const page = parseInt(request.query.page || '1', 10);
      const limit = Math.min(parseInt(request.query.limit || '20', 10), 100);
      const result = await listUsersInOrganization(request.params.orgId, page, limit);

      return reply.send({
        success: true,
        data: {
          users: result.users,
          organization: result.organization,
        },
        meta: {
          total: result.total,
          totalPages: result.totalPages,
          page,
          limit,
        },
      });
    }
  );

  // Delete user
  fastify.delete<{ Params: { orgId: string; userId: string } }>(
    '/organizations/:orgId/users/:userId',
    {
      schema: {
        description: 'Delete a user (super admin only)',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['orgId', 'userId'],
          properties: {
            orgId: { type: 'string' },
            userId: { type: 'string' },
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
      await deleteUser(request.params.userId);
      return reply.send({
        success: true,
        data: { message: 'User deleted' },
      });
    }
  );
}
