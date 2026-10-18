# Foto - AI Photography Coach

A self-hosted, AI-powered photography coaching platform. Generates personalized daily challenges, photo tour itineraries, and tracks your photography journey — all driven by LLM-generated content tailored to your gear, skill level, and local weather.

**Live:** https://myfoto.topues.com

## Workspace (refactor)

The refactor (design: `docs/superpowers/specs/2026-10-18-fotoai-refactor-design.md`, plans: `docs/superpowers/plans/`)
lives in a pnpm + Turborepo workspace. `nextjs_space/` is the live app, workspace package `@fotoai/legacy-web`.

| Path | What |
|---|---|
| `packages/env` | `@fotoai/env`: server env validated at boot (`createServerEnv`) |
| `packages/contracts` | `@fotoai/contracts`: shared zod contracts (API error envelope) |
| `packages/db` | `@fotoai/db`: supabase-js user client (RLS) and `@fotoai/db/service` (privileged/ only), generated types, Drizzle baseline |
| `supabase/` | local Supabase project (config + migrations) for development and CI |

Never install inside the canonical repo folder; use a Sandbox worktree (Homebase rule):

```bash
git worktree add D:/Homebase/Sandbox/fotoai-coach-refactor <branch>
cd D:/Homebase/Sandbox/fotoai-coach-refactor
export npm_config_store_dir=D:/Homebase/Sandbox/pnpm-store
export TURBO_CACHE_DIR=D:/Homebase/Sandbox/turbo-cache   # else turbo writes .turbo/ into the main repo folder
pnpm install
pnpm typecheck && pnpm lint && pnpm test
```

Real-Postgres tests run against the **local** Supabase only (they refuse any other URL). Pass the local keys from
`npx supabase@2.118.0 status -o env` as environment variables, never in files:
`FOTOAI_TEST_SUPABASE_URL`, `FOTOAI_TEST_SUPABASE_ANON_KEY`, `FOTOAI_TEST_SUPABASE_SERVICE_ROLE_KEY`,
`FOTOAI_TEST_DATABASE_URL` (`postgresql://postgres:postgres@127.0.0.1:54322/postgres`), then
`FOTOAI_REQUIRE_DB_TESTS=1 pnpm --filter @fotoai/db test:integration`. After a schema change, regenerate types with
`pnpm --filter @fotoai/db db:types`; CI fails if they are stale.

## Features

### AI Photography Challenges
Four challenge types adapted to your schedule:
- **Weekend Deep Dive** — 2-4 hour comprehensive exploration
- **Lunch Break** — 30-45 minute quick creative burst
- **After Work** — 1-2 hour golden hour session
- **WFH Micro** — 15-20 minute creative break at home

Challenges factor in your equipment, skill level, recent history, and current weather conditions.

### Photo Tour Itineraries
- AI-generated walking tours for any location
- Customizable duration (1-2 hours to full day)
- Photo spot recommendations with descriptions
- Gear suggestions based on your equipment

### Progress Tracking
- Challenge completion stats and streaks
- Photography journey history
- Weekly email reports

### AI Chat Coach
- Conversational photography advice via embedded chatbot
- Challenge data synced from chat to database

### Scheduled Automation
- Daily challenge generation via cron
- Weather monitoring (every 3 hours)
- Streak management
- Weekly progress reports by email

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) + TypeScript |
| Database & Auth | Appwrite (self-hosted) |
| AI/LLM | OpenAI API (gpt-4o-mini) |
| UI | shadcn/ui + Tailwind CSS + Radix UI |
| Data Fetching | TanStack Query (React Query) |
| Email | Nodemailer (SMTP) with Resend fallback |
| Weather | OpenWeatherMap API |
| Deployment | Docker Compose, Dokploy |

## Project Structure

```
foto-photography-coach/
├── nextjs_space/              # Next.js application
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/          # login, logout, register, me, verify-email
│   │   │   ├── challenges/    # CRUD, sync, email, slack
│   │   │   ├── itinerary/     # Photo tour generation
│   │   │   ├── progress/      # User stats
│   │   │   ├── submissions/   # Challenge completions + photo upload
│   │   │   ├── locations/     # Location data
│   │   │   ├── chat/          # AI chat endpoint
│   │   │   ├── scheduled/     # Cron endpoints (daily-challenge, streak, weather, weekly-report)
│   │   │   └── health/        # Health check
│   │   ├── dashboard/         # Main authenticated view
│   │   ├── chat/              # AI chatbot page
│   │   ├── locations/         # Location browser
│   │   ├── login/             # Login page
│   │   ├── signup/            # Registration page
│   │   ├── verify-email/      # Email verification flow
│   │   └── page.tsx           # Public landing page
│   ├── components/
│   │   ├── ui/                # shadcn/ui primitives
│   │   └── sections/          # Page-level sections (Hero, Features, etc.)
│   ├── contexts/
│   │   └── auth-context.tsx   # Auth state provider
│   ├── hooks/
│   │   ├── useAppwriteAuth.ts # Client-side auth hook
│   │   └── use-dashboard-data.ts
│   ├── lib/
│   │   ├── appwrite.ts        # Client-side Appwrite SDK
│   │   ├── appwrite-server.ts # Server-side Appwrite SDK
│   │   ├── appwrite-collections.ts # Collection ID constants
│   │   ├── appwrite-session.ts # Session creation helper
│   │   ├── llm.ts             # OpenAI LLM functions
│   │   ├── email.ts           # SMTP + Resend email helpers
│   │   ├── weather.ts         # OpenWeatherMap wrapper
│   │   └── types.ts           # Shared TypeScript types
│   ├── scripts/
│   │   └── appwrite-setup.ts  # One-time: creates collections + storage bucket
│   ├── public/
│   │   └── challenge-sync.js  # Chatbot postMessage → DB sync
│   ├── Dockerfile             # Multi-stage production build
│   ├── docker-compose.yml     # App + cron scheduler
│   └── crontab                # Scheduled job definitions
├── deploy.sh                  # Deployment helper
├── backup.sh                  # Backup script
├── restore.sh                 # Restore script
├── monitor.sh                 # Monitoring script
├── .env.example               # Environment variable template
└── CLAUDE.md                  # AI coding assistant instructions
```

