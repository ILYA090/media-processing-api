import sharp from 'sharp';
import { BaseActionHandler } from '../base.js';
import type { ActionContext, ActionResult, ValidationResult } from '../../../types/index.js';

export class ImgCropHandler extends BaseActionHandler {
  readonly actionId = 'img_crop';
  readonly displayName = 'Crop Image';
  readonly buttonLabel = 'Crop';
  readonly description = 'Crop image to a specific region';
  readonly icon = 'crop';
  readonly mediaType = 'image' as const;
  readonly category = 'modify' as const;

  readonly inputSchema = {
    type: 'object',
    properties: {
      left: {
        type: 'number',
        minimum: 0,
        description: 'Left offset in pixels',
      },
      top: {
        type: 'number',
        minimum: 0,
        description: 'Top offset in pixels',
      },
      width: {
        type: 'number',
        minimum: 1,
        description: 'Width of crop region in pixels',
      },
      height: {
        type: 'number',
        minimum: 1,
        description: 'Height of crop region in pixels',
      },
    },
    required: ['left', 'top', 'width', 'height'],
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

    const requiredResult = this.validateRequiredParams(params, ['left', 'top', 'width', 'height']);
    if (!requiredResult.valid) {
      return requiredResult;
    }

    const leftError = this.validateNumericRange(params.left, 'left', 0);
    if (leftError) errors.push(leftError);

    const topError = this.validateNumericRange(params.top, 'top', 0);
    if (topError) errors.push(topError);

    const widthError = this.validateNumericRange(params.width, 'width', 1);
    if (widthError) errors.push(widthError);

    const heightError = this.validateNumericRange(params.height, 'height', 1);
    if (heightError) errors.push(heightError);

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  async execute(context: ActionContext): Promise<ActionResult> {
    const left = context.params.left as number;
    const top = context.params.top as number;
    const width = context.params.width as number;
    const height = context.params.height as number;

    const buffer = await sharp(context.file)
      .extract({ left, top, width, height })
      .toBuffer();

    const metadata = await sharp(buffer).metadata();

    return {
      type: 'file',
      file: buffer,
      mimeType: context.fileInfo.mimeType,
      data: {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
      },
    };
  }
}
