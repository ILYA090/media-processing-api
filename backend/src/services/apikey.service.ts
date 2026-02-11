import crypto from 'crypto';
import { prisma } from '../core/database/prisma.js';
import { NotFoundError } from '../utils/errors.js';
import type { ApiKey, ApiKeyStatus } from '@prisma/client';

const API_KEY_PREFIX = 'mpa_'; // media processing api

export interface CreateApiKeyData {
  name: string;
  permissions?: Record<string, boolean>;
  rateLimits?: Record<string, number>;
  expiresAt?: Date;
}

export interface UpdateApiKeyData {
  name?: string;
  permissions?: Record<string, boolean>;
  rateLimits?: Record<string, number>;
  status?: ApiKeyStatus;
  expiresAt?: Date | null;
}

export interface ApiKeyWithSecret {
  apiKey: ApiKey;
  secretKey: string;
}

function generateApiKey(): { key: string; hash: string; prefix: string } {
  const randomPart = crypto.randomBytes(32).toString('base64url');
  const key = `${API_KEY_PREFIX}${randomPart}`;
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  const prefix = key.substring(0, 12);
  return { key, hash, prefix };
}

export async function getApiKeys(
  organizationId: string,
  options?: { page?: number; limit?: number }
): Promise<{ apiKeys: ApiKey[]; total: number }> {
  const page = options?.page || 1;
  const limit = options?.limit || 20;
  const skip = (page - 1) * limit;

  const [apiKeys, total] = await Promise.all([
    prisma.apiKey.findMany({
      where: { organizationId },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.apiKey.count({ where: { organizationId } }),
  ]);

  return { apiKeys, total };
}

export async function getApiKey(organizationId: string, apiKeyId: string): Promise<ApiKey> {
  const apiKey = await prisma.apiKey.findFirst({
    where: { id: apiKeyId, organizationId },
  });

  if (!apiKey) {
    throw new NotFoundError('API Key', apiKeyId);
  }

  return apiKey;
}

export async function createApiKey(
  organizationId: string,
  userId: string,
  data: CreateApiKeyData
): Promise<ApiKeyWithSecret> {
  const { key, hash, prefix } = generateApiKey();

  const apiKey = await prisma.apiKey.create({
    data: {
      organizationId,
      createdByUserId: userId,
      name: data.name,
      keyPrefix: prefix,
      keyHash: hash,
      permissions: data.permissions ? JSON.parse(JSON.stringify(data.permissions)) : {},
      rateLimits: data.rateLimits ? JSON.parse(JSON.stringify(data.rateLimits)) : {},
      expiresAt: data.expiresAt,
      status: 'ACTIVE',
    },
  });

  return { apiKey, secretKey: key };
}

export async function updateApiKey(
  organizationId: string,
  apiKeyId: string,
  data: UpdateApiKeyData
): Promise<ApiKey> {
  const existing = await prisma.apiKey.findFirst({
    where: { id: apiKeyId, organizationId },
  });

  if (!existing) {
    throw new NotFoundError('API Key', apiKeyId);
  }

  return prisma.apiKey.update({
    where: { id: apiKeyId },
    data: {
      name: data.name,
      permissions: data.permissions ? JSON.parse(JSON.stringify(data.permissions)) : undefined,
      rateLimits: data.rateLimits ? JSON.parse(JSON.stringify(data.rateLimits)) : undefined,
      status: data.status,
      expiresAt: data.expiresAt,
    },
  });
}

export async function deleteApiKey(organizationId: string, apiKeyId: string): Promise<void> {
  const existing = await prisma.apiKey.findFirst({
    where: { id: apiKeyId, organizationId },
  });

  if (!existing) {
    throw new NotFoundError('API Key', apiKeyId);
  }

  await prisma.apiKey.delete({ where: { id: apiKeyId } });
}

export async function rotateApiKey(
  organizationId: string,
  apiKeyId: string
): Promise<ApiKeyWithSecret> {
  const existing = await prisma.apiKey.findFirst({
    where: { id: apiKeyId, organizationId },
  });

  if (!existing) {
    throw new NotFoundError('API Key', apiKeyId);
  }

  const { key, hash, prefix } = generateApiKey();

  const apiKey = await prisma.apiKey.update({
    where: { id: apiKeyId },
    data: {
      keyHash: hash,
      keyPrefix: prefix,
    },
  });

  return { apiKey, secretKey: key };
}

export async function suspendApiKey(organizationId: string, apiKeyId: string): Promise<ApiKey> {
  return updateApiKey(organizationId, apiKeyId, { status: 'SUSPENDED' });
}

export async function activateApiKey(organizationId: string, apiKeyId: string): Promise<ApiKey> {
  return updateApiKey(organizationId, apiKeyId, { status: 'ACTIVE' });
}

export async function revokeApiKey(organizationId: string, apiKeyId: string): Promise<ApiKey> {
  return updateApiKey(organizationId, apiKeyId, { status: 'REVOKED' });
}
