import { z } from 'zod';

const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  API_BASE_URL: z.string().default('http://localhost:3001'),

  // Database
  DATABASE_URL: z.string(),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // MinIO
  MINIO_ENDPOINT: z.string().default('localhost'),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_ACCESS_KEY: z.string().default('minioadmin'),
  MINIO_SECRET_KEY: z.string().default('minioadmin'),
  MINIO_BUCKET: z.string().default('media-files'),
  MINIO_USE_SSL: z.string().default('false').transform((v) => v === 'true'),

  // Authentication
  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),
  BCRYPT_ROUNDS: z.coerce.number().default(12),

  // AI Providers
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),

  // Queue
  QUEUE_CONCURRENCY: z.coerce.number().default(5),
  JOB_TIMEOUT_MS: z.coerce.number().default(300000),
  JOB_MAX_RETRIES: z.coerce.number().default(3),

  // Limits
  MAX_FILE_SIZE_MB: z.coerce.number().default(50),
  DEFAULT_RETENTION_DAYS: z.coerce.number().default(30),

  // Logging
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('Invalid environment variables:');
    console.error(result.error.format());
    process.exit(1);
  }

  return result.data;
};

const env = parseEnv();

export const config = {
  env: env.NODE_ENV,
  isDev: env.NODE_ENV === 'development',
  isProd: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',

  server: {
    port: env.PORT,
    baseUrl: env.API_BASE_URL,
  },

  database: {
    url: env.DATABASE_URL,
  },

  redis: {
    url: env.REDIS_URL,
  },

  minio: {
    endpoint: env.MINIO_ENDPOINT,
    port: env.MINIO_PORT,
    accessKey: env.MINIO_ACCESS_KEY,
    secretKey: env.MINIO_SECRET_KEY,
    bucket: env.MINIO_BUCKET,
    useSSL: env.MINIO_USE_SSL,
  },

  auth: {
    jwtSecret: env.JWT_SECRET,
    accessExpiry: env.JWT_ACCESS_EXPIRY,
    refreshExpiry: env.JWT_REFRESH_EXPIRY,
    bcryptRounds: env.BCRYPT_ROUNDS,
  },

  ai: {
    openaiApiKey: env.OPENAI_API_KEY,
    anthropicApiKey: env.ANTHROPIC_API_KEY,
  },

  queue: {
    concurrency: env.QUEUE_CONCURRENCY,
    jobTimeout: env.JOB_TIMEOUT_MS,
    maxRetries: env.JOB_MAX_RETRIES,
  },

  limits: {
    maxFileSizeMB: env.MAX_FILE_SIZE_MB,
    maxFileSizeBytes: env.MAX_FILE_SIZE_MB * 1024 * 1024,
    retentionDays: env.DEFAULT_RETENTION_DAYS,
  },

  logging: {
    level: env.LOG_LEVEL,
  },

  media: {
    image: {
      maxFileSizeMB: 50,
      maxResolution: 8192,
      supportedFormats: ['jpeg', 'jpg', 'png', 'webp', 'gif', 'bmp', 'tiff'],
      supportedMimeTypes: [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'image/bmp',
        'image/tiff',
      ],
      thumbnail: {
        width: 200,
        height: 200,
        quality: 80,
      },
    },
    audio: {
      maxFileSizeMB: 100,
      maxDurationMinutes: 60,
      supportedFormats: ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'webm'],
      supportedMimeTypes: [
        'audio/mpeg',
        'audio/mp3',
        'audio/wav',
        'audio/wave',
        'audio/x-wav',
        'audio/flac',
        'audio/ogg',
        'audio/mp4',
        'audio/m4a',
        'audio/webm',
      ],
    },
  },
} as const;

export type Config = typeof config;
