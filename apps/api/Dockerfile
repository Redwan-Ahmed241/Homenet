# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies needed for build
COPY package.json package-lock.json ./
RUN npm ci

# Copy source files
COPY . .

# Generate Prisma Client (dummy URLs satisfy config validation during build)
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
ENV DATABASE_URL_UNPOOLED="postgresql://dummy:dummy@localhost:5432/dummy"
RUN npx prisma generate

# Compile TypeScript to dist/
RUN npm run build

# ── Stage 2: Production Runner ──────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy generated Prisma Client and engines
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Copy built application and schema
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Create logs directory and assign permissions to non-root user
RUN mkdir -p /app/logs && chown -R node:node /app

USER node

EXPOSE 3000

CMD ["node", "dist/src/main.js"]

