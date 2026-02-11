import * as mm from 'music-metadata';
import { BaseActionHandler } from '../base.js';
import type { ActionContext, ActionResult, ValidationResult } from '../../../types/index.js';

export class AudAnalyzeHandler extends BaseActionHandler {
  readonly actionId = 'aud_analyze';
  readonly displayName = 'Analyze Audio';
  readonly buttonLabel = 'Analyze';
  readonly description = 'Extract detailed audio analysis and metadata';
  readonly icon = 'analytics';
  readonly mediaType = 'audio' as const;
  readonly category = 'process' as const;

  readonly inputSchema = {
    type: 'object',
    properties: {
      includeNativeMetadata: {
        type: 'boolean',
        default: false,
        description: 'Include native format-specific metadata',
      },
    },
  };

  readonly outputSchema = {
    type: 'object',
    properties: {
      format: {
        type: 'object',
        properties: {
          container: { type: 'string' },
          codec: { type: 'string' },
          duration: { type: 'number' },
          bitrate: { type: 'number' },
          sampleRate: { type: 'number' },
          channels: { type: 'number' },
          bitsPerSample: { type: 'number' },
        },
      },
      common: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          artist: { type: 'string' },
          album: { type: 'string' },
          year: { type: 'number' },
          genre: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  };

  validate(params: Record<string, unknown>): ValidationResult {
    return { valid: true };
  }

  async execute(context: ActionContext): Promise<ActionResult> {
    const includeNative = context.params.includeNativeMetadata as boolean;

    const metadata = await mm.parseBuffer(context.file, {
      mimeType: context.fileInfo.mimeType,
    });

    const analysis: Record<string, unknown> = {
      format: {
        container: metadata.format.container,
        codec: metadata.format.codec,
        duration: metadata.format.duration,
        bitrate: metadata.format.bitrate,
        sampleRate: metadata.format.sampleRate,
        channels: metadata.format.numberOfChannels,
        bitsPerSample: metadata.format.bitsPerSample,
        lossless: metadata.format.lossless,
      },
      common: {
        title: metadata.common.title,
        artist: metadata.common.artist,
        artists: metadata.common.artists,
        album: metadata.common.album,
        year: metadata.common.year,
        track: metadata.common.track,
        genre: metadata.common.genre,
        composer: metadata.common.composer,
        albumartist: metadata.common.albumartist,
        comment: metadata.common.comment,
        bpm: metadata.common.bpm,
      },
    };

    // Include native metadata if requested
    if (includeNative && metadata.native) {
      analysis.native = Object.fromEntries(
        Object.entries(metadata.native).map(([key, tags]) => [
          key,
          tags.slice(0, 50), // Limit to first 50 tags
        ])
      );
    }

    // Quality assessment
    analysis.quality = {
      isLossless: metadata.format.lossless || false,
      bitrateKbps: metadata.format.bitrate
        ? Math.round(metadata.format.bitrate / 1000)
        : null,
      qualityRating: getQualityRating(metadata.format.bitrate, metadata.format.lossless),
    };

    return {
      type: 'json',
      data: analysis,
    };
  }
}

function getQualityRating(bitrate?: number, lossless?: boolean): string {
  if (lossless) return 'lossless';
  if (!bitrate) return 'unknown';

  const kbps = bitrate / 1000;
  if (kbps >= 256) return 'high';
  if (kbps >= 128) return 'medium';
  return 'low';
}
