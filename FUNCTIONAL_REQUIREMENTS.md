# Media Processing API - Functional Requirements

## 1. Overview

### 1.1 Purpose
A RESTful API that enables users to upload media files (images and audio) and apply AI-powered processing actions. The system supports multi-tenancy with organization-based access control and comprehensive usage tracking.

### 1.2 Key Features
- Media file upload and management (images and audio)
- AI-powered transcription, modification, and analysis actions
- Multi-tenant architecture with organizations and users
- API key management for programmatic access
- Usage tracking and rate limiting
- Webhook notifications for async job completion

---

## 2. Supported Media Types

### 2.1 Image Files
| Format | MIME Type | Max File Size | Min Resolution | Max Resolution |
|--------|-----------|---------------|----------------|----------------|
| JPEG | image/jpeg | 20 MB | 50x50 px | 8192x8192 px |
| PNG | image/png | 25 MB | 50x50 px | 8192x8192 px |
| WebP | image/webp | 20 MB | 50x50 px | 8192x8192 px |
| GIF | image/gif | 15 MB | 50x50 px | 4096x4096 px |
| BMP | image/bmp | 30 MB | 50x50 px | 8192x8192 px |
| TIFF | image/tiff | 50 MB | 50x50 px | 8192x8192 px |

### 2.2 Audio Files
| Format | MIME Type | Max File Size | Max Duration | Sample Rate Range |
|--------|-----------|---------------|--------------|-------------------|
| MP3 | audio/mpeg | 50 MB | 60 minutes | 8000 - 48000 Hz |
| WAV | audio/wav | 100 MB | 30 minutes | 8000 - 96000 Hz |
| FLAC | audio/flac | 100 MB | 60 minutes | 8000 - 96000 Hz |
| OGG | audio/ogg | 50 MB | 60 minutes | 8000 - 48000 Hz |
| M4A | audio/mp4 | 50 MB | 60 minutes | 8000 - 48000 Hz |
| WebM | audio/webm | 50 MB | 60 minutes | 8000 - 48000 Hz |

### 2.3 Future Extensibility
The system is designed to support additional media types (e.g., video, documents) through a plugin architecture without core code changes.

---

## 3. User Interaction Flow

### 3.1 Media Upload Flow
```
1. User authenticates (JWT token or API key)
2. User uploads media file via POST /api/v1/media/upload
3. System validates file type, size, and format
4. System extracts metadata and stores file
5. System auto-generates thumbnail (for images)
6. System returns media ID and metadata
```

### 3.2 Action Processing Flow
```
1. User views available actions for their uploaded media
2. Actions displayed as buttons grouped by category (TRANSCRIBE | MODIFY | PROCESS)
3. User clicks an action button (e.g., "Resize", "Transcribe")
4. System displays dynamic form with required/optional parameters
5. User fills in parameters and submits
6. System creates processing job and returns job ID
7. User polls job status or receives webhook notification
8. User downloads result (file) or views result (JSON)
```

### 3.3 Action Parameter Forms
- Dynamically generated from each action's schema definition
- Required fields clearly marked with validation
- Optional/advanced fields in collapsible section
- Real-time validation with helpful error messages
- Preview capability where applicable (e.g., crop area selection)

---

## 4. Actions Specification

### 4.1 Image Actions (7 total)

#### TRANSCRIBE Actions (Extract information from images)
| Action | Button Label | Description | User Inputs |
|--------|--------------|-------------|-------------|
| **OCR Text Extraction** | Extract Text | Extract text from images using AI-powered OCR | Language (optional), Enhanced mode (checkbox) |
| **Image Description** | Describe | Generate natural language description of image content | Detail level (brief/detailed/comprehensive), Output language |

#### MODIFY Actions (Transform the image)
| Action | Button Label | Description | User Inputs |
|--------|--------------|-------------|-------------|
| **Resize Image** | Resize | Change image dimensions | Width (px), Height (px), Mode (fit/fill/stretch), Lock aspect ratio |
| **Crop Image** | Crop | Crop to specified region | Interactive crop selector OR X, Y, Width, Height values |
| **Convert Format** | Convert | Convert to different image format | Target format (JPEG/PNG/WebP), Quality (1-100 slider) |

#### PROCESS Actions (Analyze without modifying)
| Action | Button Label | Description | User Inputs |
|--------|--------------|-------------|-------------|
| **Image Analysis** | Analyze | Comprehensive image analysis | Checkboxes: Colors, Faces, Objects, Text, NSFW detection |
| **Extract Metadata** | Metadata | Extract EXIF and technical metadata | Include raw data (checkbox) |

---

### 4.2 Audio Actions (7 total)

