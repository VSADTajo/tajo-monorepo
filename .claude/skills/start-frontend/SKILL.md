---
name: start-frontend
description: >
  Levanta el frontend Vue 3 principal (vsad-tajo-frontend) localmente en el puerto 8080.
  Opcionalmente tambien sirve para levantar las UIs React embebidas (ms-sftp-api/ui,
  ms-logs-api/ui).
---

# /start-frontend

Levanta el frontend Vue 3 del monorepo. El default es `vsad-tajo-frontend/` (la app principal).

## Frontend principal: vsad-tajo-frontend

```bash
cd vsad-tajo-frontend
npm install                  # primera vez
npm run dev                  # Vite dev server en :8080
```

URL: http://localhost:8080

### Configuracion

El frontend espera que `ms-gateway-api` (port 3000) este corriendo. Si no, levantarlo con `/start-service ms-gateway-api` o todo el stack con `/start-all`.

Variables locales en `vsad-tajo-frontend/.env.local` si hace falta override.

### Build de produccion

```bash
cd vsad-tajo-frontend
npm run build                # output en dist/
npm run check                # type check (tsc --noEmit)
npm run fix                  # ESLint --fix
```

### Tests

```bash
npm run test                 # Vitest
npx cypress open             # Cypress interactive
npx cypress run              # Cypress headless
```

## UIs React embebidas

### ms-sftp-api/ui (Mapping Engine UI)

```bash
cd ms-sftp-api/ui
npm install
npm run dev                  # Vite dev server en :5174
```

Proxea `/api` a `ms-sftp-api:3003`. Requiere que `ms-sftp-api` este corriendo.

### ms-logs-api/ui

```bash
cd ms-logs-api/ui
npm install
npm run dev                  # Vite dev server en :3005
```

Requiere `ms-logs-api` (port 3004) corriendo.

## Troubleshooting

- **Puerto 8080 ocupado**: matar (`lsof -i :8080`) o cambiar el puerto en `vsad-tajo-frontend/vite.config.ts`.
- **API responde 401/403**: verificar token / sesion en localStorage. Limpiar con el devtools del navegador y volver a hacer login.
- **CORS errors**: en dev, Vite proxea las llamadas. Confirmar que la URL del API en `src/` apunta al gateway (`http://localhost:3000`) y no a un servicio puntual.
- **Hot reload no anda**: matar y relanzar `npm run dev`. En WSL/macOS con filesystem montado, a veces Vite necesita `--force`.
