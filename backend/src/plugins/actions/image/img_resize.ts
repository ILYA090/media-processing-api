import sharp from 'sharp';
import { BaseActionHandler } from '../base.js';
import type { ActionContext, ActionResult, ValidationResult } from '../../../types/index.js';

export class ImgResizeHandler extends BaseActionHandler {
  readonly actionId = 'img_resize';
  readonly displayName = 'Resize Image';
  readonly buttonLabel = 'Resize';
  readonly description = 'Resize image by percentage or to specific pixel dimensions';
  readonly icon = 'resize';
  readonly mediaType = 'image' as const;
  readonly category = 'modify' as const;

  readonly inputSchema = {
    type: 'object',
    properties: {
      mode: {
        type: 'string',
        enum: ['percentage', 'pixels'],
        default: 'percentage',
        title: 'Resize Mode',
        description: 'Resize by percentage or exact pixel dimensions',
      },
      percentage: {
        type: 'number',
        minimum: 1,
        maximum: 500,
        default: 50,
        title: 'Scale Percentage',
        description: 'Scale percentage (e.g. 50 = half size, 200 = double size)',
      },
      width: {
        type: 'number',
        minimum: 1,
        maximum: 8192,
        title: 'Width',
        description: 'Target width in pixels',
      },
      height: {
        type: 'number',
        minimum: 1,
        maximum: 8192,
        title: 'Height',
        description: 'Target height in pixels',
      },
      fit: {
        type: 'string',
        enum: ['cover', 'contain', 'fill', 'inside', 'outside'],
        default: 'contain',
        title: 'Fit Mode',
        description: 'How the image should be resized to fit the dimensions',
      },
      maintainAspectRatio: {
        type: 'boolean',
        default: true,
        title: 'Maintain Aspect Ratio',
        description: 'Whether to maintain aspect ratio',
      },
    },
    required: ['mode'],
  };

  readonly outputSchema = {
    type: 'object',
    properties: {
      width: { type: 'number' },
      height: { type: 'number' },
      format: { type: 'string' },
    },
  };

  override validate(params: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];
    const mode = params.mode || 'percentage';

    if (mode === 'percentage') {
      if (!params.percentage) {
        errors.push('Percentage is required when using percentage mode');
      } else {
        const error = this.validateNumericRange(params.percentage, 'percentage', 1, 500);
        if (error) errors.push(error);
      }
    } else if (mode === 'pixels') {
      if (!params.width && !params.height) {
        errors.push('At least one of width or height must be specified in pixels mode');
      }

      if (params.width) {
        const error = this.validateNumericRange(params.width, 'width', 1, 8192);
        if (error) errors.push(error);
      }

      if (params.height) {
        const error = this.validateNumericRange(params.height, 'height', 1, 8192);
        if (error) errors.push(error);
      }
    } else {
      errors.push('Mode must be either "percentage" or "pixels"');
    }

    if (params.fit) {
      const error = this.validateEnum(params.fit, 'fit', [
        'cover',
        'contain',
        'fill',
        'inside',
        'outside',
      ]);
      if (error) errors.push(error);
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  async execute(context: ActionContext): Promise<ActionResult> {
    const mode = (context.params.mode as string) || 'percentage';
    const fit = (context.params.fit as keyof sharp.FitEnum) || 'contain';

    let image = sharp(context.file);
    const originalMetadata = await image.metadata();

    let targetWidth: number | undefined;
    let targetHeight: number | undefined;

    if (mode === 'percentage') {
      const percentage = (context.params.percentage as number) || 50;
      const scale = percentage / 100;

      if (originalMetadata.width) {
        targetWidth = Math.round(originalMetadata.width * scale);
      }
      if (originalMetadata.height) {
        targetHeight = Math.round(originalMetadata.height * scale);
      }
    } else {
      targetWidth = context.params.width as number | undefined;
      targetHeight = context.params.height as number | undefined;
    }

    image = sharp(context.file).resize({
      width: targetWidth,
      height: targetHeight,
      fit,
      withoutEnlargement: false,
    });

    const buffer = await image.toBuffer();
    const metadata = await sharp(buffer).metadata();

    // Generate a descriptive filename
    const ext = context.fileInfo.originalFilename.split('.').pop() || 'jpg';
    const baseName = context.fileInfo.originalFilename.replace(/\.[^.]+$/, '');
    const filename = `${baseName}_resized_${metadata.width}x${metadata.height}.${ext}`;

    return {
      type: 'file',
      file: buffer,
      filename,
      mimeType: context.fileInfo.mimeType,
      data: {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
      },
    };
  }
}
