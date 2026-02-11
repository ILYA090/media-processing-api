import * as mm from 'music-metadata';
import { config } from '../../config/index.js';
import { MediaProcessingError } from '../../utils/errors.js';
import type { MediaHandler } from './index.js';
import type { AudioMetadata, MediaType } from '../../types/index.js';

export interface AudioProcessingResult {
  mediaType: 'audio';
  metadata: AudioMetadata;
  thumbnail?: undefined;
}

async function validateFile(buffer: Buffer, mimeType: string): Promise<boolean> {
  try {
    const metadata = await mm.parseBuffer(buffer, { mimeType });

    // Check duration limit
    if (metadata.format.duration) {
      const maxDurationSeconds = config.media.audio.maxDurationMinutes * 60;
      if (metadata.format.duration > maxDurationSeconds) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

async function extractMetadata(buffer: Buffer): Promise<AudioMetadata> {
  try {
    const metadata = await mm.parseBuffer(buffer);

    return {
      duration: metadata.format.duration || 0,
      bitrate: metadata.format.bitrate,
      sampleRate: metadata.format.sampleRate,
      channels: metadata.format.numberOfChannels,
      format: metadata.format.container,
      codec: metadata.format.codec,
    };
  } catch (error) {
    throw new MediaProcessingError('Failed to extract audio metadata', {
      error: (error as Error).message,
    });
  }
}

export const audioHandler: MediaHandler = {
  mediaType: 'audio' as MediaType,
  supportedMimeTypes: [...config.media.audio.supportedMimeTypes],
  validateFile,
  extractMetadata,
};
