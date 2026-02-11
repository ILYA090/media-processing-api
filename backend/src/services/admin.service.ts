import { prisma } from '../core/database/prisma.js';
import { hashPassword } from '../core/auth/password.js';
import { NotFoundError } from '../utils/errors.js';

export async function listOrganizations(page: number, limit: number) {
  const skip = (page - 1) * limit;

  const [organizations, total] = await Promise.all([
    prisma.organization.findMany({
      where: { deletedAt: null },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            users: true,
            mediaFiles: true,
            jobs: true,
          },
        },
      },
    }),
    prisma.organization.count({ where: { deletedAt: null } }),
  ]);

  return {
    organizations: organizations.map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      email: org.email,
      createdAt: org.createdAt,
      userCount: org._count.users,
      mediaCount: org._count.mediaFiles,
      jobCount: org._count.jobs,
    })),
    total,
    totalPages: Math.ceil(total / limit),
  };
}

export async function createOrganization(data: {
  name: string;
  slug: string;
  adminEmail: string;
  adminPassword: string;
  adminName: string;
}) {
  const passwordHash = await hashPassword(data.adminPassword);

  const result = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: data.name,
        slug: data.slug,
        email: data.adminEmail,
      },
    });

    const user = await tx.user.create({
      data: {
        organizationId: org.id,
        email: data.adminEmail.toLowerCase(),
        passwordHash,
        name: data.adminName,
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });

    return { organization: org, user };
  });

  return result;
}

export async function deleteOrganization(orgId: string) {
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) throw new NotFoundError('Organization');
  if (org.deletedAt) throw new NotFoundError('Organization');

  await prisma.organization.update({
    where: { id: orgId },
    data: { deletedAt: new Date() },
  });
}

export async function listUsersInOrganization(orgId: string, page: number, limit: number) {
  const skip = (page - 1) * limit;

  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org || org.deletedAt) throw new NotFoundError('Organization');

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId: orgId },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
      },
    }),
    prisma.user.count({ where: { organizationId: orgId } }),
  ]);

  return {
    users,
    organization: { id: org.id, name: org.name },
    total,
    totalPages: Math.ceil(total / limit),
  };
}

export async function deleteUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError('User');
  if (user.isSuperAdmin) throw new Error('Cannot delete super admin');

  await prisma.$transaction([
    prisma.refreshToken.deleteMany({ where: { userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);
}
