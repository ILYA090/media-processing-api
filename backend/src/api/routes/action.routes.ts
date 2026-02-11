import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { actionRegistry } from '../../plugins/actions/registry.js';
import { optionalAuthenticate } from '../../core/auth/middleware.js';
import type { MediaType } from '../../types/index.js';

export async function actionRoutes(fastify: FastifyInstance) {
  // List all actions
  fastify.get(
    '/',
    {
      onRequest: [optionalAuthenticate],
      schema: {
        description: 'List all available actions',
        tags: ['Actions'],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    actionId: { type: 'string' },
                    displayName: { type: 'string' },
                    buttonLabel: { type: 'string' },
                    description: { type: 'string' },
                    icon: { type: 'string' },
                    mediaType: { type: 'string' },
                    category: { type: 'string' },
                    inputSchema: { type: 'object', additionalProperties: true },
                    outputSchema: { type: 'object', additionalProperties: true },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const actions = actionRegistry.getAllActions();

      return reply.send({
        success: true,
        data: actions,
      });
    }
  );

  // List actions by media type
  fastify.get<{ Params: { mediaType: string } }>(
    '/:mediaType',
    {
      onRequest: [optionalAuthenticate],
      schema: {
        description: 'List actions for a specific media type',
        tags: ['Actions'],
        params: {
          type: 'object',
          required: ['mediaType'],
          properties: {
            mediaType: { type: 'string', enum: ['image', 'audio'] },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    actionId: { type: 'string' },
                    displayName: { type: 'string' },
                    buttonLabel: { type: 'string' },
                    description: { type: 'string' },
                    icon: { type: 'string' },
                    mediaType: { type: 'string' },
                    category: { type: 'string' },
                    inputSchema: { type: 'object', additionalProperties: true },
                    outputSchema: { type: 'object', additionalProperties: true },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { mediaType } = request.params;
      const actions = actionRegistry.getActionsByMediaType(mediaType as MediaType);

      return reply.send({
        success: true,
        data: actions,
      });
    }
  );

  // Get specific action
  fastify.get<{ Params: { mediaType: string; actionId: string } }>(
    '/:mediaType/:actionId',
    {
      onRequest: [optionalAuthenticate],
      schema: {
        description: 'Get details for a specific action',
        tags: ['Actions'],
        params: {
          type: 'object',
          required: ['mediaType', 'actionId'],
          properties: {
            mediaType: { type: 'string', enum: ['image', 'audio'] },
            actionId: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  actionId: { type: 'string' },
                  displayName: { type: 'string' },
                  buttonLabel: { type: 'string' },
                  description: { type: 'string' },
                  icon: { type: 'string' },
                  mediaType: { type: 'string' },
                  category: { type: 'string' },
                  inputSchema: { type: 'object', additionalProperties: true },
                  outputSchema: { type: 'object', additionalProperties: true },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { actionId } = request.params;
      const handler = actionRegistry.get(actionId);

      return reply.send({
        success: true,
        data: {
          actionId: handler.actionId,
          displayName: handler.displayName,
          buttonLabel: handler.buttonLabel,
          description: handler.description,
          icon: handler.icon,
          mediaType: handler.mediaType,
          category: handler.category,
          inputSchema: handler.inputSchema,
          outputSchema: handler.outputSchema,
        },
      });
    }
  );
}
