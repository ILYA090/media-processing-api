import { FastifyRequest, FastifyReply } from 'fastify';
import { createUsageRecord } from '../../services/usage.service.js';
import { logger } from '../../utils/logger.js';
import type { UsageActionType } from '../../types/index.js';

export function createUsageTracker(actionType: UsageActionType) {
  return async function trackUsage(
    request: FastifyRequest,
    reply: FastifyReply,
    payload: unknown
  ): Promise<void> {
    // Skip if not authenticated
    if (!request.authContext?.organizationId) {
      return;
    }

    const responseStatus = reply.statusCode;

    try {
      await createUsageRecord({
        organizationId: request.authContext.organizationId,
        userId: request.authContext.user?.id,
        apiKeyId: request.authContext.apiKey?.id,
        actionType,
        requestIp: request.ip,
        userAgent: request.headers['user-agent'],
        endpoint: request.url,
        httpMethod: request.method,
        responseStatus,
      });
    } catch (error) {
      // Log but don't fail the request
      logger.error({ error, url: request.url }, 'Failed to track usage');
    }
  };
}

// Middleware to track usage after response
export function usageTrackerPlugin(actionType: UsageActionType) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    reply.addHook('onSend', createUsageTracker(actionType));
  };
}

// Helper to extract action type from URL
export function getActionTypeFromUrl(url: string): UsageActionType {
  if (url.includes('/upload')) return 'upload';
  if (url.includes('/process')) return 'process';
  if (url.includes('/download')) return 'download';
  return 'api_call';
}
