# Media Processing API - Functional Requirements

## 1. Overview

### 1.1 Purpose
An application that enables users to upload media files (images and audio) and apply AI-powered processing actions. The system supports multi-tenancy with organization-based access control and comprehensive usage tracking.

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
| Format | Max File Size |
|--------|---------------|
| JPEG | 20 MB |
| PNG | 25 MB |
| WebP | 20 MB |
| GIF | 15 MB |
| BMP | 30 MB |
| TIFF | 50 MB |

### 2.2 Audio Files
| Format | Max File Size | Max Duration |
|--------|---------------|--------------|
| MP3 | 50 MB | 60 minutes |
| WAV | 100 MB | 30 minutes |
| FLAC | 100 MB | 60 minutes |
| OGG | 50 MB | 60 minutes |
| M4A | 50 MB | 60 minutes |
| WebM | 50 MB | 60 minutes |

### 2.3 Future Extensibility
The system is designed to support additional media types (e.g., video, documents) through a plugin architecture without core code changes.

---

## 3. User Interaction Flow

### 3.1 Media Upload Flow
1. User authenticates (via login or API key)
2. User uploads a media file
3. System validates file type, size, and format
4. System extracts metadata and stores file
5. System auto-generates a thumbnail (for images)
6. System returns media details and metadata

### 3.2 Action Processing Flow
1. User views available actions for their uploaded media
2. Actions are displayed as buttons grouped by category (TRANSCRIBE | MODIFY | PROCESS)
3. User clicks an action button (e.g., "Resize", "Transcribe")
4. System displays a dynamic form with required/optional parameters
5. User fills in parameters and submits
6. System creates a processing job and returns a job reference
7. User polls job status or receives a webhook notification
8. User downloads the result (file) or views the result (structured data)

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

## 5. Multi-Tenancy

### 5.1 Organization Structure
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

### 5.2 User Roles & Permissions (3 roles)

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

### 5.3 Organization Limits (Configurable)

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

## 6. Usage Tracking

### 6.1 What Is Tracked
- Processing jobs by action type
- Storage utilization
- Bandwidth consumption
- Error rates

### 6.2 Usage Dashboard Features
- Real-time usage metrics
- Historical charts (daily/weekly/monthly)
- Breakdown by user, API key, or action
- Quota warnings and alerts

---

## 7. Rate Limiting

### 7.1 Default Limits

| Scope | Window | Default Limit |
|-------|--------|---------------|
| Per API Key | Per minute | 300 requests |
| Per API Key | Per day | 10,000 requests |
| Per API Key | Per hour | 200 uploads |
| Per API Key | Per hour | 500 processing jobs |
| Per User | Per minute | 500 requests |
| Per Organization | Per minute | 1,000 requests |
| Per IP Address | Per minute | 100 requests |

When a rate limit is exceeded, the user receives an error and must wait before retrying. Response headers indicate remaining quota and reset time.

---

## 8. Webhooks

### 8.1 Supported Events
| Event | Description | When Triggered |
|-------|-------------|----------------|
| Job completed | Processing job finished successfully | Job finishes processing |
| Job failed | Processing job failed | Job fails after all retries |
| Quota warning | Approaching quota limit | At 80%, 90%, 95% usage |
| Quota exceeded | Quota limit reached | At 100% usage |

### 8.2 Webhook Configuration
- Webhook URL is configured in organization settings
- Events are delivered with automatic retries on failure

---

## 9. Automatic Features

### 9.1 Auto-Generated Thumbnails
- System automatically generates thumbnails for all uploaded images
- Thumbnail size: 200x200 px (smart crop to maintain aspect ratio)
- Generated asynchronously after upload

### 9.2 Language Detection in Transcription
- The Speech to Text action automatically detects the spoken language
- Detected language is included in the result
- User can override with an explicit language parameter

---

## 10. Deliverables Checklist

### 10.1 Core Functionality
- [x] User registration and authentication
- [x] Organization and user management
- [x] API key creation and management
- [x] Media file upload (multipart)
- [x] Auto-thumbnail generation for images
- [x] All 14 processing actions implemented
- [x] Job queue with status tracking
- [x] Result storage and retrieval
- [x] Usage tracking and reporting

### 10.2 API Requirements
- [x] RESTful API following specifications
- [x] OpenAPI 3.0 documentation
- [x] Swagger UI for API exploration
- [x] Proper error responses
- [x] Rate limiting with headers
- [ ] Webhook delivery system (configured in settings, not yet implemented)

### 10.3 Frontend
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

### 10.4 Infrastructure
- [x] Docker Compose for PostgreSQL, Redis, MinIO
- [x] Database schema with Prisma migrations
- [x] Seed script for initial super admin user
- [x] Per-user AI API key encryption and storage
- [x] BullMQ worker with priority queues (high/normal/low)

---

*Document Version: 3.0*
*Last Updated: 2026-02-11*
