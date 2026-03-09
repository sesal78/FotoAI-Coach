# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Foto** is an AI-powered photography coaching platform. It generates personalized daily photography challenges, photo tour itineraries, and provides conversational AI coaching through an embedded chatbot.

The Next.js application lives in `nextjs_space/`. All commands below should be run from that directory.

---

## Commands

```bash
cd nextjs_space

# Install dependencies
yarn install

# Development server (http://localhost:3000)
yarn dev

# Production build
yarn build

# Start production server
yarn start

# Lint
yarn lint

# One-time Appwrite setup: creates all collections and storage bucket
yarn ts-node scripts/appwrite-setup.ts

# Docker: run full stack locally (requires .env with Appwrite vars)
docker-compose up -d
docker-compose logs -f app
docker-compose down
```

**No tests are implemented.** `yarn lint` is the only automated quality check.

---

## Architecture

### Stack
- **Next.js 14** (App Router) + TypeScript
- **Appwrite** (self-hosted) — database, auth, and file storage
- **Abacus.AI** for LLM calls (gpt-4.1-mini model, OpenAI-compatible API)
- **OpenWeatherMap** for weather-aware challenge generation
- **Nodemailer** (SMTP) for email notifications
- **shadcn/ui** + **Tailwind CSS** for UI

### Directory Layout

```
nextjs_space/
├── app/
│   ├── api/
│   │   ├── auth/             # login, logout, register, me routes
│   │   ├── challenges/       # Challenge CRUD + sync endpoint
│   │   ├── itinerary/        # Photo tour generation
│   │   ├── progress/         # User stats
│   │   ├── submissions/      # Challenge completions + photo upload
│   │   ├── locations/        # Location data
│   │   └── scheduled/        # Cron job endpoints (called by crontab)
│   ├── dashboard/            # Main authenticated user view
│   ├── chat/                 # Abacus.AI chatbot iframe embed
│   ├── locations/            # Location browser
│   └── page.tsx              # Public landing page
├── components/
│   ├── ui/                   # shadcn/ui primitives (do not edit directly)
│   └── sections/             # Page-level sections (Hero, Features, etc.)
├── hooks/
│   └── useAppwriteAuth.ts    # Client-side auth hook (replaces useSession)
├── lib/
│   ├── appwrite.ts           # Client-side Appwrite SDK (browser safe)
│   ├── appwrite-server.ts    # Server-side Appwrite SDK (API routes only)
│   ├── appwrite-collections.ts # Collection ID constants + DB ID
│   ├── llm.ts                # All Abacus.AI LLM functions
│   ├── email.ts              # SMTP email helpers (nodemailer)
│   ├── weather.ts            # OpenWeatherMap wrapper
│   └── types.ts              # Shared TypeScript types
├── public/
│   └── challenge-sync.js     # Polls chatbot postMessage → saves to DB
└── scripts/
    └── appwrite-setup.ts     # One-time: creates Appwrite collections + bucket
```

### Key Data Flow: Challenge Generation

1. `POST /api/challenges` with `{ challengeType }` (one of: `WEEKEND_DEEP_DIVE`, `LUNCH_BREAK`, `AFTER_WORK`, `WFH_MICRO`)
2. Route fetches user profile (Appwrite Users), gear + preferences (Appwrite Collections), last 5 challenges, and current weather
3. Calls `generateChallenge()` in `lib/llm.ts` with assembled context
4. Abacus.AI returns structured JSON
5. Challenge saved to `daily_challenges` collection, `user_progress` updated
6. Frontend receives challenge data and renders it

### Authentication (Appwrite Auth)

- **Login**: `POST /api/auth/login` → creates Appwrite session → sets `a_session_{PROJECT_ID}` cookie
- **Logout**: `POST /api/auth/logout` → deletes session + clears cookie
- **Register**: `POST /api/auth/register` → creates Appwrite user + initialises preference/progress docs
- **Client-side**: `useAppwriteAuth()` hook from `hooks/useAppwriteAuth.ts` (replaces `useSession`)
- **Server-side**: `createSessionClient(request)` from `lib/appwrite-server.ts` — reads session cookie and returns scoped client

