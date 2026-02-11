import ffmpeg from 'fluent-ffmpeg';
import { Readable, PassThrough } from 'stream';
import { BaseActionHandler } from '../base.js';
import type { ActionContext, ActionResult, ValidationResult } from '../../../types/index.js';

export class AudTrimHandler extends BaseActionHandler {
  readonly actionId = 'aud_trim';
  readonly displayName = 'Trim Audio';
  readonly buttonLabel = 'Trim';
  readonly description = 'Cut audio to a specific time range';
  readonly icon = 'cut';
  readonly mediaType = 'audio' as const;
  readonly category = 'modify' as const;

  readonly inputSchema = {
    type: 'object',
    properties: {
      startTime: {
        type: 'number',
        minimum: 0,
        description: 'Start time in seconds',
      },
      endTime: {
        type: 'number',
        minimum: 0,
        description: 'End time in seconds',
      },
      duration: {
        type: 'number',
        minimum: 0,
        description: 'Duration in seconds (alternative to endTime)',
      },
    },
    required: ['startTime'],
  };

  readonly outputSchema = {
    type: 'object',
    properties: {
      duration: { type: 'number' },
      format: { type: 'string' },
    },
  };

  override validate(params: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];

    const requiredResult = this.validateRequiredParams(params, ['startTime']);
    if (!requiredResult.valid) {
      return requiredResult;
    }

    const startError = this.validateNumericRange(params.startTime, 'startTime', 0);
    if (startError) errors.push(startError);

    if (params.endTime !== undefined) {
      const endError = this.validateNumericRange(params.endTime, 'endTime', 0);
      if (endError) errors.push(endError);

      if (
        typeof params.startTime === 'number' &&
        typeof params.endTime === 'number' &&
        params.endTime <= params.startTime
      ) {
        errors.push('endTime must be greater than startTime');
      }
    }

    if (params.duration !== undefined) {
      const durationError = this.validateNumericRange(params.duration, 'duration', 0.1);
      if (durationError) errors.push(durationError);
    }

    if (params.endTime === undefined && params.duration === undefined) {
      errors.push('Either endTime or duration must be specified');
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  async execute(context: ActionContext): Promise<ActionResult> {
    const startTime = context.params.startTime as number;
    const endTime = context.params.endTime as number | undefined;
    const duration = context.params.duration as number | undefined;

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
            startTime,
            endTime: endTime || (duration ? startTime + duration : undefined),
            trimDuration: duration || (endTime ? endTime - startTime : undefined),
          },
        });
      });
      outputStream.on('error', reject);

      let command = ffmpeg(inputStream)
        .setStartTime(startTime);

      if (duration) {
        command = command.setDuration(duration);
      } else if (endTime) {
        command = command.setDuration(endTime - startTime);
      }

      command
        .format('mp3')
        .pipe(outputStream, { end: true })
        .on('error', reject);
    });
  }
}
