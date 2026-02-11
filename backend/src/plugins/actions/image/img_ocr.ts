import { BaseActionHandler } from '../base.js';
import { extractTextFromImage } from '../../ai-providers/index.js';
import type { ActionContext, ActionResult, ValidationResult } from '../../../types/index.js';

export class ImgOcrHandler extends BaseActionHandler {
  readonly actionId = 'img_ocr';
  readonly displayName = 'Extract Text (OCR)';
  readonly buttonLabel = 'Extract Text';
  readonly description = 'Extract text from images using AI-powered OCR';
  readonly icon = 'text';
  readonly mediaType = 'image' as const;
  readonly category = 'transcribe' as const;

  readonly inputSchema = {
    type: 'object',
    properties: {
      language: {
        type: 'string',
        description: 'Expected language of the text (optional)',
        default: 'auto',
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
      text: {
        type: 'string',
        description: 'Extracted text from the image',
      },
      confidence: {
        type: 'number',
        description: 'Confidence score (0-1)',
      },
    },
  };

  override validate(params: Record<string, unknown>): ValidationResult {
    // No required params
    return { valid: true };
  }

  async execute(context: ActionContext): Promise<ActionResult> {
    const provider = (context.params.provider as 'openai' | 'anthropic') || 'anthropic';
    const text = await extractTextFromImage(context.file, {
      provider,
      userId: context.userId,
      mimeType: context.fileInfo.mimeType,
    });

    return {
      type: 'json',
      data: {
        text,
        language: (context.params.language as string) || 'auto',
        provider,
      },
    };
  }
}
