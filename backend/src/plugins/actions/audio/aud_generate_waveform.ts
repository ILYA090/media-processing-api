import ffmpeg from 'fluent-ffmpeg';
import { Readable, PassThrough } from 'stream';
import { BaseActionHandler } from '../base.js';
import type { ActionContext, ActionResult, ValidationResult } from '../../../types/index.js';

export class AudGenerateWaveformHandler extends BaseActionHandler {
  readonly actionId = 'aud_generate_waveform';
  readonly displayName = 'Generate Waveform';
  readonly buttonLabel = 'Waveform';
  readonly description = 'Generate visual waveform image from audio';
  readonly icon = 'waveform';
  readonly mediaType = 'audio' as const;
  readonly category = 'process' as const;

  readonly inputSchema = {
    type: 'object',
    properties: {
      width: {
        type: 'number',
        minimum: 100,
        maximum: 4000,
        default: 800,
        description: 'Width of waveform image in pixels',
      },
      height: {
        type: 'number',
        minimum: 50,
        maximum: 1000,
        default: 200,
        description: 'Height of waveform image in pixels',
      },
      color: {
        type: 'string',
        default: '#3b82f6',
        description: 'Waveform color (hex)',
      },
      backgroundColor: {
        type: 'string',
        default: '#1f2937',
        description: 'Background color (hex)',
      },
    },
  };

  readonly outputSchema = {
    type: 'object',
    properties: {
      width: { type: 'number' },
      height: { type: 'number' },
      format: { type: 'string' },
    },
  };

  validate(params: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];

    if (params.width !== undefined) {
      const widthError = this.validateNumericRange(params.width, 'width', 100, 4000);
      if (widthError) errors.push(widthError);
    }

    if (params.height !== undefined) {
      const heightError = this.validateNumericRange(params.height, 'height', 50, 1000);
      if (heightError) errors.push(heightError);
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  async execute(context: ActionContext): Promise<ActionResult> {
    const width = (context.params.width as number) || 800;
    const height = (context.params.height as number) || 200;
    const color = (context.params.color as string) || '#3b82f6';
    const backgroundColor = (context.params.backgroundColor as string) || '#1f2937';

    return new Promise((resolve, reject) => {
      const inputStream = new Readable();
      inputStream.push(context.file);
      inputStream.push(null);

      const outputChunks: Buffer[] = [];
      const outputStream = new PassThrough();

      outputStream.on('data', (chunk) => outputChunks.push(chunk));
      outputStream.on('end', () => {
        const buffer = Buffer.concat(outputChunks);
        resolve({
          type: 'file',
          file: buffer,
          mimeType: 'image/png',
          filename: 'waveform.png',
          data: {
            width,
            height,
            format: 'png',
          },
        });
      });
      outputStream.on('error', reject);

      // Use showwavespic filter to generate waveform image
      const colorHex = color.replace('#', '0x');
      const bgHex = backgroundColor.replace('#', '0x');

      ffmpeg(inputStream)
        .complexFilter([
          `showwavespic=s=${width}x${height}:colors=${colorHex}`,
          `[0:v]drawbox=c=${bgHex}@0:t=fill[bg]`,
        ])
        .outputOptions(['-frames:v', '1'])
        .format('image2pipe')
        .outputOptions(['-vcodec', 'png'])
        .pipe(outputStream, { end: true })
        .on('error', (err) => {
          // Fallback: generate simpler waveform if complex filter fails
          ffmpeg(inputStream)
            .complexFilter([`showwavespic=s=${width}x${height}`])
            .outputOptions(['-frames:v', '1'])
            .format('image2pipe')
            .outputOptions(['-vcodec', 'png'])
            .pipe(outputStream, { end: true })
            .on('error', reject);
        });
    });
  }
}
