import { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { AppError, isAppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

export function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Log the error
  logger.error(
    {
      err: error,
      requestId: request.id,
      method: request.method,
      url: request.url,
    },
    'Request error'
  );

  // Handle AppError (our custom errors)
  if (isAppError(error)) {
    return reply.status(error.statusCode).send({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    return reply.status(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: {
          errors: error.flatten(),
        },
      },
    });
  }

  // Handle Fastify validation errors
  if ((error as FastifyError).validation) {
    return reply.status(400).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: {
          validation: (error as FastifyError).validation,
        },
      },
    });
  }

  // Handle JWT errors
  if (error.message.includes('jwt') || error.message.includes('token')) {
    return reply.status(401).send({
      success: false,
      error: {
        code: 'AUTHENTICATION_ERROR',
        message: 'Authentication failed',
      },
    });
  }

  // Handle Prisma errors
  if (error.constructor.name === 'PrismaClientKnownRequestError') {
    const prismaError = error as { code: string; meta?: { target?: string[] } };

    switch (prismaError.code) {
      case 'P2002':
        return reply.status(409).send({
          success: false,
          error: {
            code: 'DUPLICATE',
            message: 'A record with this value already exists',
            details: {
              field: prismaError.meta?.target?.[0],
            },
          },
        });
      case 'P2025':
        return reply.status(404).send({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Record not found',
          },
        });
      default:
        return reply.status(500).send({
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'Database operation failed',
          },
        });
    }
  }

  // Default error response
  const statusCode = (error as FastifyError).statusCode || 500;
  const message = statusCode === 500 ? 'Internal server error' : error.message;

  return reply.status(statusCode).send({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message,
    },
  });
}
