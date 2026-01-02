# Foto AI - Developer Guide

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Implemented Features](#implemented-features)
4. [API Documentation](#api-documentation)
5. [Database Schema](#database-schema)
6. [Setup & Development](#setup--development)
7. [Deployment](#deployment)
8. [Future Features](#future-features)

---

## System Overview

**Foto AI** is a Next.js 14 full-stack application providing AI-powered photography coaching through personalized challenges, itinerary planning, and conversational guidance.

### Technology Stack

```
Frontend:     Next.js 14 (App Router), React 18, TypeScript
Styling:      Tailwind CSS, shadcn/ui components
Backend:      Next.js API Routes (Node.js)
Database:     PostgreSQL 15+
ORM:          Prisma 6.7
Auth:         NextAuth.js 4.24
AI/LLM:       Abacus.AI APIs
Email:        SendGrid
Weather:      OpenWeatherMap API
Container:    Docker, Docker Compose
```

### Project Structure

```
foto_app/
├── nextjs_space/              # Main Next.js application
│   ├── app/
│   │   ├── api/              # API routes
│   │   │   ├── auth/         # NextAuth endpoints
│   │   │   ├── challenges/   # Challenge CRUD + sync
│   │   │   ├── itinerary/    # Itinerary generation
│   │   │   ├── progress/     # User stats
│   │   │   ├── submissions/  # Challenge submissions
│   │   │   └── locations/    # Location data
│   │   ├── chat/             # AI coach chat page
│   │   ├── dashboard/        # Main dashboard
│   │   ├── locations/        # Location browser
│   │   ├── about/            # About page
│   │   └── page.tsx          # Landing page
│   ├── components/
│   │   ├── sections/         # Page sections
│   │   └── ui/               # shadcn/ui components
│   ├── lib/
│   │   ├── db.ts             # Prisma client
│   │   ├── auth.ts           # NextAuth config
│   │   ├── email.ts          # SendGrid integration
│   │   ├── llm.ts            # Abacus.AI LLM functions
│   │   ├── weather.ts        # OpenWeatherMap
│   │   └── types.ts          # TypeScript types
│   ├── prisma/
│   │   └── schema.prisma     # Database schema
│   ├── public/
│   │   └── challenge-sync.js # Challenge sync script
│   └── scripts/
│       └── seed.ts           # Database seeding
├── deploy.sh
├── backup.sh
├── restore.sh
└── monitor.sh
```

---

## Architecture

### System Diagram

```
┌─────────────────┐
│   Next.js App   │
│  (SSR + Client) │
└────────┬────────┘
         │
    ┌────┴────────────────────────┐
    │                             │
┌───▼────────┐           ┌────────▼──────┐
│  Postgres  │           │  External APIs │
│  Database  │           ├───────────────┤
│  (Prisma)  │           │ Abacus.AI LLM │
└────────────┘           │ OpenWeatherMap│
                         │ SendGrid Email│
                         │ Chatbot Iframe│
                         └───────────────┘
```

### Data Flow

#### Challenge Generation
```
User → Dashboard → POST /api/challenges
  → Fetch user profile & preferences from DB
  → Get weather data (OpenWeatherMap)
  → Call Abacus.AI LLM with context
  → Save challenge to DB
  → Return challenge to client
```

#### Itinerary Generation
```
User → Dashboard → POST /api/itinerary
  → Fetch user profile & gear from DB
  → Get weather data
  → Call Abacus.AI LLM with location context
  → Parse spots array
  → Save itinerary to DB (spots as JSON string)
  → Return itinerary with parsed spots
```

#### Challenge Sync from Chatbot
```
Chatbot → Calls sync_challenge_to_dashboard tool
  → POST /api/challenges/sync
  → Check for existing pending challenge
  → Update existing OR create new
  → Return success status
```

---

## Implemented Features

### 1. AI Photography Challenges

**Location:** `app/dashboard/page.tsx`, `app/api/challenges/route.ts`

#### Challenge Types (Enum)
```typescript
type ChallengeType = 
  | 'WEEKEND_DEEP_DIVE'  // 2-4 hours
  | 'LUNCH_BREAK'        // 30-45 min
  | 'AFTER_WORK'         // 1-2 hours
  | 'WFH_MICRO'          // 15-20 min
```

#### Difficulty Levels
```typescript
type Difficulty = 'MINI' | 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
```

#### Categories
```typescript
type Category = 
  | 'STREET'
  | 'PORTRAIT'
  | 'LANDSCAPE'
  | 'ARCHITECTURE'
  | 'MARKET'
  | 'NATURE'
  | 'ABSTRACT'
```

#### Generation Process
1. **User Input:** Select challenge type from dashboard
2. **Data Collection:**
   - User profile (skill level, interests)
   - User gear inventory
   - Recent challenges (last 5) to avoid repetition
   - Current weather conditions
3. **LLM Call:** `generateChallenge()` in `lib/llm.ts`
4. **Database:** Save to `DailyChallenge` table
5. **Response:** Return structured challenge with tips & gear

#### Challenge Lifecycle
```
pending → [completed | skipped]
```

#### API Endpoints
- `POST /api/challenges` - Generate new challenge
- `GET /api/challenges?userId={id}&status={status}` - List challenges
- `GET /api/challenges?latest=true` - Get most recent challenge
- `PATCH /api/challenges/[id]` - Update challenge status
- `POST /api/challenges/sync` - Sync from chatbot

### 2. Photo Tour Itineraries

**Location:** `app/dashboard/page.tsx`, `app/api/itinerary/route.ts`

#### Itinerary Structure
```typescript
interface Itinerary {
  id: string;
  userId: string;
  location: string;
  title: string;
  description: string;
  spots: string; // JSON.stringify([{name, description}])
  suggestedTimes: string[];
  weatherConditions: string | null;
  gearRecommendations: string[];
  duration: string;
  status: 'generated' | 'scheduled' | 'completed';
  generatedDate: Date;
}
```

#### Generation Process
1. **Input:** Location + duration selection
2. **LLM Call:** `generateItinerary()` with weather context
3. **Parsing:** Extract spots array from LLM response
4. **Storage:** Save spots as JSON string in DB
5. **Display:** Parse JSON on frontend for rendering

#### API Endpoints
- `POST /api/itinerary` - Generate itinerary
- `GET /api/itinerary?userId={id}` - List user itineraries

### 3. Progress Tracking

**Location:** `app/api/progress/route.ts`

#### Tracked Metrics
```typescript
interface UserProgress {
  totalChallengesIssued: number;
  totalChallengesCompleted: number;
  currentStreak: number;          // Consecutive days
  longestStreak: number;
  completionRate: number;         // Calculated %
  saturdayChallengesIssued: number;
  saturdayChallengesCompleted: number;
  lunchBreakIssued: number;
  lunchBreakCompleted: number;
  afterWorkIssued: number;
  afterWorkCompleted: number;
  favoriteSubjects: string[];     // Most common categories
}
```

#### Calculation Logic
- Completion rate: `(completed / issued) * 100`
- Streaks: Updated when challenge marked complete
- Favorite subjects: Top 3 most used categories

### 4. Challenge Submissions

**Location:** `app/api/submissions/route.ts`

#### Submission Data
```typescript
interface Submission {
  challengeId: string;
  userId: string;
  photoUrl?: string;        // S3 path if uploaded
  notes?: string;           // User reflections
  rating?: number;          // 1-5 stars
  submittedDate: Date;
}
```

#### Workflow
1. User completes challenge
2. Optional: Upload photo (stored locally for now)
3. Add notes and rating
4. Submit → Update challenge status to 'completed'
5. Update UserProgress metrics

### 5. Authentication System

**Location:** `lib/auth.ts`, `app/api/auth/[...nextauth]/route.ts`

#### Configuration
```typescript
// NextAuth.js 4.24
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      // Email + password authentication
    })
  ],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/',  // Custom login page
  },
  callbacks: {
    jwt: ({ token, user }) => { /* ... */ },
    session: ({ session, token }) => { /* ... */ }
  }
};
```

#### Protected Routes
- Dashboard: Server-side check via `getServerSideProps`
- API routes: `getServerSession(authOptions)`

#### User Model
```typescript
model User {
  id           String @id @default(cuid())
  email        String @unique
  name         String
  password     String  // bcrypt hashed
  role         String @default("user")
  preferences  UserPreferences?
  gear         Gear[]
  challenges   DailyChallenge[]
  submissions  Submission[]
  progress     UserProgress?
}
```

### 6. AI Chat Coach

**Location:** `app/chat/page.tsx`, `components/sections/chat-interface.tsx`

#### Implementation
- **Embedded Iframe:** Abacus.AI chatbot (App ID: `13a86b8346`)
- **URL:** `https://apps.abacus.ai/chatllm/?appId=13a86b8346&hideTopBar=2`
- **Challenge Sync:** Chatbot can call `sync_challenge_to_dashboard` tool

#### Chatbot Tool Configuration
```python
# Tool: sync_challenge_to_dashboard
import requests

def sync_challenge_to_dashboard(
    challenge_text, category, difficulty, 
    duration, location="Melbourne", 
    recommended_gear="", tips=""
):
    response = requests.post(
        "https://myfoto.topues.com/api/challenges/sync",
        json={
            "userId": "1",
            "challengeText": challenge_text,
            "category": category,
            "difficulty": difficulty,
            "duration": duration,
            "location": location,
            "recommendedGear": recommended_gear,
            "tips": tips
        },
        timeout=10
    )
    return {"success": True}
```

#### Client-Side Sync Script
**File:** `public/challenge-sync.js` (v20241231001)

- Listens for `postMessage` from chatbot iframe
- Polls page for challenge markers every 5 seconds
- Extracts challenge data via regex patterns
- Calls `/api/challenges/sync` to persist data

### 7. Weather Integration

**Location:** `lib/weather.ts`

```typescript
export async function getWeather(location: string): Promise<Weather | null> {
  const apiKey = process.env.OPENWEATHERMAP_API_KEY;
  const response = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?q=${location}&appid=${apiKey}&units=imperial`
  );
  const data = await response.json();
  
  return {
    condition: data.weather[0].description,
    temperature: data.main.temp,
    humidity: data.main.humidity,
  };
}
```

### 8. Email Integration (Infrastructure Only)

**Location:** `lib/email.ts`

```typescript
export async function sendEmail({
  to, subject, html, text
}: EmailParams): Promise<boolean> {
  const msg = {
    to,
    from: { email: process.env.FROM_EMAIL!, name: 'Seun - Foto Coach' },
    subject: sanitizeText(subject),
    html: sanitizeText(html),
    text: sanitizeText(text),
  };
  
  await sgMail.send(msg);
  return true;
}
```

**Note:** Email challenge sharing feature was removed, but email infrastructure remains for future use (password reset, notifications, etc.)

### 9. Responsive Design System

#### Theme Configuration
```css
/* globals.css */
:root {
  --background: 45 20% 95%;      /* Warm cream */
  --foreground: 30 5% 15%;       /* Dark brown */
  --primary: 15 75% 55%;         /* Terracotta */
  --accent: 45 30% 88%;          /* Light cream */
}
```

#### Typography
- **Headlines:** Playfair Display (serif)
- **Body:** DM Sans (sans-serif)
- **Code:** JetBrains Mono

#### Component Library
- **shadcn/ui** - 40+ components
- **Tailwind CSS** - Utility-first styling
- **Lucide React** - Icon system

---

## API Documentation

### Base URL
- **Development:** `http://localhost:3000`
- **Production:** `https://myfoto.topues.com`

### Authentication
Most endpoints require authentication via NextAuth session cookie.

---

#### `POST /api/challenges`
Generate a new photography challenge

**Request Body:**
```json
{
  "userId": "string",
  "challengeType": "WEEKEND_DEEP_DIVE" | "LUNCH_BREAK" | "AFTER_WORK" | "WFH_MICRO",
  "forceGenerate": false  // Skip duplicate check
}
```

**Response:**
```json
{
  "challenge": {
    "id": "cm...",
    "userId": "1",
    "challengeType": "WEEKEND_DEEP_DIVE",
    "challengeText": "Explore...",
    "difficulty": "INTERMEDIATE",
    "category": "STREET",
    "duration": "2-3 hours",
    "tips": "Focus on...",
    "recommendedGear": ["50mm lens", "Wide angle"],
    "location": "Melbourne CBD",
    "weatherConditions": "Sunny, 72°F",
    "status": "pending",
    "issuedDate": "2025-01-01T00:00:00Z"
  }
}
```

---

#### `GET /api/challenges`
List user challenges

**Query Parameters:**
- `userId` (required): User ID
- `status`: Filter by status (`pending`, `completed`, `skipped`, `all`)
- `limit`: Max results (default: 10)
- `latest`: If `true`, return most recent challenge only

**Response:**
```json
{
  "challenges": [
    { /* Challenge object */ }
  ]
}
```

---

#### `PATCH /api/challenges/[id]`
Update challenge status

**Request Body:**
```json
{
  "status": "completed" | "skipped"
}
```

**Response:**
```json
{
  "challenge": { /* Updated challenge */ },
  "message": "Challenge updated"
}
```

---

#### `POST /api/challenges/sync`
Sync challenge from chatbot (no auth required)

**Request Body:**
```json
{
  "userId": "string",
  "challengeText": "string",
  "category": "STREET",
  "difficulty": "INTERMEDIATE",
  "duration": "2 hours",
  "location": "Melbourne",
  "recommendedGear": "50mm lens",
  "tips": "Focus on...",
  "weatherConditions": "Sunny"
}
```

**Response:**
```json
{
  "success": true,
  "challenge": { /* Challenge object */ },
  "created": true  // or "updated": true
}
```

---

#### `POST /api/itinerary`
Generate photo tour itinerary

**Request Body:**
```json
{
  "userId": "string",
  "location": "Melbourne CBD",
  "duration": "2-3 hours"
}
```

**Response:**
```json
{
  "itinerary": {
    "id": "cm...",
    "title": "Melbourne CBD Photo Walk",
    "description": "A curated...",
    "location": "Melbourne CBD",
    "duration": "2-3 hours",
    "spots": [
      {
        "name": "Flinders Street Station",
        "description": "Iconic...",
        "tips": "Best time..."
      }
    ],
    "suggestedTimes": ["Morning", "Golden Hour"],
    "gearRecommendations": ["Wide angle lens"],
    "weatherConditions": "Sunny, 75°F"
  }
}
```

---

#### `GET /api/progress`
Get user progress statistics

**Query Parameters:**
- `userId` (required)

**Response:**
```json
{
  "progress": {
    "totalChallengesIssued": 25,
    "totalChallengesCompleted": 18,
    "completionRate": 72,
    "currentStreak": 5,
    "longestStreak": 12,
    "favoriteSubjects": ["STREET", "PORTRAIT", "LANDSCAPE"]
  }
}
```

---

#### `POST /api/submissions`
Submit challenge completion

**Request Body (multipart/form-data):**
```
challengeId: string
userId: string
notes: string (optional)
rating: number 1-5 (optional)
photo: File (optional)
```

**Response:**
```json
{
  "submission": { /* Submission object */ },
  "message": "Challenge submitted successfully"
}
```

---

## Database Schema

### Prisma Schema Overview

```prisma
// User Management
model User {
  id              String            @id @default(cuid())
  email           String            @unique
  name            String
  password        String
  role            String            @default("user")
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt
  
  // Relations
  preferences     UserPreferences?
  gear            Gear[]
  challenges      DailyChallenge[]
  submissions     Submission[]
  itineraries     Itinerary[]
  progress        UserProgress?
  actions         AgentAction[]
}

// User Preferences
model UserPreferences {
  id                      String   @id @default(cuid())
  userId                  String   @unique
  skillLevel              String   @default("beginner")
  photographyInterests    String[] @default([])
  homeLocation            String?
  currentLocation         String?
  preferredChallengeTime  String   @default("morning")
  emailNotifications      Boolean  @default(true)
  telegramNotifications   Boolean  @default(false)
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

// Gear Inventory
model Gear {
  id          String   @id @default(cuid())
  userId      String
  type        String   // "camera", "lens", "accessory"
  brand       String
  model       String
  notes       String?
  acquiredDate DateTime?
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

// Daily Challenges
model DailyChallenge {
  id                  String       @id @default(cuid())
  userId              String
  challengeType       String       // WEEKEND_DEEP_DIVE, etc.
  challengeText       String
  difficulty          String
  category            String
  duration            String
  weatherConditions   String?
  location            String?
  recommendedGear     String[]     @default([])
  tips                String?
  issuedDate          DateTime
  scheduledTime       DateTime?
  bestTimeStart       String?
  bestTimeEnd         String?
  status              String       @default("pending")
  completedDate       DateTime?
  createdAt           DateTime     @default(now())
  updatedAt           DateTime     @updatedAt
  
  user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  submissions Submission[]
}

// Challenge Submissions
model Submission {
  id            String   @id @default(cuid())
  challengeId   String
  userId        String
  photoUrl      String?
  notes         String?
  rating        Int?
  submittedDate DateTime @default(now())
  
  challenge DailyChallenge @relation(fields: [challengeId], references: [id], onDelete: Cascade)
  user      User           @relation(fields: [userId], references: [id], onDelete: Cascade)
}

// Itineraries
model Itinerary {
  id                  String    @id @default(cuid())
  userId              String
  location            String
  title               String
  description         String
  spots               String    // JSON string
  suggestedTimes      String[]  @default([])
  weatherConditions   String?
  gearRecommendations String[]  @default([])
  duration            String?
  status              String    @default("generated")
  generatedDate       DateTime  @default(now())
  scheduledDate       DateTime?
  completedDate       DateTime?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

// User Progress Tracking
model UserProgress {
  id                          String @id @default(cuid())
  userId                      String @unique
  totalChallengesIssued       Int    @default(0)
  totalChallengesCompleted    Int    @default(0)
  currentStreak               Int    @default(0)
  longestStreak               Int    @default(0)
  saturdayChallengesIssued    Int    @default(0)
  saturdayChallengesCompleted Int    @default(0)
  lunchBreakIssued            Int    @default(0)
  lunchBreakCompleted         Int    @default(0)
  afterWorkIssued             Int    @default(0)
  afterWorkCompleted          Int    @default(0)
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

// Agent Action Logging
model AgentAction {
  id          String   @id @default(cuid())
  userId      String
  actionType  String   // "CHALLENGE_GENERATED", "ITINERARY_GENERATED", etc.
  details     String?
  success     Boolean  @default(true)
  timestamp   DateTime @default(now())
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

### Database Migrations

```bash
# Create migration
npx prisma migrate dev --name migration_name

# Apply to production
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate
```

### Seeding

**File:** `scripts/seed.ts`

Creates:
- Demo user (email: test@example.com, password: password123)
- User preferences
- Sample gear items
- Sample challenges

```bash
npx prisma db seed
```

---

## Setup & Development

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Yarn package manager
- Git

### Environment Variables

**File:** `.env`

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/fotoai"

# NextAuth
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"

# Abacus.AI
ABACUSAI_API_KEY="your_abacus_api_key"

# SendGrid
SENDGRID_API_KEY="your_sendgrid_key"
FROM_EMAIL="your-verified@email.com"
USER_EMAIL="default-user@email.com"

# OpenWeatherMap
OPENWEATHERMAP_API_KEY="your_weather_key"
```

### Installation

```bash
# Clone repository
git clone https://github.com/sesal78/foto-photography-coach.git
cd foto-photography-coach/nextjs_space

# Install dependencies
yarn install

# Setup database
creatdb fotoai
yarn prisma generate
yarn prisma db push
yarn prisma db seed

# Start development server
yarn dev
```

Application runs at `http://localhost:3000`

### Development Workflow

1. **Create feature branch**
   ```bash
   git checkout -b feature/your-feature
   ```

2. **Make changes**
   - Follow TypeScript strict mode
   - Use Tailwind for styling
   - Add Prisma migrations for schema changes

3. **Test locally**
   ```bash
   yarn build
   yarn start
   ```

4. **Commit and push**
   ```bash
   git add .
   git commit -m "feat: add feature description"
   git push origin feature/your-feature
   ```

### Code Style

- **TypeScript:** Strict mode enabled
- **ESLint:** Next.js recommended config
- **Prettier:** 2-space indentation, single quotes
- **Naming:**
  - Components: PascalCase
  - Functions: camelCase
  - Files: kebab-case

---

## Deployment

### Docker Deployment

**File:** `Dockerfile`

```dockerfile
FROM node:20-alpine AS base
WORKDIR /app

# Dependencies
FROM base AS deps
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Builder
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN yarn prisma generate
RUN yarn build

# Runner
FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
```

### Docker Compose

**File:** `docker-compose.yml`

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/fotoai
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - ABACUSAI_API_KEY=${ABACUSAI_API_KEY}
    depends_on:
      - db
  
  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=fotoai
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### Deployment Script

```bash
./deploy.sh
```

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Generate strong `NEXTAUTH_SECRET`
- [ ] Configure production database
- [ ] Set up SSL certificates
- [ ] Configure CORS if needed
- [ ] Set up monitoring (health checks)
- [ ] Configure backups (daily)
- [ ] Set up logging

---

## Future Features

### Phase 1: Core Enhancements (Q1 2025)

#### 1. Multi-Day Challenge Series
**Priority:** High

**Technical Requirements:**
- New table: `ChallengeSeries`
- Relationship: `DailyChallenge` → `seriesId`
- Auto-schedule next challenge in series
- Progress tracking per series

**Implementation:**
```prisma
model ChallengeSeries {
  id          String   @id @default(cuid())
  userId      String
  title       String
  description String
  challenges  DailyChallenge[]
  startDate   DateTime
  endDate     DateTime?
  status      String   @default("active")
}
```

#### 2. Enhanced Itinerary Maps
**Priority:** High

**Technical Requirements:**
- Mapbox GL JS integration
- Geocoding for photo spots
- Route drawing between spots
- Marker clustering

**Dependencies:**
- Mapbox API key
- Geocoding service

**Estimated Effort:** 2-3 weeks

### Phase 2: Social Features (Q2 2025)

#### 1. User Profiles
**Priority:** Medium

**Technical Requirements:**
- Public profile pages
- Photo galleries
- Bio and social links
- Privacy settings

**New Tables:**
```prisma
model Profile {
  id          String @id @default(cuid())
  userId      String @unique
  bio         String?
  website     String?
  instagram   String?
  isPublic    Boolean @default(false)
}

model Follow {
  id          String @id @default(cuid())
  followerId  String
  followingId String
  createdAt   DateTime @default(now())
}
```

#### 2. Challenge Sharing
**Priority:** Medium

**Features:**
- Share challenges to social media
- Generate challenge cards (OG images)
- Public challenge links

**Estimated Effort:** 1-2 weeks

### Phase 3: Mobile Apps (Q3 2025)

#### React Native App
**Priority:** Future

**Features:**
- Cross-platform (iOS/Android)
- Camera integration
- Push notifications
- Offline challenge storage
- GPS tracking for itineraries

**Tech Stack:**
- React Native
- Expo
- React Navigation
- AsyncStorage

**Estimated Effort:** 3-4 months

### Phase 4: Premium Features (Q4 2025)

#### Subscription Tiers
**Priority:** Future

**Free Tier:**
- 5 challenges/month
- 2 itineraries/month
- Basic chat coach

**Pro Tier ($9.99/mo):**
- Unlimited challenges
- Unlimited itineraries
- Advanced chat features
- Photo storage (5GB)
- Priority support

**Business Tier ($29.99/mo):**
- Everything in Pro
- Team accounts
- Custom branding
- API access
- Analytics dashboard

**Implementation:**
- Stripe integration
- Subscription management
- Usage tracking
- Feature flags

---

## Testing

### Unit Tests (Not Implemented)

**Framework:** Jest + React Testing Library

```bash
yarn test
```

### Integration Tests (Not Implemented)

**Framework:** Playwright

```bash
yarn test:e2e
```

### Manual Testing Checklist

**Authentication:**
- [ ] Sign up new user
- [ ] Log in existing user
- [ ] Log out
- [ ] Protected routes redirect

**Challenges:**
- [ ] Generate each challenge type
- [ ] Submit challenge with photo
- [ ] Skip challenge
- [ ] View challenge history

**Itineraries:**
- [ ] Generate itinerary for different locations
- [ ] View itinerary details
- [ ] Check gear recommendations

**Chat:**
- [ ] Ask for photography advice
- [ ] Request custom challenge
- [ ] Verify chatbot responses

**Dashboard:**
- [ ] View progress statistics
- [ ] Check streak calculations
- [ ] Verify completion rate

---

## Troubleshooting

### Common Issues

#### Database Connection Error
```
Error: Can't reach database server
```

**Solution:**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Verify DATABASE_URL in .env
echo $DATABASE_URL

# Test connection
psql -U user -d fotoai
```

#### Prisma Client Not Generated
```
Error: @prisma/client did not initialize yet
```

**Solution:**
```bash
yarn prisma generate
```

#### NextAuth Session Error
```
Error: [next-auth][error][JWT_SESSION_ERROR]
```

**Solution:**
```bash
# Generate new NEXTAUTH_SECRET
openssl rand -base64 32

# Add to .env
NEXTAUTH_SECRET="generated_secret"
```

#### Build Fails
```
Type error: Cannot find module
```

**Solution:**
```bash
# Clear cache and rebuild
rm -rf .next node_modules
yarn install
yarn build
```

---

## Contributing

### Contribution Guidelines

1. **Fork the repository**
2. **Create feature branch**
3. **Make changes with tests**
4. **Submit pull request**

### Pull Request Template

```markdown
## Description
[Describe your changes]

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings
```

---

## Resources

### External Documentation

- [Next.js Docs](https://nextjs.org/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [NextAuth.js Docs](https://next-auth.js.org)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com)
- [Abacus.AI API Docs](https://abacus.ai/api/docs)

### Project Documentation

- [FEATURES.md](FEATURES.md) - Feature overview
- [SELF_HOSTING_GUIDE.md](SELF_HOSTING_GUIDE.md) - Deployment guide
- [SYSTEM_DOCUMENTATION.md](SYSTEM_DOCUMENTATION.md) - Architecture
- [GITHUB_SETUP_INSTRUCTIONS.md](GITHUB_SETUP_INSTRUCTIONS.md) - Repo setup

---

## Contact & Support

**Repository:** https://github.com/sesal78/foto-photography-coach
**Live Demo:** https://myfoto.topues.com
**Issues:** https://github.com/sesal78/foto-photography-coach/issues

---

*Last Updated: January 1, 2025*
*Version: 1.0*
*Maintainer: Development Team*
