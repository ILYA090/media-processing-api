import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { errorHandler } from './api/middleware/error-handler.js';
import { createUsageRecord } from './services/usage.service.js';
import type { UsageActionType } from './types/index.js';

// Import routes
import { authRoutes } from './api/routes/auth.routes.js';
import { organizationRoutes } from './api/routes/organization.routes.js';
import { userRoutes } from './api/routes/user.routes.js';
import { apiKeyRoutes } from './api/routes/apikey.routes.js';
import { mediaRoutes } from './api/routes/media.routes.js';
import { actionRoutes } from './api/routes/action.routes.js';
import { jobRoutes } from './api/routes/job.routes.js';
import { usageRoutes } from './api/routes/usage.routes.js';
import { systemRoutes } from './api/routes/system.routes.js';
import { adminRoutes } from './api/routes/admin.routes.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.logging.level,
      transport: config.isDev
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
    },
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
  });

  // Decorate request with authContext
  app.decorateRequest('authContext', undefined);

  // Error handler
  app.setErrorHandler(errorHandler);

  // CORS
  await app.register(cors, {
    origin: config.isDev
      ? ['http://localhost:5173', 'http://localhost:3001']
      : config.server.baseUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID'],
  });

  // JWT
  await app.register(jwt, {
    secret: config.auth.jwtSecret,
  });

  // Multipart (file uploads)
  await app.register(multipart, {
    limits: {
      fileSize: config.limits.maxFileSizeBytes,
      files: 1,
    },
  });

  // Rate limiting
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (request) => {
      // Use API key or IP for rate limiting
      const apiKey = request.headers['x-api-key'];
      if (apiKey && typeof apiKey === 'string') {
        return `apikey:${apiKey.substring(0, 12)}`;
      }
      return request.ip;
    },
    errorResponseBuilder: () => ({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later',
      },
    }),
  });

  // Swagger documentation
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Media Processing API',
        description: 'API for media file processing with image and audio transformations',
        version: '1.0.0',
      },
      servers: [
        {
          url: config.server.baseUrl,
          description: config.isDev ? 'Development server' : 'Production server',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
          apiKeyAuth: {
            type: 'apiKey',
            in: 'header',
            name: 'X-API-Key',
          },
        },
      },
      security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });

  // Usage tracking hook
  app.addHook('onResponse', async (request, reply) => {
    if (!request.authContext?.organizationId) return;
    const url = request.url;
    // Skip health/docs/static endpoints
    if (!url.startsWith('/api/v1/') || url.includes('/docs') || url.includes('/health')) return;

    let actionType: UsageActionType = 'api_call';
    if (url.includes('/upload')) actionType = 'upload';
    else if (url.includes('/process') && request.method === 'POST') actionType = 'process';
    else if (url.includes('/download')) actionType = 'download';

    try {
      await createUsageRecord({
        organizationId: request.authContext.organizationId,
        userId: request.authContext.user?.id,
        apiKeyId: request.authContext.apiKey?.id,
        actionType,
        requestIp: request.ip,
        userAgent: request.headers['user-agent'],
        endpoint: url.split('?')[0] || url,
        httpMethod: request.method,
        responseStatus: reply.statusCode,
      });
    } catch (err) {
      logger.warn({ err }, 'Usage tracking failed');
    }
  });

  // Register routes
  await app.register(systemRoutes, { prefix: '/api/v1' });
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(organizationRoutes, { prefix: '/api/v1/organizations' });
  await app.register(userRoutes, { prefix: '/api/v1/organizations' });
  await app.register(apiKeyRoutes, { prefix: '/api/v1/api-keys' });
  await app.register(mediaRoutes, { prefix: '/api/v1/media' });
  await app.register(actionRoutes, { prefix: '/api/v1/actions' });
  await app.register(jobRoutes, { prefix: '/api/v1' });
  await app.register(usageRoutes, { prefix: '/api/v1/usage' });
  await app.register(adminRoutes, { prefix: '/api/v1/admin' });

  // Graceful shutdown
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  signals.forEach((signal) => {
    process.on(signal, async () => {
      logger.info({ signal }, 'Received shutdown signal');
      try {
        await app.close();
        logger.info('Server closed gracefully');
        process.exit(0);
      } catch (err) {
        logger.error({ err }, 'Error during shutdown');
        process.exit(1);
      }
    });
  });

  return app;
}
