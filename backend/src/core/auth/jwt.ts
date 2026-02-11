import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { config } from '../../config/index.js';
import type { JwtPayload } from '../../types/index.js';

// Parse duration string to seconds
function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) {
    return 900; // Default 15 minutes
  }

  const value = parseInt(match[1]!, 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 3600;
    case 'd':
      return value * 86400;
    default:
      return 900;
  }
}

export function generateAccessToken(
  fastify: FastifyInstance,
  payload: Omit<JwtPayload, 'type' | 'iat' | 'exp'>
): string {
  return fastify.jwt.sign(
    { ...payload, type: 'access' },
    { expiresIn: config.auth.accessExpiry }
  );
}

export function generateRefreshToken(
  fastify: FastifyInstance,
  payload: Omit<JwtPayload, 'type' | 'iat' | 'exp'>
): string {
  return fastify.jwt.sign(
    { ...payload, type: 'refresh' },
    { expiresIn: config.auth.refreshExpiry }
  );
}

export function verifyToken(fastify: FastifyInstance, token: string): JwtPayload {
  return fastify.jwt.verify<JwtPayload>(token);
}

export function generateTokenPair(
  fastify: FastifyInstance,
  payload: Omit<JwtPayload, 'type' | 'iat' | 'exp'>
): {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
} {
  return {
    accessToken: generateAccessToken(fastify, payload),
    refreshToken: generateRefreshToken(fastify, payload),
    expiresIn: parseDuration(config.auth.accessExpiry),
  };
}

export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

export function getRefreshTokenExpiry(): Date {
  const seconds = parseDuration(config.auth.refreshExpiry);
  return new Date(Date.now() + seconds * 1000);
}
