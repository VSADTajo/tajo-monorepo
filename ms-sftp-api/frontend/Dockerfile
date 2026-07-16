#
# Development
#
FROM node:22-alpine AS dev

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev"]

#
# Build
#
FROM node:22-alpine AS build

# Default to a runtime placeholder so ONE image works on any host — the
# docker-entrypoint.sh swaps it for the real URL at container start.
ARG VITE_AUTH_API_URL=__RUNTIME_AUTH_API_URL__
ENV VITE_AUTH_API_URL=$VITE_AUTH_API_URL

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

#
# Production (nginx)
#
FROM nginx:alpine AS prod

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Runtime URL substitution — nginx:alpine runs executable scripts in
# /docker-entrypoint.d/ before starting nginx.
COPY docker-entrypoint.sh /docker-entrypoint.d/40-runtime-config.sh
RUN chmod +x /docker-entrypoint.d/40-runtime-config.sh

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
