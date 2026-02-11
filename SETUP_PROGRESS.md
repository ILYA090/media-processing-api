# Setup Progress - Media Processing API

## Status: Fully Implemented

Both the backend API and frontend UI are complete and functional.

---

## How to Start the Project

### Prerequisites

- **Node.js** >= 20.0.0
- **Docker & Docker Compose** (for PostgreSQL, Redis, MinIO)
- **FFmpeg** installed and available in PATH (required for audio processing actions)

### Step 1: Start Infrastructure (Docker)

```bash
cd backend
docker-compose up -d
```

This starts:
- **PostgreSQL** on port 5432
- **Redis** on port 6379
- **MinIO** on ports 9000 (API) and 9001 (console)

Wait a few seconds for containers to become healthy before proceeding.

### Step 2: Backend Setup

```bash
cd backend
npm install
cp .env.example .env        # Only needed on first setup
npx prisma generate
npx prisma migrate dev
npx prisma db seed           # Creates super admin: admin@system.local / admin
npm run dev                  # Starts API server on port 3001
```

### Step 3: Start Worker (separate terminal)

```bash
cd backend
npm run worker:dev           # Starts BullMQ job processor
```

### Step 4: Frontend Setup (separate terminal)

```bash
cd frontend
npm install
npm run dev                  # Starts Vite dev server on port 5173
```

### Quick Start (after first setup)

If dependencies are already installed and database is migrated:

```bash
# Terminal 1 - Infrastructure
cd backend && docker-compose up -d

# Terminal 2 - API server
cd backend && npm run dev

# Terminal 3 - Worker
cd backend && npm run worker:dev

# Terminal 4 - Frontend
cd frontend && npm run dev
```

---

## URLs

| Service | URL | Notes |
|---------|-----|-------|
| Frontend | http://localhost:5173 | Vite dev server |
| Backend API | http://localhost:3001 | Fastify server |
| API Docs (Swagger) | http://localhost:3001/docs | OpenAPI explorer |
| MinIO Console | http://localhost:9001 | Login: minioadmin / minioadmin |
| Prisma Studio | `npx prisma studio` | Database viewer (run from backend/) |

---

## Default Accounts

| Account | Email | Password | Notes |
|---------|-------|----------|-------|
| Super Admin | admin@system.local | admin | Created by `prisma db seed`. Full system access. |

Regular users can self-register via the **Sign up** link on the login page.

---

## AI Provider Configuration

AI-powered actions (OCR, Describe, Analyze, Transcribe, Translate) require API keys:

1. Log in to the frontend
2. Go to **Settings** > **AI Providers** tab
3. Enter your **Anthropic** and/or **OpenAI** API key
4. Click **Save AI Settings**

Keys are encrypted with AES-256-GCM and stored in the database. System-level keys can also be set in `backend/.env` via `ANTHROPIC_API_KEY` and `OPENAI_API_KEY`.

---

## What Was Implemented

### Backend (Fastify + TypeScript)

- **10 route files**: auth, media, jobs, actions, api-keys, organizations, users, usage, admin, system
- **7 service files**: media, job, apikey, organization, user, usage, admin
- **14 action plugins**: 7 image + 7 audio processing actions
- **Core modules**: JWT auth, API key auth, encryption, Prisma ORM, BullMQ queue, MinIO storage
- **Worker process**: Separate process for job execution with priority queues (high/normal/low)

### Frontend (React 18 + Vite + TailwindCSS)

- **Auth pages**: Login, Register
- **Dashboard**: Usage overview, recent jobs, recent media
- **Media Library**: Upload, list, delete media files
- **Process Page**: Select actions, configure parameters, submit jobs
- **Jobs Page**: View job status, results, download outputs
- **Settings**: Organization, AI providers, webhooks, limits
- **API Keys**: Create, revoke, rotate API keys
- **Team**: Invite users, manage roles
- **Usage**: Analytics with charts
- **Admin Panel**: Super admin organization management

### Infrastructure

- `docker-compose.yml` — PostgreSQL 16, Redis 7, MinIO (with auto bucket creation)
- `prisma/schema.prisma` — Full database schema with migrations
- `prisma/seed.ts` — Super admin seed script

---

## Project Structure

```
Task/
├── frontend/                    # React frontend
│   ├── src/
│   │   ├── components/          # UI components (ui/, layout/, auth/, media/, jobs/, actions/, settings/)
│   │   ├── pages/               # Page components
│   │   │   ├── auth/            # LoginPage, RegisterPage
│   │   │   ├── admin/           # Super admin pages
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── MediaLibraryPage.tsx
│   │   │   ├── UploadPage.tsx
│   │   │   ├── ProcessPage.tsx
│   │   │   ├── JobsPage.tsx
│   │   │   ├── SettingsPage.tsx
│   │   │   ├── ApiKeysPage.tsx
│   │   │   ├── TeamPage.tsx
│   │   │   └── UsagePage.tsx
│   │   ├── services/api.ts      # API client
│   │   └── stores/authStore.ts  # Zustand auth state
│   ├── vite.config.ts
│   └── package.json
├── backend/                     # Fastify backend
│   ├── src/
│   │   ├── api/routes/          # 10 route files
│   │   ├── core/                # auth, database, queue, storage
│   │   ├── plugins/
│   │   │   ├── actions/image/   # 7 image action handlers
│   │   │   ├── actions/audio/   # 7 audio action handlers
│   │   │   └── ai-providers/    # OpenAI + Anthropic integration
│   │   ├── services/            # 7 service files
│   │   ├── workers/             # BullMQ job processor
│   │   ├── config/index.ts      # Environment config with Zod validation
│   │   ├── app.ts               # Fastify app setup
│   │   └── server.ts            # Entry point
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   ├── docker-compose.yml
│   ├── .env.example
│   └── package.json
├── FUNCTIONAL_REQUIREMENTS.md
├── TECHNICAL_REQUIREMENTS.md
└── SETUP_PROGRESS.md            # This file
```

---

## Bugs Fixed During Development

| Issue | Fix |
|-------|-----|
| `MINIO_USE_SSL` env parsing — `z.coerce.boolean()` treated `"false"` as truthy | Changed to `.transform(v => v === 'true')` |
| Vite proxy pointed to wrong port (3005 instead of 3001) | Updated `vite.config.ts` proxy target to `http://localhost:3001` |
| Vite `allowedHosts: 'all'` not recognized | Changed to `allowedHosts: true` for ngrok/tunnel support |
| System AI clients created with placeholder `.env` keys causing 401 errors | Added `isRealApiKey` check to skip placeholder keys like `sk-ant-your-...` |
| Worker AI client cache not invalidated when user updates keys via API server | Reduced cache TTL from 5 minutes to 30 seconds |

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Docker containers not starting | Make sure Docker Desktop is running. Check `docker ps` for status. |
| Port conflicts | Ensure ports 3001, 5173, 5432, 6379, 9000, 9001 are free. |
| Database errors | Run `cd backend && npx prisma migrate reset` to reset DB. |
| Missing env vars | Check `backend/.env` has all values from `.env.example`. |
| AI actions failing with 401 | Verify your API key is valid. Re-enter it in Settings > AI Providers. |
| Frontend proxy errors (`ECONNREFUSED`) | Backend API server is not running. Start it with `cd backend && npm run dev`. |
| Jobs stuck in QUEUED status | Worker is not running. Start it with `cd backend && npm run worker:dev`. |