#### TRANSCRIBE Actions (Extract information from audio)
| Action | Button Label | Description | User Inputs |
|--------|--------------|-------------|-------------|
| **Speech to Text** | Transcribe | Convert speech to text with timestamps | Language (auto-detect available), Enable punctuation, Speaker diarization, Max speakers |
| **Translate Audio** | Translate | Transcribe and translate to another language | Source language (auto-detect), Target language (required) |

#### MODIFY Actions (Transform the audio)
| Action | Button Label | Description | User Inputs |
|--------|--------------|-------------|-------------|
| **Trim Audio** | Trim | Cut audio to specified time range | Start time (waveform selector), End time, Preview button |
| **Convert Format** | Convert | Convert to different audio format | Target format (MP3/WAV/FLAC/OGG), Bitrate, Sample rate |
| **Adjust Volume** | Volume | Change audio volume level | Volume slider (-20 to +20 dB), Normalize (checkbox) |

#### PROCESS Actions (Analyze without modifying)
| Action | Button Label | Description | User Inputs |
|--------|--------------|-------------|-------------|
| **Audio Analysis** | Analyze | Comprehensive audio analysis | Checkboxes: Duration, BPM, Musical key, Loudness, Spectrum |
| **Generate Waveform** | Waveform | Create visual waveform image | Width, Height, Color picker, Format (PNG/SVG) |

---

### 4.3 Action Output Types

| Output Type | Description | User Experience |
|-------------|-------------|-----------------|
| **JSON Result** | Structured data (transcriptions, analysis) | Displayed in formatted view, copyable, downloadable as JSON |
| **Modified File** | Transformed media file | Preview + download button |
| **Multiple Files** | Multiple output files (e.g., waveform image) | List with individual download buttons |

---

## 5. API Endpoints

### 5.1 Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Register new organization and owner account |
| POST | `/api/v1/auth/login` | User login, returns JWT tokens |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| POST | `/api/v1/auth/logout` | Invalidate refresh token |

### 5.2 Organization Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/organizations/:id` | Get organization details |
| PUT | `/api/v1/organizations/:id` | Update organization settings |
| DELETE | `/api/v1/organizations/:id` | Delete organization (owner only) |
| GET | `/api/v1/organizations/:id/users` | List organization users |
| POST | `/api/v1/organizations/:id/users` | Invite user to organization |
| DELETE | `/api/v1/organizations/:id/users/:userId` | Remove user |
| PUT | `/api/v1/organizations/:id/users/:userId/role` | Update user role |

### 5.3 API Key Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/api-keys` | List all API keys (masked) |
| POST | `/api/v1/api-keys` | Create new API key |
| GET | `/api/v1/api-keys/:id` | Get API key details |
| PUT | `/api/v1/api-keys/:id` | Update API key settings |
| DELETE | `/api/v1/api-keys/:id` | Revoke API key |
| POST | `/api/v1/api-keys/:id/rotate` | Rotate API key secret |

### 5.4 Media Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/media/upload` | Upload media file (multipart/form-data) |
| GET | `/api/v1/media` | List uploaded media (paginated) |
| GET | `/api/v1/media/:id` | Get media metadata |
| GET | `/api/v1/media/:id/download` | Download original file |
| GET | `/api/v1/media/:id/thumbnail` | Get auto-generated thumbnail (images only) |
| DELETE | `/api/v1/media/:id` | Delete media file |

### 5.5 Actions & Processing
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

### 5.6 Usage & Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/usage` | Get usage summary |
| GET | `/api/v1/usage/detailed` | Detailed usage breakdown |

