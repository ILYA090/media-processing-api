import { logger } from '../../utils/logger.js';
import { ActionNotFoundError } from '../../utils/errors.js';
import type { ActionHandler } from './base.js';
import type { ActionDefinition, MediaType } from '../../types/index.js';

// Import all action handlers
import { ImgOcrHandler } from './image/img_ocr.js';
import { ImgDescribeHandler } from './image/img_describe.js';
import { ImgResizeHandler } from './image/img_resize.js';
import { ImgCropHandler } from './image/img_crop.js';
import { ImgFormatConvertHandler } from './image/img_format_convert.js';
import { ImgAnalyzeHandler } from './image/img_analyze.js';
import { ImgMetadataHandler } from './image/img_metadata.js';
import { AudTranscribeHandler } from './audio/aud_transcribe.js';
import { AudTranslateHandler } from './audio/aud_translate.js';
import { AudTrimHandler } from './audio/aud_trim.js';
import { AudFormatConvertHandler } from './audio/aud_format_convert.js';
import { AudVolumeHandler } from './audio/aud_volume.js';
import { AudAnalyzeHandler } from './audio/aud_analyze.js';
import { AudGenerateWaveformHandler } from './audio/aud_generate_waveform.js';

class ActionRegistry {
  private actions: Map<string, ActionHandler> = new Map();
  private loaded: boolean = false;

  async loadActions(): Promise<void> {
    if (this.loaded) {
      return;
    }

    // Register image actions
    this.register(new ImgOcrHandler());
    this.register(new ImgDescribeHandler());
    this.register(new ImgResizeHandler());
    this.register(new ImgCropHandler());
    this.register(new ImgFormatConvertHandler());
    this.register(new ImgAnalyzeHandler());
    this.register(new ImgMetadataHandler());

    // Register audio actions
    this.register(new AudTranscribeHandler());
    this.register(new AudTranslateHandler());
    this.register(new AudTrimHandler());
    this.register(new AudFormatConvertHandler());
    this.register(new AudVolumeHandler());
    this.register(new AudAnalyzeHandler());
    this.register(new AudGenerateWaveformHandler());

    this.loaded = true;
    logger.info(`Action registry loaded ${this.actions.size} actions`);
  }

  register(handler: ActionHandler): void {
    if (this.actions.has(handler.actionId)) {
      logger.warn({ actionId: handler.actionId }, 'Action already registered, overwriting');
    }
    this.actions.set(handler.actionId, handler);
    logger.debug({ actionId: handler.actionId, mediaType: handler.mediaType }, 'Action registered');
  }

  get(actionId: string): ActionHandler {
    const handler = this.actions.get(actionId);
    if (!handler) {
      throw new ActionNotFoundError(actionId);
    }
    return handler;
  }

  has(actionId: string): boolean {
    return this.actions.has(actionId);
  }

  getAllActions(): ActionDefinition[] {
    return Array.from(this.actions.values()).map((handler) => ({
      actionId: handler.actionId,
      displayName: handler.displayName,
      buttonLabel: handler.buttonLabel,
      description: handler.description,
      icon: handler.icon,
      mediaType: handler.mediaType,
      category: handler.category,
      inputSchema: handler.inputSchema,
      outputSchema: handler.outputSchema,
    }));
  }

  getActionsByMediaType(mediaType: MediaType): ActionDefinition[] {
    return this.getAllActions().filter((action) => action.mediaType === mediaType);
  }

  getActionIds(): string[] {
    return Array.from(this.actions.keys());
  }
}

export const actionRegistry = new ActionRegistry();
