import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../core/database/prisma.js';
import { hashPassword, verifyPassword, validatePasswordStrength } from '../../core/auth/password.js';
import { generateTokenPair, generateSecureToken, getRefreshTokenExpiry, verifyToken } from '../../core/auth/jwt.js';
import { authenticate } from '../../core/auth/middleware.js';
import { authLogger } from '../../utils/logger.js';
import {
  ValidationError,
  InvalidCredentialsError,
  DuplicateError,
  InvalidTokenError,
  NotFoundError,
} from '../../utils/errors.js';
import { encrypt, decrypt, maskApiKey } from '../../core/auth/encryption.js';
import { config } from '../../config/index.js';
import { invalidateAiClientCache } from '../../plugins/ai-providers/index.js';

// Helpers
function isRealApiKey(key: string | undefined): boolean {
  return !!key && key.length > 30 && !key.includes('your-');
}

function isAdminRole(role: string): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

// Schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2).max(100),
  organizationName: z.string().min(2).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

type RegisterBody = z.infer<typeof registerSchema>;
type LoginBody = z.infer<typeof loginSchema>;
type RefreshBody = z.infer<typeof refreshSchema>;

export async function authRoutes(fastify: FastifyInstance) {
  // Register new organization and user
  fastify.post<{ Body: RegisterBody }>(
    '/register',
    {
      schema: {
        description: 'Register a new organization and admin user',
        tags: ['Authentication'],
        body: {
          type: 'object',
          required: ['email', 'password', 'name', 'organizationName'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
            name: { type: 'string', minLength: 2, maxLength: 100 },
            organizationName: { type: 'string', minLength: 2, maxLength: 100 },
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
                  user: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      email: { type: 'string' },
                      name: { type: 'string' },
                      role: { type: 'string' },
                    },
                  },
                  organization: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string' },
                      slug: { type: 'string' },
                    },
                  },
                  accessToken: { type: 'string' },
                  refreshToken: { type: 'string' },
                  expiresIn: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const result = registerSchema.safeParse(request.body);
      if (!result.success) {
        throw new ValidationError('Invalid input', { errors: result.error.flatten() });
      }

      const { email, password, name, organizationName } = result.data;

      // Validate password strength
      const passwordCheck = validatePasswordStrength(password);
      if (!passwordCheck.valid) {
        throw new ValidationError('Password does not meet requirements', {
          errors: passwordCheck.errors,
        });
      }

      // Check if email already exists
      const existingUser = await prisma.user.findFirst({
        where: { email: email.toLowerCase() },
      });
      if (existingUser) {
        throw new DuplicateError('User', 'email');
      }

      // Create slug from organization name
      const slug = organizationName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      // Check if slug exists
      const existingOrg = await prisma.organization.findUnique({
        where: { slug },
      });
      if (existingOrg) {
        throw new DuplicateError('Organization', 'name');
      }

      // Hash password
      const passwordHash = await hashPassword(password);

      // Create organization and user in transaction
      const { organization, user } = await prisma.$transaction(async (tx) => {
        const org = await tx.organization.create({
          data: {
            name: organizationName,
            slug,
            email: email.toLowerCase(),
          },
        });

        const usr = await tx.user.create({
          data: {
            organizationId: org.id,
            email: email.toLowerCase(),
            passwordHash,
            name,
            role: 'OWNER',
            status: 'ACTIVE',
          },
        });

        return { organization: org, user: usr };
      });

      // Generate tokens
      const tokens = generateTokenPair(fastify, {
        sub: user.id,
        orgId: organization.id,
        email: user.email,
        role: user.role,
      });

      // Store refresh token
      await prisma.refreshToken.create({
        data: {
          userId: user.id,
          token: tokens.refreshToken,
          expiresAt: getRefreshTokenExpiry(),
        },
      });

      authLogger.info({ userId: user.id, orgId: organization.id }, 'New registration');

      return reply.status(201).send({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          },
          organization: {
            id: organization.id,
            name: organization.name,
            slug: organization.slug,
          },
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn,
        },
      });
    }
  );

  // Login
  fastify.post<{ Body: LoginBody }>(
    '/login',
    {
      schema: {
        description: 'Login with email and password',
        tags: ['Authentication'],
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                additionalProperties: true,
                properties: {
                  user: {
                    type: 'object',
                    additionalProperties: true,
                    properties: {
                      id: { type: 'string' },
                      email: { type: 'string' },
                      name: { type: 'string' },
                      role: { type: 'string' },
                      isSuperAdmin: { type: 'boolean' },
                    },
                  },
                  organization: {
                    type: ['object', 'null'],
                    additionalProperties: true,
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string' },
                      slug: { type: 'string' },
                    },
                  },
                  accessToken: { type: 'string' },
                  refreshToken: { type: 'string' },
                  expiresIn: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const result = loginSchema.safeParse(request.body);
      if (!result.success) {
        throw new ValidationError('Invalid input');
      }

      const { email, password } = result.data;

      // Find user
      const user = await prisma.user.findFirst({
        where: { email: email.toLowerCase() },
        include: { organization: true },
      });

      if (!user) {
        throw new InvalidCredentialsError();
      }

      // Verify password
      const validPassword = await verifyPassword(password, user.passwordHash);
      if (!validPassword) {
        authLogger.warn({ email: user.email }, 'Failed login attempt');
        throw new InvalidCredentialsError();
      }

      // Check user status
      if (user.status !== 'ACTIVE') {
        throw new InvalidCredentialsError('Account is not active');
      }

      // Generate tokens
      const tokens = generateTokenPair(fastify, {
        sub: user.id,
        orgId: user.organizationId || '',
        email: user.email,
        role: user.role,
        isSuperAdmin: user.isSuperAdmin || undefined,
      });

      // Store refresh token and update last login
      await prisma.$transaction([
        prisma.refreshToken.create({
          data: {
            userId: user.id,
            token: tokens.refreshToken,
            expiresAt: getRefreshTokenExpiry(),
          },
        }),
        prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        }),
      ]);

      authLogger.info({ userId: user.id }, 'User logged in');

      return reply.send({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            isSuperAdmin: user.isSuperAdmin,
          },
          organization: user.organization
            ? {
                id: user.organization.id,
                name: user.organization.name,
                slug: user.organization.slug,
              }
            : null,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn,
        },
      });
    }
  );

  // Refresh token
  fastify.post<{ Body: RefreshBody }>(
    '/refresh',
    {
      schema: {
        description: 'Refresh access token',
        tags: ['Authentication'],
        body: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: { type: 'string' },
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
                  accessToken: { type: 'string' },
                  refreshToken: { type: 'string' },
                  expiresIn: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const result = refreshSchema.safeParse(request.body);
      if (!result.success) {
        throw new ValidationError('Invalid input');
      }

      const { refreshToken } = result.data;

      // Verify token is valid JWT
      let payload;
      try {
        payload = verifyToken(fastify, refreshToken);
      } catch {
        throw new InvalidTokenError('Invalid refresh token');
      }

      if (payload.type !== 'refresh') {
        throw new InvalidTokenError('Invalid token type');
      }

      // Check if token exists in database
      const storedToken = await prisma.refreshToken.findUnique({
        where: { token: refreshToken },
        include: { user: { include: { organization: true } } },
      });

      if (!storedToken) {
        throw new InvalidTokenError('Refresh token not found');
      }

      if (storedToken.expiresAt < new Date()) {
        await prisma.refreshToken.delete({ where: { id: storedToken.id } });
        throw new InvalidTokenError('Refresh token expired');
      }

      const user = storedToken.user;

      // Generate new tokens
      const tokens = generateTokenPair(fastify, {
        sub: user.id,
        orgId: user.organizationId || '',
        email: user.email,
        role: user.role,
        isSuperAdmin: user.isSuperAdmin || undefined,
      });

      // Replace old refresh token with new one
      await prisma.$transaction([
        prisma.refreshToken.delete({ where: { id: storedToken.id } }),
        prisma.refreshToken.create({
          data: {
            userId: user.id,
            token: tokens.refreshToken,
            expiresAt: getRefreshTokenExpiry(),
          },
        }),
      ]);

      return reply.send({
        success: true,
        data: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn,
        },
      });
    }
  );

  // Logout
  fastify.post(
    '/logout',
    {
      onRequest: [authenticate],
      schema: {
        description: 'Logout and invalidate refresh token',
        tags: ['Authentication'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            refreshToken: { type: 'string' },
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
      const { refreshToken } = request.body as { refreshToken?: string };
      const userId = request.authContext?.user?.id;

      if (refreshToken) {
        // Delete specific refresh token
        await prisma.refreshToken.deleteMany({
          where: { token: refreshToken, userId },
        });
      } else if (userId) {
        // Delete all refresh tokens for user
        await prisma.refreshToken.deleteMany({
          where: { userId },
        });
      }

      authLogger.info({ userId }, 'User logged out');

      return reply.send({
        success: true,
        data: { message: 'Logged out successfully' },
      });
    }
  );

  // Get current user
  fastify.get(
    '/me',
    {
      onRequest: [authenticate],
      schema: {
        description: 'Get current authenticated user',
        tags: ['Authentication'],
        security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                additionalProperties: true,
                properties: {
                  user: {
                    type: 'object',
                    additionalProperties: true,
                    properties: {
                      id: { type: 'string' },
                      email: { type: 'string' },
                      name: { type: 'string' },
                      role: { type: 'string' },
                      isSuperAdmin: { type: 'boolean' },
                    },
                  },
                  organization: {
                    type: ['object', 'null'],
                    additionalProperties: true,
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string' },
                      slug: { type: 'string' },
                    },
                  },
                  aiSettings: {
                    type: ['object', 'null'],
                    additionalProperties: true,
                    properties: {
                      defaultProvider: { type: 'string' },
                      hasAnthropicKey: { type: 'boolean' },
                      hasOpenaiKey: { type: 'boolean' },
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
      if (request.authContext?.authType === 'apikey') {
        const apiKey = request.authContext.apiKey!;
        const org = await prisma.organization.findUnique({
          where: { id: apiKey.organizationId },
        });

        return reply.send({
          success: true,
          data: {
            apiKey: {
              id: apiKey.id,
              name: apiKey.name,
              permissions: apiKey.permissions,
            },
            organization: org
              ? {
                  id: org.id,
                  name: org.name,
                  slug: org.slug,
                }
              : null,
          },
        });
      }

      const user = request.authContext?.user!;

      // Super admin: no org, no AI settings
      if (user.isSuperAdmin) {
        return reply.send({
          success: true,
          data: {
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role,
              isSuperAdmin: true,
            },
            organization: null,
            aiSettings: null,
          },
        });
      }

      const [org, dbUser] = await Promise.all([
        user.organizationId
          ? prisma.organization.findUnique({ where: { id: user.organizationId } })
          : null,
        prisma.user.findUnique({
          where: { id: user.id },
          select: { settings: true },
        }),
      ]);

      const settings = (dbUser?.settings || {}) as Record<string, unknown>;

      return reply.send({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            isSuperAdmin: false,
          },
          organization: org
            ? {
                id: org.id,
                name: org.name,
                slug: org.slug,
              }
            : null,
          aiSettings: {
            defaultProvider: settings.aiDefaultProvider || 'anthropic',
            hasAnthropicKey: !!settings.anthropicApiKey ||
              (isAdminRole(user.role) && isRealApiKey(config.ai.anthropicApiKey)),
            hasOpenaiKey: !!settings.openaiApiKey ||
              (isAdminRole(user.role) && isRealApiKey(config.ai.openaiApiKey)),
          },
        },
      });
    }
  );

  // Update AI settings
  fastify.put<{
    Body: {
      defaultProvider?: string;
      anthropicApiKey?: string;
      openaiApiKey?: string;
    };
  }>(
    '/ai-settings',
    {
      onRequest: [authenticate],
      schema: {
        description: 'Update AI provider settings',
        tags: ['Authentication'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            defaultProvider: { type: 'string', enum: ['anthropic', 'openai'] },
            anthropicApiKey: { type: 'string' },
            openaiApiKey: { type: 'string' },
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
                  defaultProvider: { type: 'string' },
                  hasAnthropicKey: { type: 'boolean' },
                  hasOpenaiKey: { type: 'boolean' },
                  anthropicKeyMasked: { type: 'string', nullable: true },
                  openaiKeyMasked: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = request.authContext?.user?.id;
      if (!userId) {
        throw new ValidationError('User authentication required');
      }

      const { defaultProvider, anthropicApiKey, openaiApiKey } = request.body;

      // Load current settings
      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { settings: true },
      });

      const currentSettings = (dbUser?.settings || {}) as Record<string, unknown>;

      // Update settings
      if (defaultProvider) {
        currentSettings.aiDefaultProvider = defaultProvider;
      }

      if (anthropicApiKey !== undefined) {
        if (anthropicApiKey === '') {
          // Clear key
          delete currentSettings.anthropicApiKey;
        } else {
          currentSettings.anthropicApiKey = encrypt(anthropicApiKey);
        }
      }

      if (openaiApiKey !== undefined) {
        if (openaiApiKey === '') {
          // Clear key
          delete currentSettings.openaiApiKey;
        } else {
          currentSettings.openaiApiKey = encrypt(openaiApiKey);
        }
      }

      await prisma.user.update({
        where: { id: userId },
        data: { settings: currentSettings as object },
      });

      // Invalidate cached AI clients for this user
      invalidateAiClientCache(userId);

      // Build masked response
      let anthropicKeyMasked: string | null = null;
      let openaiKeyMasked: string | null = null;

      if (currentSettings.anthropicApiKey) {
        try {
          anthropicKeyMasked = maskApiKey(decrypt(currentSettings.anthropicApiKey as string));
        } catch {
          anthropicKeyMasked = '••••••••';
        }
      }

      if (currentSettings.openaiApiKey) {
        try {
          openaiKeyMasked = maskApiKey(decrypt(currentSettings.openaiApiKey as string));
        } catch {
          openaiKeyMasked = '••••••••';
        }
      }

      return reply.send({
        success: true,
        data: {
          defaultProvider: (currentSettings.aiDefaultProvider as string) || 'anthropic',
          hasAnthropicKey: !!currentSettings.anthropicApiKey,
          hasOpenaiKey: !!currentSettings.openaiApiKey,
          anthropicKeyMasked,
          openaiKeyMasked,
        },
      });
    }
  );
}
