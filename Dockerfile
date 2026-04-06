# syntax=docker/dockerfile:1

FROM node:23-slim

# Disable telemetry early
ENV ELIZAOS_TELEMETRY_DISABLED=true
ENV DO_NOT_TRACK=1

# Install system dependencies needed for native modules (e.g. better-sqlite3)
RUN apt-get update && apt-get install -y \
  python3 \
  make \
  g++ \
  git \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Install backend dependencies
COPY package.json ./
RUN pnpm install

# Install frontend dependencies and build
COPY frontend/package.json ./frontend/
RUN cd frontend && pnpm install

COPY frontend/ ./frontend/
RUN cd frontend && pnpm run build

# Copy backend source
COPY src/ ./src/
COPY characters/ ./characters/
COPY tsconfig.json ./

# Move frontend build to /app/public/ (served by ElizaOS static file handler)
RUN mv frontend/dist /app/public

# Create data directory for SQLite
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV SERVER_PORT=3000

EXPOSE 3000

CMD ["pnpm", "start"]
