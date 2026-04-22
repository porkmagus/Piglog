# Build stage
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/db/package*.json ./packages/db/
RUN npm ci --workspace=@piglog/api --workspace=@piglog/db --include-workspace-root
COPY . .
RUN npm run build --workspace=@piglog/db && npm run build --workspace=@piglog/api

# Production stage
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN npm install -g tsx
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/apps/api/package*.json ./apps/api/
COPY --from=builder /app/packages/db/package*.json ./packages/db/
RUN npm ci --workspace=@piglog/api --workspace=@piglog/db --include-workspace-root --omit=dev
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/db ./packages/db
EXPOSE 3001
CMD ["node", "apps/api/dist/server.js"]