### 5.7 System
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/health` | Health check |
| GET | `/api/v1/supported-formats` | List supported media formats |
| GET | `/api/v1/rate-limits` | Get current rate limit status |

---

## 6. Multi-Tenancy

### 6.1 Organization Structure
```
Organization
├── Settings (limits, webhooks, retention)
├── Users
│   ├── Owner (1 per org)
│   ├── Admins
│   └── Members
├── API Keys
├── Media Files
└── Processing Jobs
```

### 6.2 User Roles & Permissions (3 roles)

| Permission | Owner | Admin | Member |
|------------|:-----:|:-----:|:------:|
| View organization settings | ✓ | ✓ | ✓ |
| Update organization settings | ✓ | ✓ | ✗ |
| Delete organization | ✓ | ✗ | ✗ |
| Manage users | ✓ | ✓ | ✗ |
| Create API keys | ✓ | ✓ | ✓ |
| Delete any API key | ✓ | ✓ | ✗ |
| Delete own API key | ✓ | ✓ | ✓ |
| Upload media | ✓ | ✓ | ✓ |
| Process media | ✓ | ✓ | ✓ |
| View all jobs | ✓ | ✓ | ✓ |
| Delete media | ✓ | ✓ | Own only |
| View usage reports | ✓ | ✓ | Own only |

### 6.3 Organization Limits (Configurable)

| Limit | Default Value | Description |
|-------|---------------|-------------|
| Max Users | Unlimited | Maximum users per organization |
| Max API Keys | Unlimited | Maximum API keys per organization |
| Storage | 10 GB | Total storage quota |
| Requests/day | 10,000 | Maximum API requests per day |
| Max file size | 50 MB | Maximum single file upload |
| File retention | 30 days | Auto-delete files after this period |
| Concurrent jobs | 10 | Maximum simultaneous processing jobs |

---

## 7. Usage Tracking

### 7.1 Tracked Metrics

**Per Request:**
- Timestamp
- Endpoint and HTTP method
- Response status and time
- Request/response size
- API key or user ID
- IP address

**Per Processing Job:**
- Action type and parameters
- Input/output file sizes
- Processing duration
- AI provider used
- Queue wait time

**Aggregated Reports:**
- Total requests by endpoint
- Processing jobs by action type
- Storage utilization
- Bandwidth consumption
- Error rates

### 7.2 Usage Dashboard Features
- Real-time usage metrics
- Historical charts (daily/weekly/monthly)
- Breakdown by user, API key, or action
- Quota warnings and alerts

---

## 8. Rate Limiting

### 8.1 Default Limits

| Scope | Window | Default Limit |
|-------|--------|---------------|
| Per API Key | Per minute | 300 requests |
| Per API Key | Per day | 10,000 requests |
| Per API Key | Per hour | 200 uploads |
| Per API Key | Per hour | 500 processing jobs |
| Per User | Per minute | 500 requests |
| Per Organization | Per minute | 1,000 requests |
| Per IP Address | Per minute | 100 requests |

### 8.2 Rate Limit Response Headers
```
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 299
X-RateLimit-Reset: 1640995200
Retry-After: 30 (only on 429)
```

---

## 9. Webhooks

### 9.1 Supported Events
| Event | Description | When Triggered |
|-------|-------------|----------------|
| `job.completed` | Processing job finished | Job status → completed |
| `job.failed` | Processing job failed | Job status → failed (after retries) |
| `quota.warning` | Approaching quota limit | At 80%, 90%, 95% usage |
| `quota.exceeded` | Quota limit reached | At 100% usage |

### 9.2 Webhook Payload Example
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

### 9.3 Webhook Configuration
- Configure webhook URL in organization settings
- HMAC-SHA256 signature for verification
- Automatic retry (3 attempts with exponential backoff)
- 30-second timeout per attempt

---

## 10. Error Handling

### 10.1 Error Response Format
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

### 10.2 Error Codes

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

## 11. Automatic Features

### 11.1 Auto-Generated Thumbnails
- System automatically generates thumbnails for all uploaded images
- Thumbnail size: 200x200 px (smart crop to maintain aspect ratio)
- Available via `/api/v1/media/:id/thumbnail`
- Generated asynchronously after upload

### 11.2 Language Detection in Transcription
- `aud_transcribe` action automatically detects spoken language
- Language returned in response: `{ "detected_language": "en", ... }`
- User can override with explicit language parameter

---

## 12. Deliverables Checklist

### 12.1 Core Functionality
- [x] User registration and authentication
- [x] Organization and user management
- [x] API key creation and management
- [x] Media file upload (multipart)
- [x] Auto-thumbnail generation for images
- [x] All 14 processing actions implemented
- [x] Job queue with status tracking
- [x] Result storage and retrieval
- [x] Usage tracking and reporting

### 12.2 API Requirements
- [x] RESTful API following specifications
- [x] OpenAPI 3.0 documentation
- [x] Swagger UI for API exploration
- [x] Proper error responses
- [x] Rate limiting with headers
- [ ] Webhook delivery system (configured in settings, not yet implemented)

### 12.3 Frontend
- [x] Login / Register pages
- [x] Dashboard with usage overview
- [x] Media library with upload
- [x] Processing page with action selection
- [x] Jobs list with status tracking
- [x] Settings page (organization, AI providers, webhooks, limits)
- [x] API keys management page
- [x] Team management page
- [x] Usage analytics page
- [x] Super admin panel (organization management)

### 12.4 Infrastructure
- [x] Docker Compose for PostgreSQL, Redis, MinIO
- [x] Database schema with Prisma migrations
- [x] Seed script for initial super admin user
- [x] Per-user AI API key encryption and storage
- [x] BullMQ worker with priority queues (high/normal/low)

---

*Document Version: 2.1*
*Last Updated: 2026-02-11*
