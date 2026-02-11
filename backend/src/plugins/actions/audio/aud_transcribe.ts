import { BaseActionHandler } from '../base.js';
import { transcribeAudio } from '../../ai-providers/index.js';
import type { ActionContext, ActionResult, ValidationResult } from '../../../types/index.js';

export class AudTranscribeHandler extends BaseActionHandler {
  readonly actionId = 'aud_transcribe';
  readonly displayName = 'Transcribe Audio';
  readonly buttonLabel = 'Transcribe';
  readonly description = 'Convert speech to text using AI-powered transcription';
  readonly icon = 'mic';
  readonly mediaType = 'audio' as const;
  readonly category = 'transcribe' as const;

  readonly inputSchema = {
    type: 'object',
    properties: {
      language: {
        type: 'string',
        description: 'Language code (e.g., en, es, fr). Leave empty for auto-detection.',
      },
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
        description: 'Transcribed text',
      },
      language: {
        type: 'string',
        description: 'Detected or specified language',
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

  override validate(params: Record<string, unknown>): ValidationResult {
    return { valid: true };
  }

  async execute(context: ActionContext): Promise<ActionResult> {
    const language = context.params.language as string | undefined;
    const includeTimestamps = context.params.includeTimestamps as boolean;

    const result = await transcribeAudio(context.file, { language, userId: context.userId });

    const data: Record<string, unknown> = {
      text: result.text,
      language: result.language,
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
