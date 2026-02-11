# Media Processing API - Technical Requirements & Architecture

## 1. Architecture Overview

### 1.1 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                         │
│         Web App / Mobile App / Third-party Integrations                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API GATEWAY LAYER                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Auth      │  │   Rate      │  │  Request    │  │   CORS      │        │
│  │ Middleware  │  │  Limiter    │  │ Validation  │  │  Handler    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          APPLICATION LAYER                                   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         FASTIFY SERVER                                │  │
│  │                                                                        │  │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐        │  │
│  │  │   Auth     │ │   Media    │ │   Jobs     │ │   Usage    │        │  │
│  │  │  Routes    │ │  Routes    │ │  Routes    │ │  Routes    │        │  │
│  │  └────────────┘ └────────────┘ └────────────┘ └────────────┘        │  │
│  │                                                                        │  │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐        │  │
│  │  │   Auth     │ │   Media    │ │   Job      │ │   Usage    │        │  │
│  │  │  Service   │ │  Service   │ │  Service   │ │  Service   │        │  │
│  │  └────────────┘ └────────────┘ └────────────┘ └────────────┘        │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                       PLUGIN SYSTEM                                    │  │
│  │                                                                        │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │  │
│  │  │  Media Handlers │  │ Action Registry │  │  AI Providers   │      │  │
│  │  │  - Image        │  │  - 7 Image      │  │  - OpenAI       │      │  │
│  │  │  - Audio        │  │  - 7 Audio      │  │  - Anthropic    │      │  │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   PostgreSQL    │  │     Redis       │  │     MinIO       │
│   (Primary DB)  │  │  (Cache/Queue)  │  │ (File Storage)  │
│                 │  │                 │  │                 │
│ - Organizations │  │ - Rate Limits   │  │ - Media Files   │
│ - Users         │  │ - Sessions      │  │ - Results       │
│ - API Keys      │  │ - Job Queue     │  │ - Thumbnails    │
│ - Media Meta    │  │ - Cache         │  │                 │
│ - Jobs          │  │                 │  │                 │
│ - Usage Records │  │                 │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          WORKER LAYER                                        │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                       BullMQ Workers                                   │  │
│  │                                                                        │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                   │  │
│  │  │ High Queue  │  │ Normal Queue│  │  Low Queue  │                   │  │
│  │  │ (< 5MB)     │  │  (Default)  │  │ (> 20MB)    │                   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                   │  │
│  │                          │                                             │  │
│  │                          ▼                                             │  │
│  │  ┌──────────────────────────────────────────────────────────────┐    │  │
│  │  │                   Job Processor                               │    │  │
│  │  │  1. Load action handler from registry                        │    │  │
│  │  │  2. Download media from storage                              │    │  │
│  │  │  3. Execute action (may call AI providers)                   │    │  │
│  │  │  4. Upload result to storage                                 │    │  │
│  │  │  5. Update job status in database                            │    │  │
│  │  │  6. Send webhook notification                                │    │  │
│  │  └──────────────────────────────────────────────────────────────┘    │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       EXTERNAL SERVICES                                      │
│                                                                              │
│         ┌─────────────┐              ┌─────────────┐                        │
│         │   OpenAI    │              │  Anthropic  │                        │
│         │  - Whisper  │              │  - Claude   │                        │
│         │  - GPT-4V   │              │             │                        │
│         └─────────────┘              └─────────────┘                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Architecture Constraints
- **Monolithic Architecture**: Single deployable unit with logical module separation
- **No Paid Infrastructure**: Self-hosted storage (MinIO), self-managed database
- **Stateless API Servers**: All state in PostgreSQL/Redis for horizontal scaling
- **Plugin-Based Extensibility**: New actions/handlers without core code changes

### 1.3 Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Architecture Style | Monolith | Simpler deployment, no microservice overhead |
| API Framework | Fastify | Faster than Express, built-in validation, plugin system |
| Database | PostgreSQL | ACID compliance, JSONB support, multi-tenancy |
| Queue | BullMQ + Redis | Reliable, priority queues, job retry |
| Storage | MinIO | S3-compatible, self-hosted, free |
| Language | TypeScript | Type safety, better tooling |

