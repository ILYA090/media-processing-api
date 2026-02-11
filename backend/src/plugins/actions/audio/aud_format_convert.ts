import ffmpeg from 'fluent-ffmpeg';
import { Readable, PassThrough } from 'stream';
import { BaseActionHandler } from '../base.js';
import type { ActionContext, ActionResult, ValidationResult } from '../../../types/index.js';

const FORMAT_TO_MIME: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  flac: 'audio/flac',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  webm: 'audio/webm',
};

export class AudFormatConvertHandler extends BaseActionHandler {
  readonly actionId = 'aud_format_convert';
  readonly displayName = 'Convert Format';
  readonly buttonLabel = 'Convert';
  readonly description = 'Convert audio to a different format';
  readonly icon = 'swap';
  readonly mediaType = 'audio' as const;
  readonly category = 'modify' as const;

  readonly inputSchema = {
    type: 'object',
    properties: {
      format: {
        type: 'string',
        enum: ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'webm'],
        description: 'Target audio format',
      },
      bitrate: {
        type: 'number',
        enum: [64, 96, 128, 192, 256, 320],
        default: 192,
        description: 'Audio bitrate in kbps (for lossy formats)',
      },
      sampleRate: {
        type: 'number',
        enum: [22050, 44100, 48000, 96000],
        default: 44100,
        description: 'Sample rate in Hz',
      },
    },
    required: ['format'],
  };

  readonly outputSchema = {
    type: 'object',
    properties: {
      format: { type: 'string' },
      size: { type: 'number' },
    },
  };

  validate(params: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];

    const requiredResult = this.validateRequiredParams(params, ['format']);
    if (!requiredResult.valid) {
      return requiredResult;
    }

    const formatError = this.validateEnum(params.format, 'format', [
      'mp3',
      'wav',
      'flac',
      'ogg',
      'm4a',
      'webm',
    ]);
    if (formatError) errors.push(formatError);

    if (params.bitrate !== undefined) {
      const validBitrates = [64, 96, 128, 192, 256, 320];
      if (!validBitrates.includes(params.bitrate as number)) {
        errors.push(`bitrate must be one of: ${validBitrates.join(', ')}`);
      }
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  async execute(context: ActionContext): Promise<ActionResult> {
    const format = context.params.format as string;
    const bitrate = (context.params.bitrate as number) || 192;
    const sampleRate = (context.params.sampleRate as number) || 44100;

    return new Promise((resolve, reject) => {
      const inputStream = new Readable();
      inputStream.push(context.file);
      inputStream.push(null);

      const outputChunks: Buffer[] = [];
      const outputStream = new PassThrough();

      outputStream.on('data', (chunk) => outputChunks.push(chunk));
      outputStream.on('end', () => {
        const buffer = Buffer.concat(outputChunks);
        const mimeType = FORMAT_TO_MIME[format] || 'application/octet-stream';

        resolve({
          type: 'file',
          file: buffer,
          mimeType,
          filename: `converted.${format}`,
          data: {
            format,
            bitrate,
            sampleRate,
            size: buffer.length,
          },
        });
      });
      outputStream.on('error', reject);

      ffmpeg(inputStream)
        .audioBitrate(bitrate)
        .audioFrequency(sampleRate)
        .format(format === 'm4a' ? 'ipod' : format)
        .pipe(outputStream, { end: true })
        .on('error', reject);
    });
  }
}
