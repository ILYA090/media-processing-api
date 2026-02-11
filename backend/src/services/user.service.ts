import { randomBytes } from 'crypto';
import { prisma } from '../core/database/prisma.js';
import { hashPassword } from '../core/auth/password.js';
import { NotFoundError, DuplicateError, ForbiddenError } from '../utils/errors.js';
import type { User, UserRole, UserStatus } from '@prisma/client';

export interface CreateUserData {
  email: string;
  password?: string;
  name: string;
  role?: UserRole;
}

export interface UpdateUserData {
  email?: string;
  name?: string;
  role?: UserRole;
  status?: UserStatus;
  permissions?: Record<string, boolean>;
}

export interface UserWithoutPassword {
  id: string;
  organizationId: string | null;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  permissions: unknown;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const userSelect = {
  id: true,
  organizationId: true,
  email: true,
  name: true,
  role: true,
  status: true,
  permissions: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
};

export async function getUsers(
  organizationId: string,
  options?: { page?: number; limit?: number }
): Promise<{ users: UserWithoutPassword[]; total: number }> {
  const page = options?.page || 1;
  const limit = options?.limit || 20;
  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId },
      select: userSelect,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where: { organizationId } }),
  ]);

  return { users, total };
}

export async function getUser(organizationId: string, userId: string): Promise<UserWithoutPassword> {
  const user = await prisma.user.findFirst({
    where: { id: userId, organizationId },
    select: userSelect,
  });

  if (!user) {
    throw new NotFoundError('User', userId);
  }

  return user;
}

export async function createUser(
  organizationId: string,
  data: CreateUserData
): Promise<UserWithoutPassword> {
  // Check if email exists in organization
  const existing = await prisma.user.findUnique({
    where: {
      organizationId_email: {
        organizationId,
        email: data.email.toLowerCase(),
      },
    },
  });

  if (existing) {
    throw new DuplicateError('User', 'email');
  }

  // If password provided, create as ACTIVE. Otherwise create as INVITED with random password hash.
  const hasPassword = !!data.password;
  const passwordHash = hasPassword
    ? await hashPassword(data.password!)
    : await hashPassword(randomBytes(32).toString('hex'));

  const user = await prisma.user.create({
    data: {
      organizationId,
      email: data.email.toLowerCase(),
      passwordHash,
      name: data.name,
      role: data.role || 'MEMBER',
      status: hasPassword ? 'ACTIVE' : 'INVITED',
    },
    select: userSelect,
  });

  return user;
}

export async function updateUser(
  organizationId: string,
  userId: string,
  data: UpdateUserData,
  requestingUserRole: UserRole
): Promise<UserWithoutPassword> {
  const user = await prisma.user.findFirst({
    where: { id: userId, organizationId },
  });

  if (!user) {
    throw new NotFoundError('User', userId);
  }

  // Prevent role escalation
  if (data.role && requestingUserRole !== 'OWNER') {
    if (data.role === 'OWNER') {
      throw new ForbiddenError('Only owners can assign owner role');
    }
    if (user.role === 'OWNER') {
      throw new ForbiddenError('Cannot modify owner role');
    }
  }

  // Cannot demote the last owner
  if (user.role === 'OWNER' && data.role && data.role !== 'OWNER') {
    const ownerCount = await prisma.user.count({
      where: { organizationId, role: 'OWNER' },
    });
    if (ownerCount <= 1) {
      throw new ForbiddenError('Cannot remove the last owner');
    }
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      email: data.email?.toLowerCase(),
      name: data.name,
      role: data.role,
      status: data.status,
      permissions: data.permissions ? JSON.parse(JSON.stringify(data.permissions)) : undefined,
    },
    select: userSelect,
  });

  return updatedUser;
}

export async function deleteUser(
  organizationId: string,
  userId: string,
  requestingUserId: string,
  requestingUserRole: UserRole
): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { id: userId, organizationId },
  });

  if (!user) {
    throw new NotFoundError('User', userId);
  }

  // Cannot delete yourself
  if (userId === requestingUserId) {
    throw new ForbiddenError('Cannot delete your own account');
  }

  // Only owners can delete admins or owners
  if ((user.role === 'OWNER' || user.role === 'ADMIN') && requestingUserRole !== 'OWNER') {
    throw new ForbiddenError('Only owners can delete admin or owner accounts');
  }

  // Cannot delete the last owner
  if (user.role === 'OWNER') {
    const ownerCount = await prisma.user.count({
      where: { organizationId, role: 'OWNER' },
    });
    if (ownerCount <= 1) {
      throw new ForbiddenError('Cannot delete the last owner');
    }
  }

  await prisma.user.delete({ where: { id: userId } });
}

export async function changePassword(
  organizationId: string,
  userId: string,
  newPassword: string
): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { id: userId, organizationId },
  });

  if (!user) {
    throw new NotFoundError('User', userId);
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  // Invalidate all refresh tokens
  await prisma.refreshToken.deleteMany({
    where: { userId },
  });
}
