#
# Development
#
FROM node:22-alpine AS dev
# add the missing shared libraries from alpine base image
RUN apk add --no-cache libc6-compat gdal gdal-tools
# Create app folder
WORKDIR /app

# Set to dev environment
ENV NODE_ENV development

# Create non-root user for Docker
RUN addgroup -S -g 1001 node || true
RUN adduser -S -u 1001 -G node node || true

# Copy source code into app folder
COPY --chown=node:node . .

# Install dependencies
RUN npm install

# Set Docker as a non-root user
USER node

#
# Production Build
#
FROM node:22-alpine AS build

WORKDIR /app
RUN apk add --no-cache libc6-compat gdal gdal-tools

# Set to production environment
ENV NODE_ENV production

# Re-create non-root user for Docker
RUN addgroup -S -g 1001 node || true
RUN adduser -S -u 1001 -G node node || true

# In order to run `npm run build` we need access to the Nest CLI.
# Nest CLI is a dev dependency.
COPY --chown=node:node --from=dev /app/node_modules ./node_modules
# Copy source code
COPY --chown=node:node . .

# Generate the production build. The build script runs "nest build" to compile the application.
RUN npm run build

# Install only the production dependencies and clean cache to optimize image size.
RUN npm install --production && npm cache clean --force

# Set Docker as a non-root user
USER node

#
# Production Server
#
FROM node:22-alpine AS prod

WORKDIR /app
RUN apk add --no-cache libc6-compat gdal gdal-tools

# Set to production environment
ENV NODE_ENV production

# Re-create non-root user for Docker
RUN addgroup -S -g 1001 node || true
RUN adduser -S -u 1001 -G node node || true

# Copy only the necessary files
COPY --chown=node:node --from=build /app/dist dist
COPY --chown=node:node --from=build /app/node_modules node_modules
COPY --chown=node:node --from=build /app/package.json package.json
COPY --chown=node:node --from=build /app/entrypoint.sh entrypoint.sh
# Ensure entrypoint.sh is executable
RUN chmod +x /app/entrypoint.sh && \
    mkdir -p /app/.adminjs && chown node:node /app/.adminjs

# Set Docker as non-root user
USER node

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", "dist/src/main.js"]
