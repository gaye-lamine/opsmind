# ─── Builder Stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copy monorepo configuration
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/ packages/
COPY apps/web/ apps/web/

# Install all development and production dependencies
RUN pnpm install --frozen-lockfile

# Next.js build time variables (can be passed via --build-arg)
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-http://localhost:8080}

# Build Next.js Dashboard App (outputs standalone build in apps/web/.next/standalone)
RUN pnpm --filter @opsmind/web build

# ─── Runner Stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Configure default production runtime environment
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copy Next.js standalone server and static assets from builder stage
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static

EXPOSE 3000

# Next.js standalone entry point
CMD ["node", "apps/web/server.js"]
