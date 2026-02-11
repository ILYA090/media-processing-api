import { FastifyRequest, FastifyReply } from 'fastify';
import { z, ZodSchema } from 'zod';
import { ValidationError } from '../../utils/errors.js';

export function validateBody<T>(schema: ZodSchema<T>) {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const result = schema.safeParse(request.body);

    if (!result.success) {
      throw new ValidationError('Invalid request body', {
        errors: result.error.flatten(),
      });
    }

    // Replace body with parsed and validated data
    (request as { body: T }).body = result.data;
  };
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const result = schema.safeParse(request.query);

    if (!result.success) {
      throw new ValidationError('Invalid query parameters', {
        errors: result.error.flatten(),
      });
    }

    // Replace query with parsed and validated data
    (request as { query: T }).query = result.data;
  };
}

export function validateParams<T>(schema: ZodSchema<T>) {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const result = schema.safeParse(request.params);

    if (!result.success) {
      throw new ValidationError('Invalid path parameters', {
        errors: result.error.flatten(),
      });
    }

    // Replace params with parsed and validated data
    (request as { params: T }).params = result.data;
  };
}

// Common validation schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const uuidParamSchema = z.object({
  id: z.string().uuid(),
});

export const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});
