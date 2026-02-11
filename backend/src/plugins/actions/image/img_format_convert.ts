import sharp from 'sharp';
import { BaseActionHandler } from '../base.js';
import type { ActionContext, ActionResult, ValidationResult } from '../../../types/index.js';

const FORMAT_TO_MIME: Record<string, string> = {
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  tiff: 'image/tiff',
  avif: 'image/avif',
};

export class ImgFormatConvertHandler extends BaseActionHandler {
  readonly actionId = 'img_format_convert';
  readonly displayName = 'Convert Format';
  readonly buttonLabel = 'Convert';
  readonly description = 'Convert image to a different format';
  readonly icon = 'swap';
  readonly mediaType = 'image' as const;
  readonly category = 'modify' as const;

  readonly inputSchema = {
    type: 'object',
    properties: {
      format: {
        type: 'string',
        enum: ['jpeg', 'png', 'webp', 'gif', 'tiff', 'avif'],
        description: 'Target image format',
      },
      quality: {
        type: 'number',
        minimum: 1,
        maximum: 100,
        default: 80,
        description: 'Quality for lossy formats (1-100)',
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
      'jpeg',
      'png',
      'webp',
      'gif',
      'tiff',
      'avif',
    ]);
    if (formatError) errors.push(formatError);

    if (params.quality !== undefined) {
      const qualityError = this.validateNumericRange(params.quality, 'quality', 1, 100);
      if (qualityError) errors.push(qualityError);
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  async execute(context: ActionContext): Promise<ActionResult> {
    const format = context.params.format as keyof sharp.FormatEnum;
    const quality = (context.params.quality as number) || 80;

    let image = sharp(context.file);

    switch (format) {
      case 'jpeg':
        image = image.jpeg({ quality });
        break;
      case 'png':
        image = image.png({ quality });
        break;
      case 'webp':
        image = image.webp({ quality });
        break;
      case 'gif':
        image = image.gif();
        break;
      case 'tiff':
        image = image.tiff({ quality });
        break;
      case 'avif':
        image = image.avif({ quality });
        break;
    }

    const buffer = await image.toBuffer();
    const mimeType = FORMAT_TO_MIME[format] || 'application/octet-stream';

    const baseName = context.fileInfo.originalFilename.replace(/\.[^.]+$/, '');
    const filename = `${baseName}.${format}`;

    return {
      type: 'file',
      file: buffer,
      mimeType,
      filename,
      data: {
        format,
        size: buffer.length,
      },
    };
  }
}
