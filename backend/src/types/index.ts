import type { FastifyRequest, FastifyReply } from 'fastify';
import type { User, Organization, ApiKey } from '@prisma/client';

// ============================================
// Authentication Types
// ============================================

export interface JwtPayload {
  sub: string; // User ID
  orgId: string; // Organization ID (empty string for super admin)
  email: string;
  role: string;
  isSuperAdmin?: boolean;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

export interface ApiKeyPayload {
  keyId: string;
  orgId: string;
  permissions: Record<string, boolean>;
}

export type AuthType = 'jwt' | 'apikey';

export interface AuthenticatedUser {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  role: string;
  isSuperAdmin: boolean;
  permissions: Record<string, boolean>;
}

export interface AuthenticatedApiKey {
  id: string;
  organizationId: string;
  name: string;
  permissions: Record<string, boolean>;
  rateLimits: Record<string, number>;
}

export interface RequestContext {
  authType: AuthType;
  user?: AuthenticatedUser;
  apiKey?: AuthenticatedApiKey;
  organizationId: string;
}

// Extend Fastify types
declare module 'fastify' {
  interface FastifyRequest {
    authContext?: RequestContext;
  }
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ResponseMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ============================================
// Media Types
// ============================================

export type MediaType = 'image' | 'audio';

export interface MediaFileInfo {
  id: string;
  originalFilename: string;
  storedFilename: string;
  mimeType: string;
  mediaType: MediaType;
  fileSizeBytes: bigint;
  storagePath: string;
  thumbnailPath?: string | null;
  metadata: Record<string, unknown>;
  checksumMd5: string;
  checksumSha256: string;
}

export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  space?: string;
  channels?: number;
  depth?: string;
  density?: number;
  hasAlpha?: boolean;
  exif?: Record<string, unknown>;
}

export interface AudioMetadata {
  duration: number;
  bitrate?: number;
  sampleRate?: number;
  channels?: number;
  format?: string;
  codec?: string;
}

// ============================================
// Action Types
// ============================================

export type ActionCategory = 'transcribe' | 'modify' | 'process';

export type ResultType = 'file' | 'json' | 'files';

export interface ActionDefinition {
  actionId: string;
  displayName: string;
  buttonLabel: string;
  description: string;
  icon: string;
  mediaType: MediaType;
  category: ActionCategory;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
}

export interface ActionContext {
  file: Buffer;
  fileInfo: MediaFileInfo;
  params: Record<string, unknown>;
  organizationId: string;
  userId?: string;
  jobId: string;
}

export interface ActionResult {
  type: ResultType;
  file?: Buffer;
  files?: Array<{ buffer: Buffer; filename: string; mimeType: string }>;
  data?: Record<string, unknown>;
  mimeType?: string;
  filename?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

// ============================================
// Job Types
// ============================================

export type JobStatus = 'pending' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface JobData {
  jobId: string;
  organizationId: string;
  userId?: string;
  apiKeyId?: string;
  mediaId: string;
  actionId: string;
  actionCategory: ActionCategory;
  parameters: Record<string, unknown>;
  priority: number;
}

export interface JobResult {
  success: boolean;
  resultType?: ResultType;
  resultMediaId?: string;
  resultData?: Record<string, unknown>;
  processingTimeMs?: number;
  aiProvider?: string;
  aiTokensUsed?: number;
  error?: {
    code: string;
    message: string;
  };
}

// ============================================
// Usage Types
// ============================================

export type UsageActionType = 'upload' | 'process' | 'download' | 'api_call';

export interface UsageData {
  organizationId: string;
  userId?: string;
  apiKeyId?: string;
  jobId?: string;
  actionType: UsageActionType;
  actionId?: string;
  mediaType?: string;
  fileSizeBytes?: bigint;
  processingTimeMs?: number;
  aiTokensUsed?: number;
  requestIp: string;
  userAgent?: string;
  endpoint: string;
  httpMethod: string;
  responseStatus: number;
  creditsUsed?: number;
}

// ============================================
// Rate Limit Types
// ============================================

export interface RateLimitConfig {
  windowMs: number;
  max: number;
}

export interface RateLimitInfo {
  limit: number;
  current: number;
  remaining: number;
  resetTime: Date;
}

// ============================================
// Storage Types
// ============================================

export interface StorageUploadResult {
  path: string;
  url: string;
  etag: string;
}

export interface StorageDownloadResult {
  buffer: Buffer;
  contentType: string;
  contentLength: number;
}

// ============================================
// Utility Types
// ============================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<T, Exclude<keyof T, Keys>> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];