---

## 2. Technology Stack

### 2.1 Core Stack

| Layer | Technology | Version |
|-------|------------|---------|
| **Runtime** | Node.js | 20 LTS |
| **Language** | TypeScript | 5.3+ |
| **Framework** | Fastify | 4.26+ |
| **Database** | PostgreSQL | 16+ |
| **ORM** | Prisma | 5.10+ |
| **Cache/Queue** | Redis | 7+ |
| **Job Queue** | BullMQ | 5.1+ |
| **Storage** | MinIO | Latest |

### 2.2 Media Processing

| Purpose | Library |
|---------|---------|
| **Image Processing** | Sharp |
| **Audio Processing** | FFmpeg + fluent-ffmpeg |
| **Image Metadata** | exif-reader |
| **Audio Metadata** | music-metadata |

### 2.3 AI Providers

| Provider | SDK | Used For |
|----------|-----|----------|
| **OpenAI** | openai ^4.28 | Whisper (transcription), GPT-4V (OCR, description) |
| **Anthropic** | @anthropic-ai/sdk ^0.17 | Claude (description, analysis) |

### 2.4 Key Dependencies

```json
{
  "dependencies": {
    "fastify": "^4.26",
    "@fastify/jwt": "^8.0",
    "@fastify/multipart": "^8.1",
    "@fastify/swagger": "^8.14",
    "@fastify/rate-limit": "^9.1",
    "@fastify/cors": "^9.0",
    "@prisma/client": "^5.10",
    "bullmq": "^5.1",
    "ioredis": "^5.3",
    "@aws-sdk/client-s3": "^3.500",
    "sharp": "^0.33",
    "fluent-ffmpeg": "^2.1",
    "music-metadata": "^7.14",
    "openai": "^4.28",
    "@anthropic-ai/sdk": "^0.17",
    "zod": "^3.22",
    "bcrypt": "^5.1",
    "pino": "^8.19"
  }
}
```

---

## 3. Project Structure

```
media-processing-api/
├── src/
│   ├── core/
│   │   ├── auth/
│   │   ├── database/
│   │   ├── queue/
│   │   ├── storage/
│   │   └── config/
│   ├── api/
│   │   ├── routes/
│   │   ├── middleware/
│   │   └── schemas/
│   ├── services/
│   ├── plugins/
│   │   ├── media-handlers/
│   │   ├── actions/
│   │   │   ├── image/
│   │   │   │   ├── img_ocr.ts
│   │   │   │   ├── img_describe.ts
│   │   │   │   ├── img_resize.ts
│   │   │   │   ├── img_crop.ts
│   │   │   │   ├── img_format_convert.ts
│   │   │   │   ├── img_analyze.ts
│   │   │   │   └── img_metadata.ts
│   │   │   └── audio/
│   │   │       ├── aud_transcribe.ts
│   │   │       ├── aud_translate.ts
│   │   │       ├── aud_trim.ts
│   │   │       ├── aud_format_convert.ts
│   │   │       ├── aud_volume.ts
│   │   │       ├── aud_analyze.ts
│   │   │       └── aud_generate_waveform.ts
│   │   ├── ai-providers/
│   │   └── storage-providers/
│   ├── types/
│   ├── utils/
│   ├── app.ts
│   └── server.ts
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── config/
├── tests/
├── docker/
└── package.json
```

---

## 4. Data Models

### 4.1 Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================
// ORGANIZATION & USERS
// ============================================

model Organization {
  id        String   @id @default(uuid())
  name      String   @db.VarChar(100)
  slug      String   @unique @db.VarChar(100)
  email     String   @db.VarChar(255)
  settings  Json     @default("{}")
  metadata  Json     @default("{}")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  deletedAt DateTime? @map("deleted_at")

  users        User[]
  apiKeys      ApiKey[]
  mediaFiles   MediaFile[]
  jobs         ProcessingJob[]
  usageRecords UsageRecord[]

  @@map("organizations")
}

