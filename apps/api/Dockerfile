# Build stage
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/db/package*.json ./packages/db/
COPY packages/contracts/package*.json ./packages/contracts/
RUN npm ci --workspace=@piglog/api --workspace=@piglog/db --workspace=@piglog/contracts --include-workspace-root
COPY . .
RUN npm run build --workspace=@piglog/contracts && \
    npm run build --workspace=@piglog/db && \
    npm run build --workspace=@piglog/api
RUN node scripts/prepare-packages.mjs

# Production stage
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/apps/api/package*.json ./apps/api/
COPY --from=builder /app/packages/db/package*.json ./packages/db/
COPY --from=builder /app/packages/contracts/package*.json ./packages/contracts/
RUN npm ci --workspace=@piglog/api --workspace=@piglog/db --workspace=@piglog/contracts --include-workspace-root --omit=dev
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/db/migrations ./packages/db/migrations
COPY --from=builder /app/packages/contracts/dist ./packages/contracts/dist
EXPOSE 3001
EXPOSE 5140/udp
EXPOSE 5141/tcp
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health/ready', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"
CMD ["sh", "-c", "node packages/db/dist/migrate.js && node apps/api/dist/server.js"]
