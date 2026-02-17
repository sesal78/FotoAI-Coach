# Foto AI Agent - Self-Hosted Dockerfile (Appwrite backend)
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

RUN npm install --legacy-peer-deps

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set build-time environment variables
ARG NEXT_PUBLIC_APPWRITE_ENDPOINT
ARG NEXT_PUBLIC_APPWRITE_PROJECT_ID
ARG APPWRITE_ENDPOINT
ARG APPWRITE_PROJECT_ID
ARG APPWRITE_API_KEY
ARG APPWRITE_DATABASE_ID
ARG APPWRITE_STORAGE_BUCKET_ID
ARG ABACUSAI_API_KEY
ARG SENDGRID_API_KEY
ARG OPENWEATHERMAP_API_KEY
ARG FROM_EMAIL
ARG FROM_NAME
ARG USER_EMAIL

ENV NEXT_PUBLIC_APPWRITE_ENDPOINT=$NEXT_PUBLIC_APPWRITE_ENDPOINT
ENV NEXT_PUBLIC_APPWRITE_PROJECT_ID=$NEXT_PUBLIC_APPWRITE_PROJECT_ID
ENV APPWRITE_ENDPOINT=$APPWRITE_ENDPOINT
ENV APPWRITE_PROJECT_ID=$APPWRITE_PROJECT_ID
ENV APPWRITE_API_KEY=$APPWRITE_API_KEY
ENV APPWRITE_DATABASE_ID=$APPWRITE_DATABASE_ID
ENV APPWRITE_STORAGE_BUCKET_ID=$APPWRITE_STORAGE_BUCKET_ID
ENV ABACUSAI_API_KEY=$ABACUSAI_API_KEY
ENV SENDGRID_API_KEY=$SENDGRID_API_KEY
ENV OPENWEATHERMAP_API_KEY=$OPENWEATHERMAP_API_KEY
ENV FROM_EMAIL=$FROM_EMAIL
ENV FROM_NAME=$FROM_NAME
ENV USER_EMAIL=$USER_EMAIL

ENV NEXT_TELEMETRY_DISABLED=1
ENV SKIP_ENV_VALIDATION=1
ENV NEXT_OUTPUT_MODE=standalone

# Create empty yarn.lock so Next.js standalone mode doesn't throw on stat
RUN touch yarn.lock

# Build Next.js application
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
