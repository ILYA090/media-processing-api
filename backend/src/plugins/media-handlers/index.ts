import { config } from '../../config/index.js';
import { UnsupportedMediaTypeError } from '../../utils/errors.js';
import { imageHandler, type ImageProcessingResult } from './image.handler.js';
import { audioHandler, type AudioProcessingResult } from './audio.handler.js';
import type { MediaType, ImageMetadata, AudioMetadata } from '../../types/index.js';

export type MediaProcessingResult = ImageProcessingResult | AudioProcessingResult;
export type MediaMetadata = ImageMetadata | AudioMetadata;

export interface MediaHandler {
  mediaType: MediaType;
  supportedMimeTypes: string[];
  validateFile: (buffer: Buffer, mimeType: string) => Promise<boolean>;
  extractMetadata: (buffer: Buffer) => Promise<MediaMetadata>;
  generateThumbnail?: (buffer: Buffer) => Promise<Buffer>;
}

const handlers: Map<MediaType, MediaHandler> = new Map([
  ['image', imageHandler],
  ['audio', audioHandler],
]);

export function getMediaTypeFromMimeType(mimeType: string): MediaType | null {
  const normalizedMime = mimeType.toLowerCase();

  if (config.media.image.supportedMimeTypes.includes(normalizedMime)) {
    return 'image';
  }

  if (config.media.audio.supportedMimeTypes.includes(normalizedMime)) {
    return 'audio';
  }

  return null;
}

export function getHandler(mediaType: MediaType): MediaHandler {
  const handler = handlers.get(mediaType);
  if (!handler) {
    throw new UnsupportedMediaTypeError(mediaType);
  }
  return handler;
}

export function isSupported(mimeType: string): boolean {
  return getMediaTypeFromMimeType(mimeType) !== null;
}

export async function processMedia(
  buffer: Buffer,
  mimeType: string
): Promise<MediaProcessingResult> {
  const mediaType = getMediaTypeFromMimeType(mimeType);

  if (!mediaType) {
    throw new UnsupportedMediaTypeError(mimeType, [
      ...config.media.image.supportedMimeTypes,
      ...config.media.audio.supportedMimeTypes,
    ]);
  }

  const handler = getHandler(mediaType);

  // Validate file
  const isValid = await handler.validateFile(buffer, mimeType);
  if (!isValid) {
    throw new UnsupportedMediaTypeError(mimeType);
  }

  // Extract metadata
  const metadata = await handler.extractMetadata(buffer);

  // Generate thumbnail for images
  let thumbnail: Buffer | undefined;
  if (mediaType === 'image' && handler.generateThumbnail) {
    thumbnail = await handler.generateThumbnail(buffer);
  }

  return {
    mediaType,
    metadata,
    thumbnail,
  };
}

export { imageHandler, audioHandler };
export type { ImageProcessingResult } from './image.handler.js';
export type { AudioProcessingResult } from './audio.handler.js';
