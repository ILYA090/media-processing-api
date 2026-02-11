import type {
  ActionDefinition,
  ActionContext,
  ActionResult,
  ValidationResult,
  MediaType,
  ActionCategory,
} from '../../types/index.js';

export interface ActionHandler extends ActionDefinition {
  validate(params: Record<string, unknown>): ValidationResult;
  execute(context: ActionContext): Promise<ActionResult>;
}

export abstract class BaseActionHandler implements ActionHandler {
  abstract readonly actionId: string;
  abstract readonly displayName: string;
  abstract readonly buttonLabel: string;
  abstract readonly description: string;
  abstract readonly icon: string;
  abstract readonly mediaType: MediaType;
  abstract readonly category: ActionCategory;
  abstract readonly inputSchema: Record<string, unknown>;
  abstract readonly outputSchema: Record<string, unknown>;

  validate(params: Record<string, unknown>): ValidationResult {
    // Default validation - can be overridden
    return { valid: true };
  }

  abstract execute(context: ActionContext): Promise<ActionResult>;

  protected validateRequiredParams(
    params: Record<string, unknown>,
    required: string[]
  ): ValidationResult {
    const errors: string[] = [];

    for (const param of required) {
      if (params[param] === undefined || params[param] === null) {
        errors.push(`Missing required parameter: ${param}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  protected validateNumericRange(
    value: unknown,
    name: string,
    min?: number,
    max?: number
  ): string | null {
    if (typeof value !== 'number') {
      return `${name} must be a number`;
    }
    if (min !== undefined && value < min) {
      return `${name} must be at least ${min}`;
    }
    if (max !== undefined && value > max) {
      return `${name} must be at most ${max}`;
    }
    return null;
  }

  protected validateEnum(value: unknown, name: string, allowed: string[]): string | null {
    if (typeof value !== 'string' || !allowed.includes(value)) {
      return `${name} must be one of: ${allowed.join(', ')}`;
    }
    return null;
  }
}
