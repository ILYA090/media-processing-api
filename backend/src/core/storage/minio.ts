import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Upload } from '@aws-sdk/lib-storage';
import { Readable } from 'stream';
import { config } from '../../config/index.js';
import { storageLogger } from '../../utils/logger.js';
import { StorageError } from '../../utils/errors.js';

const s3Client = new S3Client({
  endpoint: `http${config.minio.useSSL ? 's' : ''}://${config.minio.endpoint}:${config.minio.port}`,
  region: 'us-east-1',
  credentials: {
    accessKeyId: config.minio.accessKey,
    secretAccessKey: config.minio.secretKey,
  },
  forcePathStyle: true,
});

const bucket = config.minio.bucket;

export async function ensureBucket(): Promise<void> {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: bucket }));
    storageLogger.info({ bucket }, 'Bucket exists');
  } catch (error: unknown) {
    if ((error as { name?: string }).name === 'NotFound') {
      storageLogger.info({ bucket }, 'Creating bucket');
      await s3Client.send(new CreateBucketCommand({ Bucket: bucket }));
      storageLogger.info({ bucket }, 'Bucket created');
    } else {
      throw error;
    }
  }
}

export async function uploadFile(
  key: string,
  body: Buffer | Readable,
  contentType: string,
  metadata?: Record<string, string>
): Promise<{ etag: string }> {
  try {
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        Metadata: metadata,
      },
    });

    const result = await upload.done();
    storageLogger.debug({ key, contentType }, 'File uploaded');

    return { etag: result.ETag?.replace(/"/g, '') || '' };
  } catch (error) {
    storageLogger.error({ error, key }, 'Failed to upload file');
    throw new StorageError('upload', (error as Error).message);
  }
}

export async function downloadFile(key: string): Promise<{ buffer: Buffer; contentType: string }> {
  try {
    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );

    const stream = response.Body as Readable;
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }

    const buffer = Buffer.concat(chunks);
    storageLogger.debug({ key, size: buffer.length }, 'File downloaded');

    return {
      buffer,
      contentType: response.ContentType || 'application/octet-stream',
    };
  } catch (error) {
    storageLogger.error({ error, key }, 'Failed to download file');
    throw new StorageError('download', (error as Error).message);
  }
}

export async function deleteFile(key: string): Promise<void> {
  try {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );
    storageLogger.debug({ key }, 'File deleted');
  } catch (error) {
    storageLogger.error({ error, key }, 'Failed to delete file');
    throw new StorageError('delete', (error as Error).message);
  }
}

export async function fileExists(key: string): Promise<boolean> {
  try {
    await s3Client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );
    return true;
  } catch (error: unknown) {
    if ((error as { name?: string }).name === 'NotFound') {
      return false;
    }
    throw new StorageError('check', (error as Error).message);
  }
}

export async function getFileMetadata(key: string): Promise<{
  contentType: string;
  contentLength: number;
  lastModified: Date;
  metadata: Record<string, string>;
}> {
  try {
    const response = await s3Client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );

    return {
      contentType: response.ContentType || 'application/octet-stream',
      contentLength: response.ContentLength || 0,
      lastModified: response.LastModified || new Date(),
      metadata: response.Metadata || {},
    };
  } catch (error) {
    storageLogger.error({ error, key }, 'Failed to get file metadata');
    throw new StorageError('metadata', (error as Error).message);
  }
}

export async function getSignedDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
  try {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn });
    return url;
  } catch (error) {
    storageLogger.error({ error, key }, 'Failed to generate signed URL');
    throw new StorageError('signUrl', (error as Error).message);
  }
}

export async function getSignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = 3600
): Promise<string> {
  try {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn });
    return url;
  } catch (error) {
    storageLogger.error({ error, key }, 'Failed to generate signed upload URL');
    throw new StorageError('signUploadUrl', (error as Error).message);
  }
}

export async function listFiles(prefix: string): Promise<string[]> {
  try {
    const response = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
      })
    );

    return (response.Contents || []).map((item) => item.Key || '').filter(Boolean);
  } catch (error) {
    storageLogger.error({ error, prefix }, 'Failed to list files');
    throw new StorageError('list', (error as Error).message);
  }
}

export function generateStoragePath(
  organizationId: string,
  mediaType: 'image' | 'audio',
  filename: string
): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${organizationId}/${mediaType}/${year}/${month}/${day}/${filename}`;
}

export function generateThumbnailPath(storagePath: string): string {
  const parts = storagePath.split('/');
  const filename = parts.pop() || '';
  const nameWithoutExt = filename.split('.').slice(0, -1).join('.');
  return [...parts, 'thumbnails', `${nameWithoutExt}_thumb.webp`].join('/');
}

export async function checkStorageConnection(): Promise<boolean> {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: bucket }));
    return true;
  } catch (error) {
    storageLogger.error({ error }, 'Storage connection check failed');
    return false;
  }
}
