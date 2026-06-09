#
# Build
#
FROM node:22-alpine AS build

WORKDIR /app

ARG VITE_GEOSERVER_URL
ARG VITE_API_URL

ENV VITE_GEOSERVER_URL=$VITE_GEOSERVER_URL
ENV VITE_API_URL=$VITE_API_URL

# Install dependencies (cached unless package*.json changes)
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build-only

#
# Production (nginx)
#
FROM nginx:alpine AS prod

# Copy built assets
COPY --from=build /app/dist /usr/share/nginx/html

# SPA routing: fallback to index.html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
