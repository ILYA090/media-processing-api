import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../../core/auth/middleware.js';
import * as mediaService from '../../services/media.service.js';
import { ValidationError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import type { MediaType } from '../../types/index.js';

export async function mediaRoutes(fastify: FastifyInstance) {
  // Upload media
  fastify.post(
    '/upload',
    {
      onRequest: [authenticate],
      schema: {
        description: 'Upload a media file',
        tags: ['Media'],
        security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
        consumes: ['multipart/form-data'],
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  originalFilename: { type: 'string' },
                  mimeType: { type: 'string' },
                  mediaType: { type: 'string' },
                  fileSizeBytes: { type: 'string' },
                  metadata: { type: 'object' },
                  status: { type: 'string' },
                  thumbnailUrl: { type: 'string' },
                  createdAt: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const file = await request.file();

      if (!file) {
        throw new ValidationError('No file provided');
      }

      const buffer = await file.toBuffer();
      const organizationId = request.authContext!.organizationId;
      const userId = request.authContext?.user?.id;
      const apiKeyId = request.authContext?.apiKey?.id;

      const media = await mediaService.uploadMedia({
        organizationId,
        userId,
        apiKeyId,
        buffer,
        filename: file.filename,
        mimeType: file.mimetype,
      });

      return reply.status(201).send({
        success: true,
        data: mediaService.formatMediaResponse(media),
      });
    }
  );

  // Upload from URL
  fastify.post<{ Body: { url: string } }>(
    '/upload-url',
    {
      onRequest: [authenticate],
      schema: {
        description: 'Upload a media file from a URL',
        tags: ['Media'],
        security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
        body: {
          type: 'object',
          required: ['url'],
          properties: {
            url: { type: 'string', format: 'uri' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  originalFilename: { type: 'string' },
                  mimeType: { type: 'string' },
                  mediaType: { type: 'string' },
                  fileSizeBytes: { type: 'string' },
                  metadata: { type: 'object', additionalProperties: true },
                  status: { type: 'string' },
                  thumbnailUrl: { type: 'string' },
                  createdAt: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { url } = request.body;

      // Validate URL
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
      } catch {
        throw new ValidationError('Invalid URL');
      }

      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new ValidationError('Only HTTP and HTTPS URLs are supported');
      }

      // Fetch the file
      logger.info({ url }, 'Fetching media from URL');
      let response: Response;
      try {
        response = await fetch(url, {
          headers: { 'User-Agent': 'MediaProcessingAPI/1.0' },
          redirect: 'follow',
          signal: AbortSignal.timeout(30000),
        });
      } catch (err) {
        throw new ValidationError(`Failed to fetch URL: ${(err as Error).message}`);
      }

      if (!response.ok) {
        throw new ValidationError(`URL returned HTTP ${response.status}`);
      }

      const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() || '';
      const buffer = Buffer.from(await response.arrayBuffer());

      if (buffer.length === 0) {
        throw new ValidationError('URL returned empty response');
      }

      // Extract filename from URL path
      const pathSegments = parsedUrl.pathname.split('/');
      const filename = decodeURIComponent(pathSegments[pathSegments.length - 1] || 'download');

      // Determine MIME type: prefer content-type header, fall back to extension
      let mimeType = contentType;
      if (!mimeType || mimeType === 'application/octet-stream') {
        const ext = filename.split('.').pop()?.toLowerCase();
        const extMap: Record<string, string> = {
          jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
          webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp', tiff: 'image/tiff',
          mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac',
          ogg: 'audio/ogg', m4a: 'audio/mp4', webm: 'audio/webm',
        };
        mimeType = (ext && extMap[ext]) || contentType || 'application/octet-stream';
      }

      const organizationId = request.authContext!.organizationId;
      const userId = request.authContext?.user?.id;
      const apiKeyId = request.authContext?.apiKey?.id;

      const media = await mediaService.uploadMedia({
        organizationId,
        userId,
        apiKeyId,
        buffer,
        filename,
        mimeType,
      });

      return reply.status(201).send({
        success: true,
        data: mediaService.formatMediaResponse(media),
      });
    }
  );

  // List media
  fastify.get<{
    Querystring: {
      page?: string;
      limit?: string;
      mediaType?: string;
      status?: string;
    };
  }>(
    '/',
    {
      onRequest: [authenticate],
      schema: {
        description: 'List media files',
        tags: ['Media'],
        security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'string' },
            limit: { type: 'string' },
            mediaType: { type: 'string', enum: ['image', 'audio'] },
            status: { type: 'string', enum: ['processing', 'ready', 'failed'] },
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
                    id: { type: 'string' },
                    originalFilename: { type: 'string' },
                    mimeType: { type: 'string' },
                    mediaType: { type: 'string' },
                    fileSizeBytes: { type: 'string' },
                    status: { type: 'string' },
                    thumbnailUrl: { type: 'string' },
                    createdAt: { type: 'string' },
                  },
                },
              },
              meta: {
                type: 'object',
                properties: {
                  page: { type: 'number' },
                  limit: { type: 'number' },
                  total: { type: 'number' },
                  totalPages: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const organizationId = request.authContext!.organizationId;
      const userId = request.authContext?.user?.id;
      const page = parseInt(request.query.page || '1', 10);
      const limit = Math.min(parseInt(request.query.limit || '20', 10), 100);

      const { media, total } = await mediaService.getMedia(organizationId, {
        page,
        limit,
        mediaType: request.query.mediaType as MediaType | undefined,
        status: request.query.status,
        userId,
      });

      return reply.send({
        success: true,
        data: media.map(mediaService.formatMediaResponse),
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    }
  );

  // Get media by ID
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    {
      onRequest: [authenticate],
      schema: {
        description: 'Get media file details',
        tags: ['Media'],
        security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
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
                  id: { type: 'string' },
                  originalFilename: { type: 'string' },
                  mimeType: { type: 'string' },
                  mediaType: { type: 'string' },
                  fileSizeBytes: { type: 'string' },
                  metadata: { type: 'object' },
                  status: { type: 'string' },
                  thumbnailUrl: { type: 'string' },
                  createdAt: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const organizationId = request.authContext!.organizationId;
      const userId = request.authContext?.user?.id;

      const media = await mediaService.getMediaById(organizationId, id, userId);

      return reply.send({
        success: true,
        data: mediaService.formatMediaResponse(media),
      });
    }
  );

  // Download media
  fastify.get<{ Params: { id: string } }>(
    '/:id/download',
    {
      onRequest: [authenticate],
      schema: {
        description: 'Download media file',
        tags: ['Media'],
        security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const organizationId = request.authContext!.organizationId;
      const userId = request.authContext?.user?.id;

      const { buffer, filename, contentType } = await mediaService.downloadMedia(
        organizationId,
        id,
        userId
      );

      return reply
        .header('Content-Type', contentType)
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(buffer);
    }
  );

  // Get thumbnail
  fastify.get<{ Params: { id: string } }>(
    '/:id/thumbnail',
    {
      onRequest: [authenticate],
      schema: {
        description: 'Get media thumbnail',
        tags: ['Media'],
        security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const organizationId = request.authContext!.organizationId;
      const userId = request.authContext?.user?.id;

      const { buffer, contentType } = await mediaService.getThumbnail(organizationId, id, userId);

      return reply.header('Content-Type', contentType).send(buffer);
    }
  );

  // Delete media
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    {
      onRequest: [authenticate],
      schema: {
        description: 'Delete media file',
        tags: ['Media'],
        security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
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
                  message: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const organizationId = request.authContext!.organizationId;
      const userId = request.authContext?.user?.id;

      await mediaService.deleteMedia(organizationId, id, userId);

      return reply.send({
        success: true,
        data: { message: 'Media file deleted successfully' },
      });
    }
  );
}