model User {
  id             String     @id @default(uuid())
  organizationId String     @map("organization_id")
  email          String     @db.VarChar(255)
  passwordHash   String     @map("password_hash")
  name           String     @db.VarChar(100)
  role           UserRole   @default(MEMBER)
  status         UserStatus @default(ACTIVE)
  permissions    Json       @default("{}")
  lastLoginAt    DateTime?  @map("last_login_at")
  createdAt      DateTime   @default(now()) @map("created_at")
  updatedAt      DateTime   @updatedAt @map("updated_at")

  organization  Organization   @relation(fields: [organizationId], references: [id])
  apiKeys       ApiKey[]
  mediaFiles    MediaFile[]
  jobs          ProcessingJob[]
  refreshTokens RefreshToken[]
  usageRecords  UsageRecord[]

  @@unique([organizationId, email])
  @@index([organizationId])
  @@map("users")
}

enum UserRole {
  OWNER
  ADMIN
  MEMBER
}

enum UserStatus {
  ACTIVE
  INVITED
  SUSPENDED
}

model RefreshToken {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  token     String   @unique
  expiresAt DateTime @map("expires_at")
  createdAt DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("refresh_tokens")
}

// ============================================
// API KEYS
// ============================================

model ApiKey {
  id              String       @id @default(uuid())
  organizationId  String       @map("organization_id")
  createdByUserId String       @map("created_by_user_id")
  name            String       @db.VarChar(100)
  keyPrefix       String       @map("key_prefix") @db.VarChar(12)
  keyHash         String       @map("key_hash") @unique
  permissions     Json         @default("{}")
  rateLimits      Json         @default("{}") @map("rate_limits")
  status          ApiKeyStatus @default(ACTIVE)
  expiresAt       DateTime?    @map("expires_at")
  lastUsedAt      DateTime?    @map("last_used_at")
  createdAt       DateTime     @default(now()) @map("created_at")
  updatedAt       DateTime     @updatedAt @map("updated_at")

  organization  Organization    @relation(fields: [organizationId], references: [id])
  createdByUser User            @relation(fields: [createdByUserId], references: [id])
  mediaFiles    MediaFile[]
  jobs          ProcessingJob[]
  usageRecords  UsageRecord[]

  @@index([organizationId])
  @@map("api_keys")
}

enum ApiKeyStatus {
  ACTIVE
  SUSPENDED
  REVOKED
}

// ============================================
// MEDIA FILES
// ============================================

model MediaFile {
  id                 String          @id @default(uuid())
  organizationId     String          @map("organization_id")
  uploadedByUserId   String?         @map("uploaded_by_user_id")
  uploadedByApiKeyId String?         @map("uploaded_by_api_key_id")
  originalFilename   String          @map("original_filename") @db.VarChar(255)
  storedFilename     String          @map("stored_filename") @db.VarChar(255)
  mimeType           String          @map("mime_type") @db.VarChar(100)
  mediaType          MediaType       @map("media_type")
  fileSizeBytes      BigInt          @map("file_size_bytes")
  storagePath        String          @map("storage_path") @db.VarChar(500)
  thumbnailPath      String?         @map("thumbnail_path") @db.VarChar(500)
  metadata           Json            @default("{}")
  checksumMd5        String          @map("checksum_md5") @db.VarChar(32)
  checksumSha256     String          @map("checksum_sha256") @db.VarChar(64)
  status             MediaFileStatus @default(PROCESSING)
  expiresAt          DateTime        @map("expires_at")
  createdAt          DateTime        @default(now()) @map("created_at")
  updatedAt          DateTime        @updatedAt @map("updated_at")

  organization     Organization    @relation(fields: [organizationId], references: [id])
  uploadedByUser   User?           @relation(fields: [uploadedByUserId], references: [id])
  uploadedByApiKey ApiKey?         @relation(fields: [uploadedByApiKeyId], references: [id])
  jobsAsInput      ProcessingJob[] @relation("InputMedia")
  jobsAsResult     ProcessingJob[] @relation("ResultMedia")

  @@index([organizationId])
  @@index([organizationId, mediaType])
  @@index([expiresAt])
  @@map("media_files")
}

