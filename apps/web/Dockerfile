# Build stage
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/
COPY packages/db/package*.json ./packages/db/
COPY packages/contracts/package*.json ./packages/contracts/
RUN npm ci --workspace=@piglog/web --workspace=@piglog/db --workspace=@piglog/contracts --include-workspace-root
COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build --workspace=@piglog/web

# Production stage — static SPA served by nginx
FROM nginx:alpine AS runner
COPY --from=builder /app/apps/web/build/client /usr/share/nginx/html
RUN rm /etc/nginx/conf.d/default.conf
COPY apps/web/nginx.conf /etc/nginx/conf.d/piglog.conf
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