### Appwrite Collections (replacing Prisma models)

| Collection ID | Purpose |
|---|---|
| `user_preferences` | Skill level, interests, schedule, locations |
| `user_gear` | Equipment inventory |
| `daily_challenges` | Generated challenges with status |
| `challenge_submissions` | Completed challenge photos/notes |
| `itineraries` | Photo tour plans |
| `user_progress` | Aggregate stats + streak tracking |
| `agent_actions` | Audit log |

User identity (name, email, password) lives in **Appwrite Auth** (Users service), not a collection.

### Appwrite Query Patterns

```typescript
import { Query, ID } from 'node-appwrite';
import { createAdminClient } from '@/lib/appwrite-server';
import { DATABASE_ID, COLLECTION_DAILY_CHALLENGES } from '@/lib/appwrite-collections';

const { databases } = createAdminClient();

// Find one by field
const result = await databases.listDocuments(DATABASE_ID, COLLECTION_DAILY_CHALLENGES, [
  Query.equal('userId', userId), Query.limit(1)
]);
const doc = result.documents[0] ?? null;

// Create
const doc = await databases.createDocument(DATABASE_ID, COLLECTION_DAILY_CHALLENGES, ID.unique(), data);

// Update (no { increment: 1 } — read then write explicit value)
const existing = await databases.getDocument(DATABASE_ID, COLLECTION_USER_PROGRESS, progressId);
await databases.updateDocument(DATABASE_ID, COLLECTION_USER_PROGRESS, progressId, {
  totalChallengesCompleted: existing.totalChallengesCompleted + 1,
});
```

### AI Chat → Database Sync

The chatbot (`/chat`) is an Abacus.AI iframe. `public/challenge-sync.js` listens for `postMessage` events, extracts challenge data via regex, and calls `POST /api/challenges/sync` (unauthenticated endpoint) to persist challenges created in chat to the database.

---

## Environment Variables

Required in `nextjs_space/.env` (see `.env.example` at repo root):

```
# Appwrite (both sets required)
NEXT_PUBLIC_APPWRITE_ENDPOINT   # Browser-safe endpoint
NEXT_PUBLIC_APPWRITE_PROJECT_ID
APPWRITE_ENDPOINT               # Server-side endpoint (same value)
APPWRITE_PROJECT_ID
APPWRITE_API_KEY                # Server-only API key (never in NEXT_PUBLIC_*)
APPWRITE_DATABASE_ID
APPWRITE_STORAGE_BUCKET_ID

# External APIs
ABACUSAI_API_KEY
SMTP_HOST / SMTP_PORT / SMTP_SECURE / SMTP_USER / SMTP_PASS
FROM_EMAIL / FROM_NAME / REPLY_TO_EMAIL
OPENWEATHERMAP_API_KEY
USER_EMAIL
```

---

## LLM Integration Notes

All LLM calls go through `lib/llm.ts`. The Abacus.AI API is OpenAI-compatible:
- Base URL: `https://apps.abacus.ai/v1/chat/completions`
- Model: `gpt-4.1-mini`
- JSON mode enabled for structured outputs
- Temperature 0.7–0.8 for creative variation

---

## Scheduled Jobs

`crontab` (at repo root) defines cron jobs that call the `app/api/scheduled/` endpoints via HTTP. In Docker, a separate scheduler container handles these. Endpoints require no auth but should only be accessible internally.

---

## Deployment

Self-hosted via Docker Compose. Appwrite runs as a **separate** service in Dokploy — deploy it first, then set the Appwrite env vars in the app's Dokploy configuration.

The `Dockerfile` in `nextjs_space/` uses a multi-stage build outputting to `.next/standalone`. No database migrations are needed at startup — Appwrite manages schema via collections.

Helper scripts at repo root: `deploy.sh`, `backup.sh`, `restore.sh`, `monitor.sh`.
