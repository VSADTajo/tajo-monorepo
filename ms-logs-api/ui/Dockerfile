# Stage de build
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY ui/package*.json ./
RUN npm ci
COPY ui/ ./
# Build with runtime placeholders instead of real URLs/keys. Vite prioritises
# process env over .env.production, so these win — ONE image works on any host.
# docker-entrypoint.sh swaps them for the real values at container start.
ENV VITE_API_URL=__RUNTIME_API_URL__ \
    VITE_URL_API_GATEWAY=__RUNTIME_URL_API_GATEWAY__
RUN npm run build

# Stage de producción
FROM nginx:alpine AS prod
COPY --from=build /app/dist /usr/share/nginx/html
COPY ui/nginx.conf /etc/nginx/conf.d/default.conf
# Runtime URL/key substitution — nginx runs scripts in /docker-entrypoint.d/.
COPY ui/docker-entrypoint.sh /docker-entrypoint.d/40-runtime-config.sh
RUN chmod +x /docker-entrypoint.d/40-runtime-config.sh
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
