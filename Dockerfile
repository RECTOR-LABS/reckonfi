# syntax=docker/dockerfile:1

FROM node:23-slim

ENV ELIZAOS_TELEMETRY_DISABLED=true
ENV DO_NOT_TRACK=1

# System deps for native modules (better-sqlite3)
RUN apt-get update && apt-get install -y \
  python3 make g++ git \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN npm install -g pnpm

# Backend deps
COPY package.json bun.lock ./
RUN pnpm install

# Frontend deps
COPY frontend/package.json frontend/bun.lock ./frontend/
RUN cd frontend && pnpm install

# Copy frontend source and build (exclude node_modules via .dockerignore)
COPY frontend/src ./frontend/src
COPY frontend/public ./frontend/public
COPY frontend/index.html frontend/vite.config.ts frontend/tsconfig.json frontend/tsconfig.app.json frontend/tsconfig.node.json frontend/components.json ./frontend/
RUN cd frontend && pnpm run build

# Copy backend source
COPY src/ ./src/
COPY characters/ ./characters/
COPY build.ts tsconfig.json ./

# Install bun for plugin build
RUN npm install -g bun

# Build plugin
RUN bun run build.ts

# Symlink for ElizaOS plugin resolution
RUN ln -sf /app /app/node_modules/nosana-eliza-agent

# Move frontend build to public
RUN mv frontend/dist /app/public

RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV SERVER_PORT=3000

EXPOSE 3000

CMD ["pnpm", "start"]
