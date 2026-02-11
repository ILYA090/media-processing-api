import { FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { prisma } from '../database/prisma.js';
import { authLogger } from '../../utils/logger.js';
import {
  UnauthorizedError,
  InvalidTokenError,
  TokenExpiredError,
  ForbiddenError,
} from '../../utils/errors.js';
import type { JwtPayload, RequestContext, AuthenticatedUser, AuthenticatedApiKey } from '../../types/index.js';

// Hash API key for comparison
function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

// Authenticate via JWT
async function authenticateJwt(request: FastifyRequest): Promise<RequestContext> {
  try {
    const payload = await request.jwtVerify<JwtPayload>();

    if (payload.type !== 'access') {
      throw new InvalidTokenError('Invalid token type');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        organizationId: true,
        email: true,
        name: true,
        role: true,
        status: true,
        isSuperAdmin: true,
        permissions: true,
      },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    if (user.status !== 'ACTIVE') {
      throw new ForbiddenError('User account is not active');
    }

    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      organizationId: user.organizationId || '',
      email: user.email,
      name: user.name,
      role: user.role,
      isSuperAdmin: user.isSuperAdmin,
      permissions: user.permissions as Record<string, boolean>,
    };

    return {
      authType: 'jwt',
      user: authenticatedUser,
      organizationId: user.organizationId || '',
    };
  } catch (error) {
    if ((error as { code?: string }).code === 'FST_JWT_AUTHORIZATION_TOKEN_EXPIRED') {
      throw new TokenExpiredError();
    }
    throw new InvalidTokenError();
  }
}

// Authenticate via API Key
async function authenticateApiKey(apiKeyHeader: string): Promise<RequestContext> {
  const keyHash = hashApiKey(apiKeyHeader);
  const keyPrefix = apiKeyHeader.substring(0, 8);

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    select: {
      id: true,
      organizationId: true,
      name: true,
      status: true,
      permissions: true,
      rateLimits: true,
      expiresAt: true,
    },
  });

  if (!apiKey) {
    authLogger.warn({ keyPrefix }, 'Invalid API key attempted');
    throw new UnauthorizedError('Invalid API key');
  }

  if (apiKey.status !== 'ACTIVE') {
    throw new ForbiddenError('API key is not active');
  }

  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    throw new ForbiddenError('API key has expired');
  }

  // Update last used timestamp
  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  });

  const authenticatedApiKey: AuthenticatedApiKey = {
    id: apiKey.id,
    organizationId: apiKey.organizationId,
    name: apiKey.name,
    permissions: apiKey.permissions as Record<string, boolean>,
    rateLimits: apiKey.rateLimits as Record<string, number>,
  };

  return {
    authType: 'apikey',
    apiKey: authenticatedApiKey,
    organizationId: apiKey.organizationId,
  };
}

// Main authentication middleware
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;
  const apiKeyHeader = request.headers['x-api-key'];

  // Check for API key first
  if (apiKeyHeader && typeof apiKeyHeader === 'string') {
    request.authContext = await authenticateApiKey(apiKeyHeader);
    return;
  }

  // Check for JWT
  if (authHeader?.startsWith('Bearer ')) {
    request.authContext = await authenticateJwt(request);
    return;
  }

  throw new UnauthorizedError('Authentication required');
}

// Optional authentication - doesn't throw if not authenticated
export async function optionalAuthenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;
  const apiKeyHeader = request.headers['x-api-key'];

  try {
    if (apiKeyHeader && typeof apiKeyHeader === 'string') {
      request.authContext = await authenticateApiKey(apiKeyHeader);
      return;
    }

    if (authHeader?.startsWith('Bearer ')) {
      request.authContext = await authenticateJwt(request);
      return;
    }
  } catch {
    // Ignore authentication errors for optional auth
  }
}

// Role-based authorization
export function requireRole(...allowedRoles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.authContext?.user) {
      throw new ForbiddenError('This action requires user authentication');
    }

    if (!allowedRoles.includes(request.authContext.user.role)) {
      throw new ForbiddenError('Insufficient role permissions');
    }
  };
}

// Permission-based authorization
export function requirePermission(permission: string) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.authContext) {
      throw new UnauthorizedError();
    }

    const permissions =
      request.authContext.user?.permissions || request.authContext.apiKey?.permissions || {};

    // Check for wildcard permission or specific permission
    if (permissions['*'] !== true && permissions[permission] !== true) {
      throw new ForbiddenError(`Missing required permission: ${permission}`);
    }
  };
}

// Require super admin
export async function requireSuperAdmin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!request.authContext?.user?.isSuperAdmin) {
    throw new ForbiddenError('Super admin access required');
  }
}

// Ensure organization access
export function requireOrganizationAccess(orgIdParam: string = 'id') {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.authContext) {
      throw new UnauthorizedError();
    }

    const requestedOrgId = (request.params as Record<string, string>)[orgIdParam];

    if (requestedOrgId && requestedOrgId !== request.authContext.organizationId) {
      throw new ForbiddenError('Access denied to this organization');
    }
  };
}
