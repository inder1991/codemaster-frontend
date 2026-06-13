## Sprint 12 / S12.1.1 — multi-stage build for codemaster-admin frontend.

# ─── deps stage ──────────────────────────────────────────────────
FROM node:20.18.0-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml .npmrc* ./
# Refresh bundled Corepack — the version shipped with node:20.18.0
# was signed with a key that npmjs.com has since rotated.
RUN npm install -g corepack@latest && \
    corepack enable && \
    pnpm install --frozen-lockfile --prod=false

# ─── builder stage ───────────────────────────────────────────────
FROM node:20.18.0-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm install -g corepack@latest && \
    corepack enable && \
    pnpm build

# ─── runtime stage ───────────────────────────────────────────────
FROM node:20.18.0-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nextjs && \
    adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
