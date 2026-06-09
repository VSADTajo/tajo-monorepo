# syntax=docker/dockerfile:1

#
# Development (docker-compose local dev with hot-reload)
#
FROM node:22-alpine AS dev
# add the missing shared libraries from alpine base image
RUN apk add --no-cache libc6-compat openssh-keygen openssh-keygen
# Create app folder
WORKDIR /app

ENV NODE_ENV=development

RUN addgroup -S -g 1001 node || true
RUN adduser -S -u 1001 -G node node || true

COPY --chown=node:node package*.json ./
RUN npm install
COPY --chown=node:node . .

# Ensure data directories exist with correct permissions
RUN mkdir -p /data/sftp /data/files && chown -R node:node /data

# Set Docker as a non-root user
USER node

#
# Production dependencies (cached unless package*.json changes)
#
FROM node:22-alpine AS prod-deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

#
# Build (compile TypeScript)
#
FROM node:22-alpine AS build

WORKDIR /app
RUN apk add --no-cache libc6-compat openssh-keygen

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci
COPY . .
RUN npm run build

#
# Production
#
FROM node:22-alpine AS prod

WORKDIR /app
RUN apk add --no-cache libc6-compat openssh-keygen

RUN addgroup -S -g 1001 node || true
RUN adduser -S -u 1001 -G node node || true

# Copy build output from build stage, prod deps from prod-deps stage
COPY --chown=node:node --from=build /app/dist dist
COPY --chown=node:node --from=prod-deps /app/node_modules node_modules
COPY --chown=node:node --from=build /app/package.json package.json
COPY --chown=node:node --from=build /app/tsconfig.json tsconfig.json
COPY --chown=node:node --from=build /app/entrypoint.sh entrypoint.sh

RUN chmod +x /app/entrypoint.sh && \
    mkdir -p /app/.adminjs && chown node:node /app/.adminjs
# Ensure data directories exist with correct permissions
RUN mkdir -p /data/sftp /data/files && chown -R node:node /data

# Set Docker as non-root user
USER node

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", "dist/src/main.js"]