## Quick Start

### Prerequisites
- Node.js 18+
- A running [Appwrite](https://appwrite.io/docs/advanced/self-hosting) instance
- API keys: OpenAI, OpenWeatherMap
- SMTP credentials (and/or Resend API key) for email

### Installation

```bash
# Clone the repository
git clone https://github.com/sesal78/FotoAI-Coach.git
cd FotoAI-Coach

# Install dependencies
cd nextjs_space
yarn install

# Configure environment
cp ../.env.example .env
# Edit .env with your Appwrite endpoint, API keys, and SMTP credentials

# Set up Appwrite collections and storage bucket (one-time)
yarn ts-node --require dotenv/config scripts/appwrite-setup.ts

# Start development server
yarn dev
```

The app will be available at http://localhost:3000.

### Docker Deployment

Appwrite must be deployed separately first (e.g. via Dokploy or its official docker-compose).

```bash
cd nextjs_space

# Build and start the app + cron scheduler
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop
docker-compose down
```

The Docker setup includes:
- **app** — Next.js production server (`.next/standalone`)
- **scheduler** — Alpine container running cron jobs that call `/api/scheduled/*` endpoints

## Environment Variables

Copy `.env.example` to `nextjs_space/.env` and fill in:

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_APPWRITE_ENDPOINT` | Yes | Appwrite endpoint (browser-safe) |
| `NEXT_PUBLIC_APPWRITE_PROJECT_ID` | Yes | Appwrite project ID (browser-safe) |
| `APPWRITE_ENDPOINT` | Yes | Appwrite endpoint (server-side) |
| `APPWRITE_PROJECT_ID` | Yes | Appwrite project ID (server-side) |
| `APPWRITE_API_KEY` | Yes | Appwrite server API key |
| `APPWRITE_DATABASE_ID` | Yes | Created by `appwrite-setup.ts` |
| `APPWRITE_STORAGE_BUCKET_ID` | Yes | Created by `appwrite-setup.ts` |
| `OPENAI_API_KEY` | Yes | OpenAI API key for challenge/itinerary generation |
| `CRON_SECRET` | Yes | Bearer token for scheduled endpoints |
| `SMTP_HOST` | Yes* | SMTP server hostname |
| `SMTP_PORT` | Yes* | SMTP port (typically 587) |
| `SMTP_SECURE` | Yes* | `true` for port 465, `false` otherwise |
| `SMTP_USER` | Yes* | SMTP username |
| `SMTP_PASS` | Yes* | SMTP password |
| `RESEND_API_KEY` | No | Fallback email provider if SMTP fails |
| `FROM_EMAIL` | Yes | Sender email address |
| `FROM_NAME` | No | Sender display name (default: "Foto Coach") |
| `REPLY_TO_EMAIL` | No | Reply-to address |
| `OPENWEATHERMAP_API_KEY` | Yes | Weather-aware challenge generation |
| `USER_EMAIL` | Yes | Default admin/user email |

*At least one email provider (SMTP or Resend) must be configured.

## Appwrite Collections

| Collection | Purpose |
|---|---|
| `user_preferences` | Skill level, interests, schedule, locations |
| `user_gear` | Equipment inventory |
| `daily_challenges` | Generated challenges with status |
| `challenge_submissions` | Completed challenge photos and notes |
| `itineraries` | Photo tour plans |
| `user_progress` | Aggregate stats and streak tracking |
| `agent_actions` | Audit log |

User identity (name, email, password) lives in Appwrite Auth, not in a collection.

## Authentication

- **Server-side**: httpOnly `foto_session` cookie containing the Appwrite session secret
- **Client-side**: `useAppwriteAuth()` hook backed by `AuthProvider` context
- **Middleware**: Protects `/dashboard` and `/chat` routes — redirects to `/login` if no session cookie
- **Email verification**: Registration sends a verification email; users confirm via `/verify-email/confirm`

## Scheduled Jobs

Defined in `nextjs_space/crontab`, executed by the Docker scheduler container:

| Schedule | Endpoint | Purpose |
|---|---|---|
| Sat 7 AM PST | `/api/scheduled/daily-challenge` | Weekend challenge generation |
| Weekdays 11 AM PST | `/api/scheduled/daily-challenge` | Lunch break challenges |
| Every 3 hours | `/api/scheduled/weather-monitor` | Weather condition updates |
| Sun 8 PM PST | `/api/scheduled/weekly-report` | Weekly progress email |
| Daily 11 PM PST | `/api/scheduled/streak-manager` | Streak calculation |
| Every 5 min | `/api/health` | Health check |

All scheduled endpoints (except health) require `Authorization: Bearer $CRON_SECRET`.

## Available Scripts

```bash
cd nextjs_space

yarn dev          # Development server
yarn build        # Production build
yarn start        # Start production server
yarn lint         # ESLint
```

## Documentation

- [Self-Hosting Guide](SELF_HOSTING_GUIDE.md)
- [System Documentation](SYSTEM_DOCUMENTATION.md)
- [Developer Guide](DEVELOPER_GUIDE.md)
- [Features](FEATURES.md)
- [GitHub Setup](GITHUB_SETUP_INSTRUCTIONS.md)

## License

MIT License
