# ─── Builder Stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copy monorepo configuration
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/ packages/
COPY apps/api/ apps/api/

# Install all workspace dependencies (development + production)
RUN pnpm install --frozen-lockfile

# Build the Express API server (compiles into apps/api/dist/index.js via tsup)
RUN pnpm --filter @opsmind/api build

# ─── Runner Stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Copy only what is needed to install production dependencies
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json ./apps/api/

# Install pnpm and install production-only external dependencies
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && pnpm install --prod --frozen-lockfile --filter @opsmind/api

# Copy the standalone compiled single bundle from builder
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Express environment configuration
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

WORKDIR /app/apps/api
CMD ["node", "dist/index.js"]
