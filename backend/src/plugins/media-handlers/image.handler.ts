import sharp from 'sharp';
import { config } from '../../config/index.js';
import { MediaProcessingError } from '../../utils/errors.js';
import type { MediaHandler, MediaMetadata } from './index.js';
import type { ImageMetadata, MediaType } from '../../types/index.js';

export interface ImageProcessingResult {
  mediaType: 'image';
  metadata: ImageMetadata;
  thumbnail?: Buffer;
}

async function validateFile(buffer: Buffer, mimeType: string): Promise<boolean> {
  try {
    const metadata = await sharp(buffer).metadata();

    // Check format
    if (!metadata.format) {
      return false;
    }

    // Check resolution limits
    if (metadata.width && metadata.width > config.media.image.maxResolution) {
      return false;
    }
    if (metadata.height && metadata.height > config.media.image.maxResolution) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

async function extractMetadata(buffer: Buffer): Promise<ImageMetadata> {
  try {
    const metadata = await sharp(buffer).metadata();

    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
      format: metadata.format || 'unknown',
      space: metadata.space,
      channels: metadata.channels,
      depth: metadata.depth,
      density: metadata.density,
      hasAlpha: metadata.hasAlpha,
    };
  } catch (error) {
    throw new MediaProcessingError('Failed to extract image metadata', {
      error: (error as Error).message,
    });
  }
}

async function generateThumbnail(buffer: Buffer): Promise<Buffer> {
  try {
    const { width, height, quality } = config.media.image.thumbnail;

    const thumbnail = await sharp(buffer)
      .resize(width, height, {
        fit: 'cover',
        position: 'center',
      })
      .webp({ quality })
      .toBuffer();

    return thumbnail;
  } catch (error) {
    throw new MediaProcessingError('Failed to generate thumbnail', {
      error: (error as Error).message,
    });
  }
}

export const imageHandler: MediaHandler = {
  mediaType: 'image' as MediaType,
  supportedMimeTypes: [...config.media.image.supportedMimeTypes],
  validateFile,
  extractMetadata,
  generateThumbnail,
};
