import { prisma } from '../core/database/prisma.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';
import type { Organization } from '@prisma/client';

export interface OrganizationUpdate {
  name?: string;
  email?: string;
  settings?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export async function getOrganization(id: string): Promise<Organization> {
  const org = await prisma.organization.findUnique({
    where: { id, deletedAt: null },
  });

  if (!org) {
    throw new NotFoundError('Organization', id);
  }

  return org;
}

export async function updateOrganization(
  id: string,
  data: OrganizationUpdate
): Promise<Organization> {
  const org = await prisma.organization.findUnique({
    where: { id, deletedAt: null },
  });

  if (!org) {
    throw new NotFoundError('Organization', id);
  }

  return prisma.organization.update({
    where: { id },
    data: {
      name: data.name,
      email: data.email,
      settings: data.settings ? JSON.parse(JSON.stringify(data.settings)) : undefined,
      metadata: data.metadata ? JSON.parse(JSON.stringify(data.metadata)) : undefined,
    },
  });
}

export async function getOrganizationStats(id: string): Promise<{
  userCount: number;
  apiKeyCount: number;
  mediaCount: number;
  jobCount: number;
}> {
  const [userCount, apiKeyCount, mediaCount, jobCount] = await Promise.all([
    prisma.user.count({ where: { organizationId: id } }),
    prisma.apiKey.count({ where: { organizationId: id, status: 'ACTIVE' } }),
    prisma.mediaFile.count({ where: { organizationId: id, status: 'READY' } }),
    prisma.processingJob.count({ where: { organizationId: id } }),
  ]);

  return { userCount, apiKeyCount, mediaCount, jobCount };
}

export async function softDeleteOrganization(id: string): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id, deletedAt: null },
  });

  if (!org) {
    throw new NotFoundError('Organization', id);
  }

  await prisma.organization.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
