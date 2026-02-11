// ============================================
// AUTH TYPES
// ============================================

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  status?: string;
  organizationId?: string | null;
  isSuperAdmin?: boolean;
  permissions: UserPermissions;
  lastLoginAt?: string;
  createdAt: string;
}

export interface UserPermissions {
  canCreateApiKeys: boolean;
  canManageUsers: boolean;
  canViewUsage: boolean;
  canDeleteMedia: boolean;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  email: string;
  settings: OrganizationSettings;
  createdAt: string;
}

export interface OrganizationSettings {
  maxFileSizeMb: number;
  maxStorageGb: number;
  maxUsers: number;
  maxApiKeys: number;
  requestsPerDay: number;
  retentionDays: number;
  concurrentJobs: number;
  webhookUrl?: string;
}

export interface AiSettings {
  defaultProvider: 'anthropic' | 'openai';
  hasAnthropicKey: boolean;
  hasOpenaiKey: boolean;
  anthropicKeyMasked?: string | null;
  openaiKeyMasked?: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// ============================================
// API KEY TYPES
// ============================================

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: ApiKeyPermissions;
  rateLimits: ApiKeyRateLimits;
  status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
  expiresAt?: string;
  lastUsedAt?: string;
  createdAt: string;
}

export interface ApiKeyPermissions {
  allowedActions?: string[];
  allowedMediaTypes?: string[];
  ipWhitelist?: string[];
}

export interface ApiKeyRateLimits {
  requestsPerMinute: number;
  requestsPerDay: number;
  maxConcurrentJobs: number;
  maxFileSizeMb: number;
}

export interface CreateApiKeyResponse {
  id: string;
  key: string; // Only returned on creation
  name: string;
  keyPrefix: string;
}

// ============================================
// MEDIA TYPES
// ============================================

export interface MediaFile {
  id: string;
  originalFilename: string;
  mimeType: string;
  mediaType: 'image' | 'audio';
  fileSizeBytes: number | string;
  metadata: ImageMetadata | AudioMetadata;
  status: 'processing' | 'ready' | 'failed' | 'deleted';
  expiresAt?: string;
  createdAt: string;
  thumbnailUrl?: string;
}

export interface ImageMetadata {
  width: number;
  height: number;
  colorSpace?: string;
  hasAlpha?: boolean;
}

export interface AudioMetadata {
  durationSeconds: number;
  sampleRate: number;
  channels: number;
  bitrate?: number;
}

// ============================================
// ACTION TYPES
// ============================================

export type ActionCategory = 'transcribe' | 'modify' | 'process';

export interface Action {
  actionId: string;
  displayName: string;
  buttonLabel: string;
  description: string;
  icon: string;
  mediaType: 'image' | 'audio';
  category: ActionCategory;
  inputSchema: JsonSchema;
}

export interface JsonSchema {
  type: string;
  required?: string[];
  properties: Record<string, JsonSchemaProperty>;
}

export interface JsonSchemaProperty {
  type: string;
  title?: string;
  description?: string;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  enum?: string[];
  format?: string;
}

// ============================================
// JOB TYPES
// ============================================

export type JobStatus = 'pending' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface ProcessingJob {
  id: string;
  inputMediaId: string;
  inputMedia?: MediaFile;
  actionId: string;
  actionCategory: ActionCategory;
  parameters: Record<string, unknown>;
  status: JobStatus;
  priority: number;
  resultType?: 'FILE' | 'JSON' | 'FILES';
  resultMediaId?: string;
  resultData?: Record<string, unknown>;
  errorCode?: string;
  errorMessage?: string;
  processingTimeMs?: number;
  createdAt: string;
  completedAt?: string;
}

// ============================================
// USAGE TYPES
// ============================================

export interface UsageSummary {
  period: {
    start: string;
    end: string;
  };
  requests: {
    total: number;
    limit: number;
    percentage: number;
  };
  storage: {
    usedBytes: number;
    limitBytes: number;
    percentage: number;
  };
  processing: {
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
  };
  byAction: Array<{
    actionId: string;
    count: number;
  }>;
}

export interface UsageRecord {
  id: string;
  actionType: 'UPLOAD' | 'PROCESS' | 'DOWNLOAD' | 'API_CALL';
  actionId?: string;
  mediaType?: string;
  fileSizeBytes?: number;
  processingTimeMs?: number;
  endpoint: string;
  responseStatus: number;
  timestamp: string;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T> {
  data: T;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    requestId?: string;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

// ============================================
// ADMIN TYPES
// ============================================

export interface AdminOrganization {
  id: string;
  name: string;
  slug: string;
  email: string;
  createdAt: string;
  userCount: number;
  mediaCount: number;
  jobCount: number;
}

export interface AdminOrgUser {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  lastLoginAt?: string;
  createdAt: string;
}
