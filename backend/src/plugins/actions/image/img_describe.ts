import { BaseActionHandler } from '../base.js';
import { describeImage } from '../../ai-providers/index.js';
import type { ActionContext, ActionResult, ValidationResult } from '../../../types/index.js';

export class ImgDescribeHandler extends BaseActionHandler {
  readonly actionId = 'img_describe';
  readonly displayName = 'Describe Image';
  readonly buttonLabel = 'Describe';
  readonly description = 'Generate AI-powered description of the image content';
  readonly icon = 'chat';
  readonly mediaType = 'image' as const;
  readonly category = 'transcribe' as const;

  readonly inputSchema = {
    type: 'object',
    properties: {
      detail: {
        type: 'string',
        enum: ['brief', 'detailed'],
        default: 'detailed',
        description: 'Level of detail in the description',
      },
      provider: {
        type: 'string',
        enum: ['openai', 'anthropic'],
        default: 'anthropic',
        description: 'AI provider to use',
      },
    },
  };

  readonly outputSchema = {
    type: 'object',
    properties: {
      description: {
        type: 'string',
        description: 'AI-generated description of the image',
      },
      provider: {
        type: 'string',
        description: 'AI provider used',
      },
    },
  };

  validate(params: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];

    if (params.detail) {
      const error = this.validateEnum(params.detail, 'detail', ['brief', 'detailed']);
      if (error) errors.push(error);
    }

    if (params.provider) {
      const error = this.validateEnum(params.provider, 'provider', ['openai', 'anthropic']);
      if (error) errors.push(error);
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  async execute(context: ActionContext): Promise<ActionResult> {
    const detail = (context.params.detail as 'brief' | 'detailed') || 'detailed';
    const provider = (context.params.provider as 'openai' | 'anthropic') || 'anthropic';

    const description = await describeImage(context.file, {
      detail,
      provider,
      userId: context.userId,
      mimeType: context.fileInfo.mimeType,
    });

    return {
      type: 'json',
      data: {
        description,
        detail,
        provider,
      },
    };
  }
}
