# Media Processing API

A Node.js/Fastify backend for media file processing with image and audio transformations.

## Quick Start

### Prerequisites

- Node.js 20+
- Docker and Docker Compose

### Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start infrastructure (PostgreSQL, Redis, MinIO):**
   ```bash
   docker-compose up -d
   ```

4. **Run database migrations:**
   ```bash
   npm run db:generate
   npm run db:migrate
   ```

5. **Start the API server:**
   ```bash
   npm run dev
   ```

6. **Start the worker (in a separate terminal):**
   ```bash
   npm run worker:dev
   ```

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new organization
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/refresh` - Refresh tokens
- `POST /api/v1/auth/logout` - Logout
- `GET /api/v1/auth/me` - Get current user

### Organizations
- `GET /api/v1/organizations/:id` - Get organization
- `PUT /api/v1/organizations/:id` - Update organization

### Users
- `GET /api/v1/organizations/:id/users` - List users
- `POST /api/v1/organizations/:id/users` - Create user
- `GET /api/v1/organizations/:id/users/:userId` - Get user
- `PUT /api/v1/organizations/:id/users/:userId` - Update user
- `DELETE /api/v1/organizations/:id/users/:userId` - Delete user

### API Keys
- `GET /api/v1/api-keys` - List API keys
- `POST /api/v1/api-keys` - Create API key
- `GET /api/v1/api-keys/:id` - Get API key
- `PUT /api/v1/api-keys/:id` - Update API key
- `DELETE /api/v1/api-keys/:id` - Delete API key
- `POST /api/v1/api-keys/:id/rotate` - Rotate API key

### Media
- `POST /api/v1/media/upload` - Upload media file
- `GET /api/v1/media` - List media files
- `GET /api/v1/media/:id` - Get media details
- `GET /api/v1/media/:id/download` - Download media
- `GET /api/v1/media/:id/thumbnail` - Get thumbnail
- `DELETE /api/v1/media/:id` - Delete media

### Actions
- `GET /api/v1/actions` - List all actions
- `GET /api/v1/actions/:mediaType` - List actions by media type
- `GET /api/v1/actions/:mediaType/:actionId` - Get action details

### Jobs
- `POST /api/v1/process` - Create processing job
- `GET /api/v1/jobs` - List jobs
- `GET /api/v1/jobs/:id` - Get job details
- `GET /api/v1/jobs/:id/result` - Get job result
- `DELETE /api/v1/jobs/:id` - Cancel job

### Usage
- `GET /api/v1/usage` - Get usage summary
- `GET /api/v1/usage/detailed` - Get detailed usage
- `GET /api/v1/usage/records` - Get usage records

### System
- `GET /api/v1/health` - Health check
- `GET /api/v1/supported-formats` - Get supported formats
- `GET /api/v1/rate-limits` - Get rate limit info
- `GET /api/v1/queue-stats` - Get queue statistics
- `GET /api/v1/ai-providers` - Get AI provider status

## Available Actions

### Image Actions
- `img_ocr` - Extract text using OCR
- `img_describe` - AI image description
- `img_resize` - Resize image
- `img_crop` - Crop image
- `img_format_convert` - Convert format
- `img_analyze` - Comprehensive analysis
- `img_metadata` - Extract metadata

### Audio Actions
- `aud_transcribe` - Speech to text
- `aud_translate` - Transcribe and translate to English
- `aud_trim` - Cut audio range
- `aud_format_convert` - Convert format
- `aud_volume` - Adjust volume
- `aud_analyze` - Audio analysis
- `aud_generate_waveform` - Generate waveform image

## API Documentation

Swagger UI is available at `/docs` when the server is running.

## Project Structure

```
backend/
├── src/
│   ├── api/
│   │   ├── middleware/
│   │   └── routes/
│   ├── core/
│   │   ├── auth/
│   │   ├── database/
│   │   ├── queue/
│   │   └── storage/
│   ├── plugins/
│   │   ├── actions/
│   │   │   ├── image/
│   │   │   └── audio/
│   │   ├── ai-providers/
│   │   └── media-handlers/
│   ├── services/
│   ├── types/
│   ├── utils/
│   ├── workers/
│   ├── app.ts
│   └── server.ts
├── prisma/
│   └── schema.prisma
├── docker-compose.yml
└── package.json
```
