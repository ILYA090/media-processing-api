export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// ============================================
// Authentication Errors
// ============================================

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized', details?: Record<string, unknown>) {
    super(message, 'UNAUTHORIZED', 401, details);
  }
}

export class InvalidCredentialsError extends AppError {
  constructor(message: string = 'Invalid credentials') {
    super(message, 'INVALID_CREDENTIALS', 401);
  }
}

export class TokenExpiredError extends AppError {
  constructor(message: string = 'Token has expired') {
    super(message, 'TOKEN_EXPIRED', 401);
  }
}

export class InvalidTokenError extends AppError {
  constructor(message: string = 'Invalid token') {
    super(message, 'INVALID_TOKEN', 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden', details?: Record<string, unknown>) {
    super(message, 'FORBIDDEN', 403, details);
  }
}

export class InsufficientPermissionsError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 'INSUFFICIENT_PERMISSIONS', 403);
  }
}

// ============================================
// Resource Errors
// ============================================

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with ID '${id}' not found` : `${resource} not found`;
    super(message, 'NOT_FOUND', 404, { resource, id });
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CONFLICT', 409, details);
  }
}

export class DuplicateError extends AppError {
  constructor(resource: string, field: string) {
    super(`${resource} with this ${field} already exists`, 'DUPLICATE', 409, { resource, field });
  }
}

// ============================================
// Validation Errors
// ============================================

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

export class InvalidInputError extends AppError {
  constructor(message: string, field?: string) {
    super(message, 'INVALID_INPUT', 400, field ? { field } : undefined);
  }
}

// ============================================
// Media Errors
// ============================================

export class FileTooLargeError extends AppError {
  constructor(maxSizeMB: number) {
    super(`File size exceeds maximum allowed size of ${maxSizeMB}MB`, 'FILE_TOO_LARGE', 413, {
      maxSizeMB,
    });
  }
}

export class UnsupportedMediaTypeError extends AppError {
  constructor(mimeType: string, supportedTypes?: string[]) {
    super(`Unsupported media type: ${mimeType}`, 'UNSUPPORTED_MEDIA_TYPE', 415, {
      mimeType,
      supportedTypes,
    });
  }
}

export class MediaProcessingError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'MEDIA_PROCESSING_ERROR', 422, details);
  }
}

// ============================================
// Job Errors
// ============================================

export class JobNotFoundError extends NotFoundError {
  constructor(jobId: string) {
    super('Job', jobId);
  }
}

export class JobAlreadyProcessingError extends AppError {
  constructor(jobId: string) {
    super(`Job '${jobId}' is already being processed`, 'JOB_ALREADY_PROCESSING', 409, { jobId });
  }
}

export class JobFailedError extends AppError {
  constructor(jobId: string, reason: string) {
    super(`Job '${jobId}' failed: ${reason}`, 'JOB_FAILED', 500, { jobId, reason });
  }
}

// ============================================
// Action Errors
// ============================================

export class ActionNotFoundError extends NotFoundError {
  constructor(actionId: string) {
    super('Action', actionId);
  }
}

export class ActionNotSupportedError extends AppError {
  constructor(actionId: string, mediaType: string) {
    super(
      `Action '${actionId}' is not supported for media type '${mediaType}'`,
      'ACTION_NOT_SUPPORTED',
      400,
      { actionId, mediaType }
    );
  }
}

// ============================================
// Rate Limit Errors
// ============================================

export class RateLimitExceededError extends AppError {
  constructor(retryAfter?: number) {
    super('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED', 429, { retryAfter });
  }
}

// ============================================
// External Service Errors
// ============================================

export class ExternalServiceError extends AppError {
  constructor(service: string, message: string, details?: Record<string, unknown>) {
    super(`External service error (${service}): ${message}`, 'EXTERNAL_SERVICE_ERROR', 502, {
      service,
      ...details,
    });
  }
}

export class StorageError extends AppError {
  constructor(operation: string, message: string) {
    super(`Storage error during ${operation}: ${message}`, 'STORAGE_ERROR', 500, { operation });
  }
}

export class AIProviderError extends AppError {
  constructor(provider: string, message: string) {
    super(`AI provider error (${provider}): ${message}`, 'AI_PROVIDER_ERROR', 502, { provider });
  }
}

// ============================================
// System Errors
// ============================================

export class InternalError extends AppError {
  constructor(message: string = 'Internal server error') {
    super(message, 'INTERNAL_ERROR', 500);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(service?: string) {
    const message = service ? `Service '${service}' is unavailable` : 'Service unavailable';
    super(message, 'SERVICE_UNAVAILABLE', 503, { service });
  }
}

// ============================================
// Error Type Guards
// ============================================

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function isOperationalError(error: unknown): boolean {
  if (isAppError(error)) {
    return error.isOperational;
  }
  return false;
}
