import { FastifyRequest, FastifyReply } from 'fastify';
import { redis } from '../../core/queue/bullmq.js';
import { RateLimitExceededError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyPrefix?: string;
}

const DEFAULT_OPTIONS: RateLimitOptions = {
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  keyPrefix: 'ratelimit',
};

export function createRateLimiter(options: Partial<RateLimitOptions> = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return async function rateLimiter(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const key = getRateLimitKey(request, opts.keyPrefix!);
    const windowSeconds = Math.ceil(opts.windowMs / 1000);

    try {
      const current = await redis.incr(key);

      if (current === 1) {
        await redis.expire(key, windowSeconds);
      }

      const ttl = await redis.ttl(key);
      const remaining = Math.max(0, opts.max - current);
      const resetTime = new Date(Date.now() + ttl * 1000);

      // Set rate limit headers
      reply.header('X-RateLimit-Limit', opts.max);
      reply.header('X-RateLimit-Remaining', remaining);
      reply.header('X-RateLimit-Reset', Math.ceil(resetTime.getTime() / 1000));

      if (current > opts.max) {
        reply.header('Retry-After', ttl);

        logger.warn(
          {
            key,
            current,
            max: opts.max,
            ip: request.ip,
          },
          'Rate limit exceeded'
        );

        throw new RateLimitExceededError(ttl);
      }
    } catch (error) {
      if (error instanceof RateLimitExceededError) {
        throw error;
      }

      // If Redis fails, log but allow the request
      logger.error({ error, key }, 'Rate limiter Redis error');
    }
  };
}

function getRateLimitKey(request: FastifyRequest, prefix: string): string {
  // Use API key if present
  const apiKey = request.headers['x-api-key'];
  if (apiKey && typeof apiKey === 'string') {
    return `${prefix}:apikey:${apiKey.substring(0, 12)}`;
  }

  // Use user ID if authenticated
  if (request.authContext?.user?.id) {
    return `${prefix}:user:${request.authContext.user.id}`;
  }

  // Fall back to IP
  return `${prefix}:ip:${request.ip}`;
}

// Preset rate limiters for different endpoints
export const uploadRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 uploads per minute
  keyPrefix: 'ratelimit:upload',
});

export const processRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 processing jobs per minute
  keyPrefix: 'ratelimit:process',
});

export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 auth attempts per 15 minutes
  keyPrefix: 'ratelimit:auth',
});

export const apiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  keyPrefix: 'ratelimit:api',
});