enum MediaType {
  IMAGE
  AUDIO
}

enum MediaFileStatus {
  PROCESSING
  READY
  FAILED
  DELETED
}

// ============================================
// PROCESSING JOBS
// ============================================

model ProcessingJob {
  id               String         @id @default(uuid())
  organizationId   String         @map("organization_id")
  userId           String?        @map("user_id")
  apiKeyId         String?        @map("api_key_id")
  inputMediaId     String         @map("input_media_id")
  actionId         String         @map("action_id") @db.VarChar(50)
  actionCategory   ActionCategory @map("action_category")
  parameters       Json           @default("{}")
  status           JobStatus      @default(PENDING)
  priority         Int            @default(50)
  workerId         String?        @map("worker_id")
  queuedAt         DateTime?      @map("queued_at")
  startedAt        DateTime?      @map("started_at")
  completedAt      DateTime?      @map("completed_at")
  resultType       ResultType?    @map("result_type")
  resultMediaId    String?        @map("result_media_id")
  resultData       Json?          @map("result_data")
  errorCode        String?        @map("error_code") @db.VarChar(50)
  errorMessage     String?        @map("error_message")
  retryCount       Int            @default(0) @map("retry_count")
  maxRetries       Int            @default(3) @map("max_retries")
  processingTimeMs Int?           @map("processing_time_ms")
  aiProvider       String?        @map("ai_provider") @db.VarChar(50)
  aiTokensUsed     Int?           @map("ai_tokens_used")
  createdAt        DateTime       @default(now()) @map("created_at")
  updatedAt        DateTime       @updatedAt @map("updated_at")

  organization Organization  @relation(fields: [organizationId], references: [id])
  user         User?         @relation(fields: [userId], references: [id])
  apiKey       ApiKey?       @relation(fields: [apiKeyId], references: [id])
  inputMedia   MediaFile     @relation("InputMedia", fields: [inputMediaId], references: [id])
  resultMedia  MediaFile?    @relation("ResultMedia", fields: [resultMediaId], references: [id])
  usageRecords UsageRecord[]

  @@index([organizationId])
  @@index([organizationId, status])
  @@index([status, priority])
  @@map("processing_jobs")
}

enum ActionCategory {
  TRANSCRIBE
  MODIFY
  PROCESS
}

enum JobStatus {
  PENDING
  QUEUED
  PROCESSING
  COMPLETED
  FAILED
  CANCELLED
}

enum ResultType {
  FILE
  JSON
  FILES
}

// ============================================
// USAGE TRACKING
// ============================================

model UsageRecord {
  id               String          @id @default(uuid())
  organizationId   String          @map("organization_id")
  userId           String?         @map("user_id")
  apiKeyId         String?         @map("api_key_id")
  jobId            String?         @map("job_id")
  actionType       UsageActionType @map("action_type")
  actionId         String?         @map("action_id") @db.VarChar(50)
  mediaType        String?         @map("media_type") @db.VarChar(20)
  fileSizeBytes    BigInt?         @map("file_size_bytes")
  processingTimeMs Int?            @map("processing_time_ms")
  aiTokensUsed     Int?            @map("ai_tokens_used")
  requestIp        String          @map("request_ip") @db.VarChar(45)
  userAgent        String?         @map("user_agent") @db.VarChar(500)
  endpoint         String          @db.VarChar(200)
  httpMethod       String          @map("http_method") @db.VarChar(10)
  responseStatus   Int             @map("response_status")
  creditsUsed      Decimal         @default(0) @map("credits_used") @db.Decimal(10, 4)
  timestamp        DateTime        @default(now())

  organization Organization    @relation(fields: [organizationId], references: [id])
  user         User?           @relation(fields: [userId], references: [id])
  apiKey       ApiKey?         @relation(fields: [apiKeyId], references: [id])
  job          ProcessingJob?  @relation(fields: [jobId], references: [id])

  @@index([organizationId, timestamp])
  @@index([apiKeyId, timestamp])
  @@map("usage_records")
}

