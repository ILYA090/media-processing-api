import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../core/database/prisma.js';
import {
  uploadFile,
  downloadFile,
  deleteFile,
  generateStoragePath,
  generateThumbnailPath,
  getSignedDownloadUrl,
} from '../core/storage/minio.js';
import { processMedia, getMediaTypeFromMimeType } from '../plugins/media-handlers/index.js';
import { config } from '../config/index.js';
import { NotFoundError, FileTooLargeError, UnsupportedMediaTypeError } from '../utils/errors.js';
import type { MediaFile, MediaType as PrismaMediaType } from '@prisma/client';
import type { MediaType } from '../types/index.js';

export interface UploadMediaData {
  organizationId: string;
  userId?: string;
  apiKeyId?: string;
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

export interface MediaFileResponse {
  id: string;
  originalFilename: string;
  mimeType: string;
  mediaType: string;
  fileSizeBytes: string;
  metadata: unknown;
  status: string;
  thumbnailUrl?: string;
  createdAt: string;
}

function generateChecksums(buffer: Buffer): { md5: string; sha256: string } {
  return {
    md5: crypto.createHash('md5').update(buffer).digest('hex'),
    sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
  };
}

function generateStoredFilename(originalFilename: string): string {
  const ext = originalFilename.split('.').pop() || '';
  const id = uuidv4();
  return ext ? `${id}.${ext}` : id;
}

export async function uploadMedia(data: UploadMediaData): Promise<MediaFile> {
  const { organizationId, userId, apiKeyId, buffer, filename, mimeType } = data;

  // Check file size
  const fileSizeBytes = buffer.length;
  if (fileSizeBytes > config.limits.maxFileSizeBytes) {
    throw new FileTooLargeError(config.limits.maxFileSizeMB);
  }

  // Determine media type
  const mediaType = getMediaTypeFromMimeType(mimeType);
  if (!mediaType) {
    throw new UnsupportedMediaTypeError(mimeType);
  }

  // Process media (validate, extract metadata, generate thumbnail)
  const result = await processMedia(buffer, mimeType);

  // Generate filenames and paths
  const storedFilename = generateStoredFilename(filename);
  const storagePath = generateStoragePath(organizationId, mediaType, storedFilename);
  const checksums = generateChecksums(buffer);

  // Calculate expiry date
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + config.limits.retentionDays);

  // Upload file to storage
  await uploadFile(storagePath, buffer, mimeType, {
    originalFilename: filename,
    organizationId,
  });

  // Upload thumbnail if available
  let thumbnailPath: string | null = null;
  if (result.thumbnail) {
    thumbnailPath = generateThumbnailPath(storagePath);
    await uploadFile(thumbnailPath, result.thumbnail, 'image/webp');
  }

  // Create database record
  const mediaFile = await prisma.mediaFile.create({
    data: {
      organizationId,
      uploadedByUserId: userId,
      uploadedByApiKeyId: apiKeyId,
      originalFilename: filename,
      storedFilename,
      mimeType,
      mediaType: mediaType.toUpperCase() as PrismaMediaType,
      fileSizeBytes: BigInt(fileSizeBytes),
      storagePath,
      thumbnailPath,
      metadata: result.metadata as object,
      checksumMd5: checksums.md5,
      checksumSha256: checksums.sha256,
      status: 'READY',
      expiresAt,
    },
  });

  return mediaFile;
}

export async function getMedia(
  organizationId: string,
  options?: {
    page?: number;
    limit?: number;
    mediaType?: MediaType;
    status?: string;
    userId?: string;
  }
): Promise<{ media: MediaFile[]; total: number }> {
  const page = options?.page || 1;
  const limit = options?.limit || 20;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {
    organizationId,
    status: { not: 'DELETED' },
  };

  if (options?.userId) {
    where.uploadedByUserId = options.userId;
  }

  if (options?.mediaType) {
    where.mediaType = options.mediaType.toUpperCase();
  }

  if (options?.status) {
    where.status = options.status.toUpperCase();
  }

  const [media, total] = await Promise.all([
    prisma.mediaFile.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.mediaFile.count({ where }),
  ]);

  return { media, total };
}

export async function getMediaById(organizationId: string, mediaId: string, userId?: string): Promise<MediaFile> {
  const where: Record<string, unknown> = {
    id: mediaId,
    organizationId,
    status: { not: 'DELETED' },
  };

  if (userId) {
    where.uploadedByUserId = userId;
  }

  const media = await prisma.mediaFile.findFirst({ where });

  if (!media) {
    throw new NotFoundError('Media file', mediaId);
  }

  return media;
}

export async function getMediaDownloadUrl(
  organizationId: string,
  mediaId: string,
  expiresIn: number = 3600
): Promise<string> {
  const media = await getMediaById(organizationId, mediaId);
  return getSignedDownloadUrl(media.storagePath, expiresIn);
}

export async function downloadMedia(
  organizationId: string,
  mediaId: string,
  userId?: string
): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
  const media = await getMediaById(organizationId, mediaId, userId);
  const { buffer, contentType } = await downloadFile(media.storagePath);

  return {
    buffer,
    filename: media.originalFilename,
    contentType,
  };
}

export async function getThumbnail(
  organizationId: string,
  mediaId: string,
  userId?: string
): Promise<{ buffer: Buffer; contentType: string }> {
  const media = await getMediaById(organizationId, mediaId, userId);

  if (!media.thumbnailPath) {
    throw new NotFoundError('Thumbnail', mediaId);
  }

  return downloadFile(media.thumbnailPath);
}

export async function deleteMedia(organizationId: string, mediaId: string, userId?: string): Promise<void> {
  const media = await getMediaById(organizationId, mediaId, userId);

  // Soft delete in database
  await prisma.mediaFile.update({
    where: { id: mediaId },
    data: { status: 'DELETED' },
  });

  // Delete from storage (can be done async)
  try {
    await deleteFile(media.storagePath);
    if (media.thumbnailPath) {
      await deleteFile(media.thumbnailPath);
    }
  } catch {
    // Log but don't fail - storage cleanup can be retried
  }
}

export function formatMediaResponse(media: MediaFile): MediaFileResponse {
  return {
    id: media.id,
    originalFilename: media.originalFilename,
    mimeType: media.mimeType,
    mediaType: media.mediaType.toLowerCase(),
    fileSizeBytes: media.fileSizeBytes.toString(),
    metadata: media.metadata,
    status: media.status.toLowerCase(),
    thumbnailUrl: media.thumbnailPath
      ? `/api/v1/media/${media.id}/thumbnail`
      : undefined,
    createdAt: media.createdAt.toISOString(),
  };
}
