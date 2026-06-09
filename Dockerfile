FROM node:20.17.0-bookworm-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --include=dev

FROM deps AS build
WORKDIR /app
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20.17.0-bookworm-slim AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY --from=deps  /app/node_modules ./node_modules
COPY --from=build /app/dist         ./dist
RUN mkdir -p /app/dist/files_results && chown -R node:node /app
USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]

# Stage para desarrollo (usa el mismo deps pero con todas las dependencias)
FROM deps AS dev
WORKDIR /app
RUN mkdir -p /app/dist/files_results && chown -R node:node /app
USER node
EXPOSE 3000
CMD ["npm", "run", "start:dev"]