enum UsageActionType {
  UPLOAD
  PROCESS
  DOWNLOAD
  API_CALL
}
```

---

## 5. Plugin System Architecture

### 5.1 Action Handler Interface

```typescript
import { JSONSchema7 } from 'json-schema';

export interface ActionHandler {
  readonly actionId: string;
  readonly displayName: string;
  readonly buttonLabel: string;
  readonly description: string;
  readonly icon: string;
  readonly mediaType: 'image' | 'audio';
  readonly category: 'transcribe' | 'modify' | 'process';
  readonly inputSchema: JSONSchema7;
  readonly outputSchema: JSONSchema7;

  validate(params: Record<string, unknown>): ValidationResult;
  execute(context: ActionContext): Promise<ActionResult>;
}

export interface ActionContext {
  file: Buffer;
  fileInfo: MediaFileInfo;
  params: Record<string, unknown>;
  aiProviders: AIProviderRegistry;
  storage: StorageProvider;
  logger: Logger;
}

export interface ActionResult {
  type: 'file' | 'json' | 'files';
  file?: Buffer;
  files?: Buffer[];
  data?: Record<string, unknown>;
  mimeType?: string;
}
```

### 5.2 Available Actions (14 total)

#### Image Actions (7)
| Action ID | Category | Description |
|-----------|----------|-------------|
| `img_ocr` | TRANSCRIBE | Extract text using OCR |
| `img_describe` | TRANSCRIBE | AI image description |
| `img_resize` | MODIFY | Change dimensions |
| `img_crop` | MODIFY | Crop to region |
| `img_format_convert` | MODIFY | Convert format |
| `img_analyze` | PROCESS | Comprehensive analysis |
| `img_metadata` | PROCESS | Extract EXIF data |

#### Audio Actions (7)
| Action ID | Category | Description |
|-----------|----------|-------------|
| `aud_transcribe` | TRANSCRIBE | Speech to text (with language detection) |
| `aud_translate` | TRANSCRIBE | Transcribe and translate |
| `aud_trim` | MODIFY | Cut audio range |
| `aud_format_convert` | MODIFY | Convert format |
| `aud_volume` | MODIFY | Adjust volume |
| `aud_analyze` | PROCESS | Audio analysis |
| `aud_generate_waveform` | PROCESS | Visual waveform |

### 5.3 Adding a New Action

1. Create action file in `/plugins/actions/{media_type}/`
2. Implement `ActionHandler` interface
3. Define `inputSchema` for form generation
4. System auto-discovers on startup

---

## 6. Configuration

### 6.1 Environment Variables

```bash
# Application
NODE_ENV=production
PORT=3000
API_BASE_URL=https://api.example.com

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/media_api

# Redis
REDIS_URL=redis://localhost:6379

# MinIO
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=media-files

# Authentication
JWT_SECRET=your-secret-key-min-32-chars
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
BCRYPT_ROUNDS=12

# AI Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Queue
QUEUE_CONCURRENCY=5
JOB_TIMEOUT_MS=300000
JOB_MAX_RETRIES=3

# Limits
MAX_FILE_SIZE_MB=50
DEFAULT_RETENTION_DAYS=30
```

### 6.2 Configuration File

```yaml
# config/default.yaml

media:
  image:
    max_file_size_mb: 50
    max_resolution: 8192
    supported_formats: [jpeg, png, webp, gif, bmp, tiff]
    thumbnail:
      width: 200
      height: 200
      quality: 80
  audio:
    max_file_size_mb: 100
    max_duration_minutes: 60
    supported_formats: [mp3, wav, flac, ogg, m4a, webm]

