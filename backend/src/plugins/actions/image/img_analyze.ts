import sharp from 'sharp';
import { BaseActionHandler } from '../base.js';
import { analyzeImageWithOpenAI, analyzeImageWithAnthropic } from '../../ai-providers/index.js';
import type { ActionContext, ActionResult, ValidationResult } from '../../../types/index.js';

export class ImgAnalyzeHandler extends BaseActionHandler {
  readonly actionId = 'img_analyze';
  readonly displayName = 'Analyze Image';
  readonly buttonLabel = 'Analyze';
  readonly description = 'Comprehensive AI analysis of image content, composition, and attributes';
  readonly icon = 'analytics';
  readonly mediaType = 'image' as const;
  readonly category = 'process' as const;

  readonly inputSchema = {
    type: 'object',
    properties: {
      aspects: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['content', 'composition', 'colors', 'mood', 'technical', 'objects'],
        },
        default: ['content', 'composition', 'colors'],
        description: 'Aspects to analyze',
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
      analysis: {
        type: 'object',
        properties: {
          content: { type: 'string' },
          composition: { type: 'string' },
          colors: { type: 'string' },
          mood: { type: 'string' },
          technical: { type: 'string' },
          objects: { type: 'array', items: { type: 'string' } },
        },
      },
      metadata: {
        type: 'object',
        properties: {
          width: { type: 'number' },
          height: { type: 'number' },
          format: { type: 'string' },
        },
      },
    },
  };

  override validate(params: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];

    if (params.provider) {
      const error = this.validateEnum(params.provider, 'provider', ['openai', 'anthropic']);
      if (error) errors.push(error);
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  async execute(context: ActionContext): Promise<ActionResult> {
    const aspects = (context.params.aspects as string[]) || [
      'content',
      'composition',
      'colors',
    ];
    const provider = (context.params.provider as string) || 'anthropic';

    // Get image metadata
    const metadata = await sharp(context.file).metadata();

    // Build analysis prompt
    const prompt = `Analyze this image and provide detailed information about the following aspects:
${aspects.map((a) => `- ${a}`).join('\n')}

Format your response as a structured analysis with each aspect as a section.`;

    // Get AI analysis
    const result =
      provider === 'anthropic'
        ? await analyzeImageWithAnthropic(context.file, prompt, {
            userId: context.userId,
            mimeType: context.fileInfo.mimeType,
          })
        : await analyzeImageWithOpenAI(context.file, prompt, { userId: context.userId });

    return {
      type: 'json',
      data: {
        analysis: {
          fullAnalysis: result.description,
          aspects,
        },
        metadata: {
          width: metadata.width,
          height: metadata.height,
          format: metadata.format,
          space: metadata.space,
          channels: metadata.channels,
          hasAlpha: metadata.hasAlpha,
        },
        provider,
      },
    };
  }
}
