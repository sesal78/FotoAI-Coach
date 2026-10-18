# Foto AI Coach - live web app (@fotoai/legacy-web) image.
# Build context is the REPO ROOT (pnpm workspace):  docker build -f nextjs_space/Dockerfile .
# Node 22 LTS. No secrets at build time: the app reads every key from the runtime environment.
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

# Install workspace dependencies for the web app and the packages it uses
FROM base AS deps
RUN apk add --no-cache libc6-compat
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY nextjs_space/package.json nextjs_space/package.json
COPY packages packages
RUN pnpm install --frozen-lockfile --filter "@fotoai/legacy-web..."

# Build (standalone output traced from the repo root)
FROM base AS builder
COPY --from=deps /repo ./
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV SKIP_ENV_VALIDATION=1
ENV NEXT_OUTPUT_MODE=standalone
RUN pnpm --filter @fotoai/legacy-web build

# Production image
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# In a monorepo the standalone server lives under the app's folder name
COPY --from=builder /repo/nextjs_space/.next/standalone ./
COPY --from=builder /repo/nextjs_space/.next/static ./nextjs_space/.next/static
COPY --from=builder /repo/nextjs_space/public ./nextjs_space/public

RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "nextjs_space/server.js"]