actions:
  enabled:
    # Image
    - img_ocr
    - img_describe
    - img_resize
    - img_crop
    - img_format_convert
    - img_analyze
    - img_metadata
    # Audio
    - aud_transcribe
    - aud_translate
    - aud_trim
    - aud_format_convert
    - aud_volume
    - aud_analyze
    - aud_generate_waveform

  ai_provider_mapping:
    img_ocr: openai
    img_describe: anthropic
    aud_transcribe: openai
    aud_translate: openai

defaults:
  organization:
    max_users: 0           # 0 = unlimited
    max_api_keys: 0
    storage_gb: 10
    requests_per_day: 10000
    max_file_size_mb: 50
    retention_days: 30
    concurrent_jobs: 10
```

---

## 7. Docker Compose

```yaml
version: '3.8'

services:
  api:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/media_api
      - REDIS_URL=redis://redis:6379
      - MINIO_ENDPOINT=minio
    depends_on:
      - postgres
      - redis
      - minio

  worker:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    command: npm run worker
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/media_api
      - REDIS_URL=redis://redis:6379
      - MINIO_ENDPOINT=minio
    depends_on:
      - postgres
      - redis
      - minio

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: media_api
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    volumes:
      - minio_data:/data
    ports:
      - "9000:9000"
      - "9001:9001"

volumes:
  postgres_data:
  redis_data:
  minio_data:
```

---

## 8. API Endpoints

### 8.1 Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Register new organization and owner account |
| POST | `/api/v1/auth/login` | User login, returns JWT tokens |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| POST | `/api/v1/auth/logout` | Invalidate refresh token |

### 8.2 Organization Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/organizations/:id` | Get organization details |
| PUT | `/api/v1/organizations/:id` | Update organization settings |
| DELETE | `/api/v1/organizations/:id` | Delete organization (owner only) |
| GET | `/api/v1/organizations/:id/users` | List organization users |
| POST | `/api/v1/organizations/:id/users` | Invite user to organization |
| DELETE | `/api/v1/organizations/:id/users/:userId` | Remove user |
| PUT | `/api/v1/organizations/:id/users/:userId/role` | Update user role |

### 8.3 API Key Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/api-keys` | List all API keys (masked) |
| POST | `/api/v1/api-keys` | Create new API key |
| GET | `/api/v1/api-keys/:id` | Get API key details |
| PUT | `/api/v1/api-keys/:id` | Update API key settings |
| DELETE | `/api/v1/api-keys/:id` | Revoke API key |
| POST | `/api/v1/api-keys/:id/rotate` | Rotate API key secret |

### 8.4 Media Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/media/upload` | Upload media file (multipart/form-data) |
| GET | `/api/v1/media` | List uploaded media (paginated) |
| GET | `/api/v1/media/:id` | Get media metadata |
| GET | `/api/v1/media/:id/download` | Download original file |
| GET | `/api/v1/media/:id/thumbnail` | Get auto-generated thumbnail (images only) |
| DELETE | `/api/v1/media/:id` | Delete media file |

### 8.5 Actions & Processing
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/actions` | List all available actions |
| GET | `/api/v1/actions/:mediaType` | List actions for media type |
| GET | `/api/v1/actions/:mediaType/:actionId` | Get action details & input schema |
| POST | `/api/v1/process` | Submit processing job |
| GET | `/api/v1/jobs` | List jobs (paginated, filterable) |
| GET | `/api/v1/jobs/:id` | Get job status |
| GET | `/api/v1/jobs/:id/result` | Get/download job result |
| DELETE | `/api/v1/jobs/:id` | Cancel pending job |

### 8.6 Usage & Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/usage` | Get usage summary |
| GET | `/api/v1/usage/detailed` | Detailed usage breakdown |

