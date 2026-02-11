import { Job } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import sharp from 'sharp';
import { prisma } from '../core/database/prisma.js';
import { downloadFile, uploadFile, generateStoragePath, generateThumbnailPath } from '../core/storage/minio.js';
import { actionRegistry } from '../plugins/actions/registry.js';
import { updateJobStatus } from '../services/job.service.js';
import { jobLogger } from '../utils/logger.js';
import { config } from '../config/index.js';
import type { JobData, JobResult, ActionContext, MediaFileInfo } from '../types/index.js';
import type { MediaType as PrismaMediaType, ResultType as PrismaResultType } from '@prisma/client';

const RESULT_TYPE_MAP: Record<string, PrismaResultType> = {
  file: 'FILE',
  json: 'JSON',
  files: 'FILES',
};

export async function processJob(job: Job<JobData, JobResult>): Promise<JobResult> {
  const startTime = Date.now();
  const { jobId, organizationId, mediaId, actionId, parameters } = job.data;
  const workerId = `worker-${process.pid}`;

  jobLogger.info({ jobId, actionId, mediaId }, 'Starting job processing');

  try {
    // Update job status to processing
    await updateJobStatus(jobId, 'PROCESSING', {
      workerId,
      startedAt: new Date(),
    });

    // Get action handler first (fail fast before downloading)
    const handler = actionRegistry.get(actionId);

    // Get media file info from database
    const mediaFile = await prisma.mediaFile.findUnique({
      where: { id: mediaId },
    });

    if (!mediaFile) {
      throw new Error(`Media file not found: ${mediaId}`);
    }

    // Download file from storage
    const { buffer: fileBuffer } = await downloadFile(mediaFile.storagePath);

    // Prepare action context
    const fileInfo: MediaFileInfo = {
      id: mediaFile.id,
      originalFilename: mediaFile.originalFilename,
      storedFilename: mediaFile.storedFilename,
      mimeType: mediaFile.mimeType,
      mediaType: mediaFile.mediaType.toLowerCase() as 'image' | 'audio',
      fileSizeBytes: mediaFile.fileSizeBytes,
      storagePath: mediaFile.storagePath,
      thumbnailPath: mediaFile.thumbnailPath,
      metadata: mediaFile.metadata as Record<string, unknown>,
      checksumMd5: mediaFile.checksumMd5,
      checksumSha256: mediaFile.checksumSha256,
    };

    const context: ActionContext = {
      file: fileBuffer,
      fileInfo,
      params: parameters,
      organizationId,
      userId: job.data.userId,
      jobId,
    };

    // Execute action
    const result = await handler.execute(context);
    const processingTimeMs = Date.now() - startTime;

    jobLogger.info(
      { jobId, actionId, processingTimeMs, resultType: result.type },
      'Action executed successfully'
    );

    // Handle result based on type
    let resultMediaId: string | undefined;
    let resultData = result.data;

    if (result.type === 'file' && result.file) {
      // Upload result file to storage
      const filename = result.filename || `${actionId}_${uuidv4()}.${getExtension(result.mimeType || 'application/octet-stream')}`;
      const storagePath = generateStoragePath(
        organizationId,
        fileInfo.mediaType,
        filename
      );

      await uploadFile(storagePath, result.file, result.mimeType || 'application/octet-stream');

      // Generate thumbnail for image results
      let thumbnailPath: string | null = null;
      const resultMediaType = getMediaTypeFromMime(result.mimeType || '') || mediaFile.mediaType;
      if (resultMediaType === 'IMAGE' && result.file.length > 0) {
        try {
          const thumbnail = await sharp(result.file)
            .resize(300, 300, { fit: 'cover', position: 'center' })
            .webp({ quality: 80 })
            .toBuffer();
          thumbnailPath = generateThumbnailPath(storagePath);
          await uploadFile(thumbnailPath, thumbnail, 'image/webp');
        } catch (thumbErr) {
          jobLogger.warn({ jobId, error: (thumbErr as Error).message }, 'Failed to generate thumbnail for result');
        }
      }

      // Create media file record for result
      const checksums = generateChecksums(result.file);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + config.limits.retentionDays);

      const resultMedia = await prisma.mediaFile.create({
        data: {
          organizationId,
          uploadedByUserId: job.data.userId,
          uploadedByApiKeyId: job.data.apiKeyId,
          originalFilename: filename,
          storedFilename: filename,
          mimeType: result.mimeType || 'application/octet-stream',
          mediaType: resultMediaType,
          fileSizeBytes: BigInt(result.file.length),
          storagePath,
          thumbnailPath,
          metadata: (result.data || {}) as object,
          checksumMd5: checksums.md5,
          checksumSha256: checksums.sha256,
          status: 'READY',
          expiresAt,
        },
      });

      resultMediaId = resultMedia.id;
    } else if (result.type === 'files' && result.files) {
      // Handle multiple files - create records for each
      const fileIds: string[] = [];

      for (const fileResult of result.files) {
        const storagePath = generateStoragePath(
          organizationId,
          fileInfo.mediaType,
          fileResult.filename
        );

        await uploadFile(storagePath, fileResult.buffer, fileResult.mimeType);

        const checksums = generateChecksums(fileResult.buffer);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + config.limits.retentionDays);

        const resultMedia = await prisma.mediaFile.create({
          data: {
            organizationId,
            uploadedByUserId: job.data.userId,
            uploadedByApiKeyId: job.data.apiKeyId,
            originalFilename: fileResult.filename,
            storedFilename: fileResult.filename,
            mimeType: fileResult.mimeType,
            mediaType: getMediaTypeFromMime(fileResult.mimeType) || mediaFile.mediaType,
            fileSizeBytes: BigInt(fileResult.buffer.length),
            storagePath,
            metadata: {},
            checksumMd5: checksums.md5,
            checksumSha256: checksums.sha256,
            status: 'READY',
            expiresAt,
          },
        });

        fileIds.push(resultMedia.id);
      }

      resultData = { ...result.data, fileIds };
    }

    // Update job as completed
    await updateJobStatus(jobId, 'COMPLETED', {
      completedAt: new Date(),
      resultType: RESULT_TYPE_MAP[result.type],
      resultMediaId,
      resultData: resultData || {},
      processingTimeMs,
    });

    jobLogger.info({ jobId, processingTimeMs }, 'Job completed successfully');

    return {
      success: true,
      resultType: result.type,
      resultMediaId,
      resultData,
      processingTimeMs,
    };
  } catch (error) {
    const processingTimeMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorCode = getErrorCode(error);

    jobLogger.error({ jobId, error: errorMessage, processingTimeMs }, 'Job failed');

    // Update job as failed
    await updateJobStatus(jobId, 'FAILED', {
      completedAt: new Date(),
      errorCode,
      errorMessage,
      processingTimeMs,
      retryCount: job.attemptsMade,
    });

    return {
      success: false,
      error: {
        code: errorCode,
        message: errorMessage,
      },
      processingTimeMs,
    };
  }
}

function generateChecksums(buffer: Buffer): { md5: string; sha256: string } {
  return {
    md5: crypto.createHash('md5').update(buffer).digest('hex'),
    sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
  };
}

function getExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/flac': 'flac',
    'audio/ogg': 'ogg',
    'application/json': 'json',
  };
  return map[mimeType] || 'bin';
}

function getMediaTypeFromMime(mimeType: string): PrismaMediaType | null {
  if (mimeType.startsWith('image/')) return 'IMAGE';
  if (mimeType.startsWith('audio/')) return 'AUDIO';
  return null;
}

function getErrorCode(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes('not found')) return 'NOT_FOUND';
    if (error.message.includes('timeout')) return 'TIMEOUT';
    if (error.message.includes('permission')) return 'PERMISSION_DENIED';
    if (error.message.includes('validation')) return 'VALIDATION_ERROR';
  }
  return 'PROCESSING_ERROR';
}
