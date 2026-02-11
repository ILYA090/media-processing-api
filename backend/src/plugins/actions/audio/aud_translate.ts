import { BaseActionHandler } from '../base.js';
import { translateAudio } from '../../ai-providers/index.js';
import type { ActionContext, ActionResult, ValidationResult } from '../../../types/index.js';

export class AudTranslateHandler extends BaseActionHandler {
  readonly actionId = 'aud_translate';
  readonly displayName = 'Translate Audio';
  readonly buttonLabel = 'Translate';
  readonly description = 'Transcribe and translate audio to English';
  readonly icon = 'translate';
  readonly mediaType = 'audio' as const;
  readonly category = 'transcribe' as const;

  readonly inputSchema = {
    type: 'object',
    properties: {
      includeTimestamps: {
        type: 'boolean',
        default: false,
        description: 'Include word-level timestamps in the output',
      },
    },
  };

  readonly outputSchema = {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: 'Translated text in English',
      },
      duration: {
        type: 'number',
        description: 'Audio duration in seconds',
      },
      segments: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            start: { type: 'number' },
            end: { type: 'number' },
            text: { type: 'string' },
          },
        },
      },
    },
  };

  validate(params: Record<string, unknown>): ValidationResult {
    return { valid: true };
  }

  async execute(context: ActionContext): Promise<ActionResult> {
    const includeTimestamps = context.params.includeTimestamps as boolean;

    const result = await translateAudio(context.file);

    const data: Record<string, unknown> = {
      text: result.text,
      language: 'en',
      duration: result.duration,
    };

    if (includeTimestamps && result.segments) {
      data.segments = result.segments;
    }

    return {
      type: 'json',
      data,
    };
  }
}