### 8.7 System
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/health` | Health check |
| GET | `/api/v1/supported-formats` | List supported media formats |
| GET | `/api/v1/rate-limits` | Get current rate limit status |

---

## 9. Rate Limit Response Headers

```
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 299
X-RateLimit-Reset: 1640995200
Retry-After: 30 (only on 429)
```

---

## 10. Webhook Technical Details

### 10.1 Webhook Payload Example
```json
{
  "event": "job.completed",
  "timestamp": "2024-01-15T10:30:00Z",
  "organization_id": "org_abc123",
  "data": {
    "job_id": "job_xyz789",
    "action_id": "img_ocr",
    "status": "completed",
    "result_url": "https://api.example.com/v1/jobs/job_xyz789/result"
  }
}
```

### 10.2 Webhook Configuration
- HMAC-SHA256 signature for verification
- Automatic retry (3 attempts with exponential backoff)
- 30-second timeout per attempt

---

## 11. Error Handling

### 11.1 Error Response Format
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "File size exceeds maximum allowed (50MB)",
    "details": {
      "field": "file",
      "max_size_mb": 50,
      "actual_size_mb": 75
    },
    "request_id": "req_a1b2c3d4"
  }
}
```

### 11.2 Error Codes

| HTTP | Code | Description |
|------|------|-------------|
| 400 | `VALIDATION_ERROR` | Invalid request parameters |
| 400 | `INVALID_FILE_TYPE` | Unsupported media format |
| 400 | `FILE_TOO_LARGE` | File exceeds size limit |
| 400 | `INVALID_ACTION` | Action not found or not applicable |
| 401 | `UNAUTHORIZED` | Missing or invalid credentials |
| 401 | `TOKEN_EXPIRED` | JWT token has expired |
| 401 | `INVALID_API_KEY` | API key not found or revoked |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 403 | `LIMIT_EXCEEDED` | Organization limit reached |
| 404 | `NOT_FOUND` | Resource not found |
| 409 | `CONFLICT` | Resource already exists |
| 429 | `RATE_LIMITED` | Too many requests |
| 429 | `QUOTA_EXCEEDED` | Usage quota exceeded |
| 500 | `INTERNAL_ERROR` | Server error |
| 502 | `AI_PROVIDER_ERROR` | External AI service error |
| 503 | `SERVICE_UNAVAILABLE` | Service temporarily unavailable |

---

## 12. Usage Tracking Details

### 12.1 Per Request Metrics
- Timestamp
- Endpoint and HTTP method
- Response status and time
- Request/response size
- API key or user ID
- IP address

### 12.2 Per Processing Job Metrics
- Action type and parameters
- Input/output file sizes
- Processing duration
- AI provider used
- Queue wait time

### 12.3 Aggregated Reports
- Total requests by endpoint
- Processing jobs by action type
- Storage utilization
- Bandwidth consumption
- Error rates

---

## 13. Non-Functional Requirements

### 13.1 Performance Targets

| Metric | Target |
|--------|--------|
| API response time (p95) | < 200ms |
| File upload throughput | 50 MB/s |
| Job queue latency | < 5 seconds |
| Database query time (p95) | < 50ms |

### 13.2 Security Requirements

| Requirement | Implementation |
|-------------|----------------|
| Data at rest | AES-256 encryption |
| Data in transit | TLS 1.3 |
| Passwords | bcrypt (cost 12) |
| API keys | SHA-256 hash |
| SQL injection | Prisma parameterized queries |

### 13.3 Testing Requirements

| Type | Coverage |
|------|----------|
| Unit tests | 80% minimum |
| Integration tests | All API endpoints |
| E2E tests | Critical workflows |

---

## 14. Deliverables Checklist

### 14.1 Required
- [x] Working API
- [x] OpenAPI specification
- [x] Setup instructions (see SETUP_PROGRESS.md)
- [x] Database migrations
- [x] Docker Compose setup
- [x] Architecture decision document

### 14.2 Code Quality
- [x] TypeScript strict mode
- [x] ESLint + Prettier
- [x] Error handling
- [x] Input validation (Zod schemas)
- [x] Structured logging (Pino)

### 14.3 Frontend
- [x] React 18 + TypeScript + Vite
- [x] TailwindCSS styling
- [x] React Router for navigation
- [x] TanStack React Query for data fetching
- [x] Zustand for auth state management
- [x] React Hook Form + Zod for form validation
- [x] Recharts for usage analytics charts
- [x] Sonner for toast notifications

---

*Document Version: 3.0*
*Last Updated: 2026-02-11*
