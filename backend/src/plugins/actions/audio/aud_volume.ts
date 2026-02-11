import ffmpeg from 'fluent-ffmpeg';
import { Readable, PassThrough } from 'stream';
import { BaseActionHandler } from '../base.js';
import type { ActionContext, ActionResult, ValidationResult } from '../../../types/index.js';

export class AudVolumeHandler extends BaseActionHandler {
  readonly actionId = 'aud_volume';
  readonly displayName = 'Adjust Volume';
  readonly buttonLabel = 'Adjust Volume';
  readonly description = 'Increase or decrease audio volume';
  readonly icon = 'volume';
  readonly mediaType = 'audio' as const;
  readonly category = 'modify' as const;

  readonly inputSchema = {
    type: 'object',
    properties: {
      adjustment: {
        type: 'number',
        minimum: -20,
        maximum: 20,
        description: 'Volume adjustment in dB (negative to decrease, positive to increase)',
      },
      normalize: {
        type: 'boolean',
        default: false,
        description: 'Normalize audio levels to standard volume',
      },
    },
    required: ['adjustment'],
  };

  readonly outputSchema = {
    type: 'object',
    properties: {
      adjustment: { type: 'number' },
      normalized: { type: 'boolean' },
    },
  };

  validate(params: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];

    if (params.normalize !== true) {
      const requiredResult = this.validateRequiredParams(params, ['adjustment']);
      if (!requiredResult.valid) {
        return requiredResult;
      }

      const adjustmentError = this.validateNumericRange(params.adjustment, 'adjustment', -20, 20);
      if (adjustmentError) errors.push(adjustmentError);
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  async execute(context: ActionContext): Promise<ActionResult> {
    const adjustment = context.params.adjustment as number;
    const normalize = context.params.normalize as boolean;

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
          mimeType: context.fileInfo.mimeType,
          data: {
            adjustment: normalize ? 'normalized' : adjustment,
            normalized: normalize,
          },
        });
      });
      outputStream.on('error', reject);

      let command = ffmpeg(inputStream);

      if (normalize) {
        command = command.audioFilters('loudnorm=I=-16:TP=-1.5:LRA=11');
      } else {
        command = command.audioFilters(`volume=${adjustment}dB`);
      }

      command
        .format('mp3')
        .pipe(outputStream, { end: true })
        .on('error', reject);
    });
  }
}
