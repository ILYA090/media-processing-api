import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRole, requireOrganizationAccess } from '../../core/auth/middleware.js';
import * as userService from '../../services/user.service.js';
import { validatePasswordStrength } from '../../core/auth/password.js';
import { ValidationError } from '../../utils/errors.js';

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).optional(),
  name: z.string().min(2).max(100),
  role: z.enum(['ADMIN', 'MEMBER']).optional(),
});

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(2).max(100).optional(),
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER']).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  permissions: z.record(z.boolean()).optional(),
});

const changePasswordSchema = z.object({
  password: z.string().min(8),
});

type CreateUserBody = z.infer<typeof createUserSchema>;
type UpdateUserBody = z.infer<typeof updateUserSchema>;
type ChangePasswordBody = z.infer<typeof changePasswordSchema>;

export async function userRoutes(fastify: FastifyInstance) {
  // List users
  fastify.get<{ Params: { id: string }; Querystring: { page?: string; limit?: string } }>(
    '/:id/users',
    {
      onRequest: [authenticate, requireOrganizationAccess()],
      schema: {
        description: 'List organization users',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
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
                    email: { type: 'string' },
                    name: { type: 'string' },
                    role: { type: 'string' },
                    status: { type: 'string' },
                    lastLoginAt: { type: 'string', nullable: true },
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
      const { id } = request.params;
      const page = parseInt(request.query.page || '1', 10);
      const limit = Math.min(parseInt(request.query.limit || '20', 10), 100);

      const { users, total } = await userService.getUsers(id, { page, limit });

      return reply.send({
        success: true,
        data: users.map((u) => ({
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          status: u.status,
          lastLoginAt: u.lastLoginAt?.toISOString() || null,
          createdAt: u.createdAt.toISOString(),
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

  // Create user
  fastify.post<{ Params: { id: string }; Body: CreateUserBody }>(
    '/:id/users',
    {
      onRequest: [authenticate, requireOrganizationAccess(), requireRole('OWNER', 'ADMIN')],
      schema: {
        description: 'Create a new user in the organization',
        tags: ['Users'],
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
          required: ['email', 'name'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
            name: { type: 'string', minLength: 2, maxLength: 100 },
            role: { type: 'string', enum: ['ADMIN', 'MEMBER'] },
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
                  email: { type: 'string' },
                  name: { type: 'string' },
                  role: { type: 'string' },
                  status: { type: 'string' },
                  createdAt: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const result = createUserSchema.safeParse(request.body);

      if (!result.success) {
        throw new ValidationError('Invalid input', { errors: result.error.flatten() });
      }

      if (result.data.password) {
        const passwordCheck = validatePasswordStrength(result.data.password);
        if (!passwordCheck.valid) {
          throw new ValidationError('Password does not meet requirements', {
            errors: passwordCheck.errors,
          });
        }
      }

      const user = await userService.createUser(id, result.data);

      return reply.status(201).send({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          status: user.status,
          createdAt: user.createdAt.toISOString(),
        },
      });
    }
  );

  // Get user
  fastify.get<{ Params: { id: string; userId: string } }>(
    '/:id/users/:userId',
    {
      onRequest: [authenticate, requireOrganizationAccess()],
      schema: {
        description: 'Get user details',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id', 'userId'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
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
                  email: { type: 'string' },
                  name: { type: 'string' },
                  role: { type: 'string' },
                  status: { type: 'string' },
                  permissions: { type: 'object' },
                  lastLoginAt: { type: 'string', nullable: true },
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
      const { id, userId } = request.params;
      const user = await userService.getUser(id, userId);

      return reply.send({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          status: user.status,
          permissions: user.permissions,
          lastLoginAt: user.lastLoginAt?.toISOString() || null,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        },
      });
    }
  );

  // Update user
  fastify.put<{ Params: { id: string; userId: string }; Body: UpdateUserBody }>(
    '/:id/users/:userId',
    {
      onRequest: [authenticate, requireOrganizationAccess(), requireRole('OWNER', 'ADMIN')],
      schema: {
        description: 'Update user details',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id', 'userId'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
            name: { type: 'string', minLength: 2, maxLength: 100 },
            role: { type: 'string', enum: ['OWNER', 'ADMIN', 'MEMBER'] },
            status: { type: 'string', enum: ['ACTIVE', 'SUSPENDED'] },
            permissions: { type: 'object' },
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
                  email: { type: 'string' },
                  name: { type: 'string' },
                  role: { type: 'string' },
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
      const { id, userId } = request.params;
      const result = updateUserSchema.safeParse(request.body);

      if (!result.success) {
        throw new ValidationError('Invalid input', { errors: result.error.flatten() });
      }

      const requestingUserRole = request.authContext!.user!.role as 'OWNER' | 'ADMIN' | 'MEMBER';
      const user = await userService.updateUser(id, userId, result.data, requestingUserRole);

      return reply.send({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          status: user.status,
          updatedAt: user.updatedAt.toISOString(),
        },
      });
    }
  );

  // Delete user
  fastify.delete<{ Params: { id: string; userId: string } }>(
    '/:id/users/:userId',
    {
      onRequest: [authenticate, requireOrganizationAccess(), requireRole('OWNER', 'ADMIN')],
      schema: {
        description: 'Delete a user from the organization',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id', 'userId'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
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
      const { id, userId } = request.params;
      const requestingUserId = request.authContext!.user!.id;
      const requestingUserRole = request.authContext!.user!.role as 'OWNER' | 'ADMIN' | 'MEMBER';

      await userService.deleteUser(id, userId, requestingUserId, requestingUserRole);

      return reply.send({
        success: true,
        data: { message: 'User deleted successfully' },
      });
    }
  );

  // Change password
  fastify.post<{ Params: { id: string; userId: string }; Body: ChangePasswordBody }>(
    '/:id/users/:userId/change-password',
    {
      onRequest: [authenticate, requireOrganizationAccess()],
      schema: {
        description: 'Change user password',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id', 'userId'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['password'],
          properties: {
            password: { type: 'string', minLength: 8 },
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
      const { id, userId } = request.params;
      const requestingUserId = request.authContext!.user!.id;
      const requestingUserRole = request.authContext!.user!.role;

      // Only allow users to change their own password, unless OWNER
      if (userId !== requestingUserId && requestingUserRole !== 'OWNER') {
        throw new ValidationError('You can only change your own password');
      }

      const result = changePasswordSchema.safeParse(request.body);
      if (!result.success) {
        throw new ValidationError('Invalid input', { errors: result.error.flatten() });
      }

      const passwordCheck = validatePasswordStrength(result.data.password);
      if (!passwordCheck.valid) {
        throw new ValidationError('Password does not meet requirements', {
          errors: passwordCheck.errors,
        });
      }

      await userService.changePassword(id, userId, result.data.password);

      return reply.send({
        success: true,
        data: { message: 'Password changed successfully' },
      });
    }
  );
}
