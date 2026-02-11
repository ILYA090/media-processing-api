import sharp from 'sharp';
import { BaseActionHandler } from '../base.js';
import type { ActionContext, ActionResult, ValidationResult } from '../../../types/index.js';

export class ImgMetadataHandler extends BaseActionHandler {
  readonly actionId = 'img_metadata';
  readonly displayName = 'Extract Metadata';
  readonly buttonLabel = 'Get Metadata';
  readonly description = 'Extract EXIF and technical metadata from the image';
  readonly icon = 'info';
  readonly mediaType = 'image' as const;
  readonly category = 'process' as const;

  readonly inputSchema = {
    type: 'object',
    properties: {
      includeExif: {
        type: 'boolean',
        default: true,
        description: 'Include EXIF data if available',
      },
      includeIcc: {
        type: 'boolean',
        default: false,
        description: 'Include ICC color profile data',
      },
    },
  };

  readonly outputSchema = {
    type: 'object',
    properties: {
      format: { type: 'string' },
      width: { type: 'number' },
      height: { type: 'number' },
      space: { type: 'string' },
      channels: { type: 'number' },
      depth: { type: 'string' },
      density: { type: 'number' },
      hasAlpha: { type: 'boolean' },
      isAnimated: { type: 'boolean' },
      exif: { type: 'object' },
    },
  };

  override validate(params: Record<string, unknown>): ValidationResult {
    return { valid: true };
  }

  async execute(context: ActionContext): Promise<ActionResult> {
    const metadata = await sharp(context.file).metadata();

    const result: Record<string, unknown> = {
      format: metadata.format,
      width: metadata.width,
      height: metadata.height,
      space: metadata.space,
      channels: metadata.channels,
      depth: metadata.depth,
      density: metadata.density,
      hasAlpha: metadata.hasAlpha,
      isAnimated: metadata.pages ? metadata.pages > 1 : false,
      orientation: metadata.orientation,
    };

    // Include EXIF if requested and available
    if (context.params.includeExif !== false && metadata.exif) {
      try {
        // EXIF data is a buffer, we need to parse it
        result.exif = {
          available: true,
          size: metadata.exif.length,
        };
      } catch {
        result.exif = { available: false };
      }
    }

    // Include ICC profile info if requested
    if (context.params.includeIcc === true && metadata.icc) {
      result.icc = {
        available: true,
        size: metadata.icc.length,
      };
    }

    // Additional computed properties
    result.aspectRatio =
      metadata.width && metadata.height
        ? (metadata.width / metadata.height).toFixed(2)
        : null;
    result.megapixels =
      metadata.width && metadata.height
        ? ((metadata.width * metadata.height) / 1000000).toFixed(2)
        : null;

    return {
      type: 'json',
      data: result,
    };
  }
}
