# Build stage
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/
COPY packages/db/package*.json ./packages/db/
RUN npm ci --workspace=@piglog/web --workspace=@piglog/db --include-workspace-root
COPY . .
RUN npm run build --workspace=@piglog/web

# Production stage
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/apps/web/package*.json ./apps/web/
RUN npm ci --workspace=@piglog/web --include-workspace-root --omit=dev
COPY --from=builder /app/apps/web/build ./apps/web/build
EXPOSE 3000
CMD ["./node_modules/.bin/react-router-serve", "./apps/web/build/server/index.js"]
