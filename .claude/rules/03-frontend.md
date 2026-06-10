# Frontend Conventions

The monorepo ships **three** frontends. The primary user-facing app is `vsad-tajo-frontend` (Vue 3). The other two are smaller UIs embedded inside their respective backend services.

## Primary: vsad-tajo-frontend

Located at `vsad-tajo-frontend/`. Runs on port **8080** in dev.

### Stack
- **Vue 3.5** + **Vite 6**
- **Vuetify 3** (component library)
- **Pinia 2.3** (state management)
- **vue-router 4.5**
- **TypeScript 5.7+** strict
- **Node.js >= 22**

### Visualization & GIS
- **Leaflet 1.9** for maps
- **echarts** + **vue-echarts** for analytics charts
- **apexcharts** for additional dashboards
- **@amcharts/amcharts5** for advanced visualizations
- **terraformer** for GIS geometry operations
- **date-fns 4.1** for date manipulation
- **ky** for HTTP requests

### Testing
- **Vitest 3** + **@vue/test-utils 2.4** for unit/component tests
- **Cypress 14** for e2e

### Scripts
```bash
cd vsad-tajo-frontend
npm install
npm run dev           # Vite dev server on :8080
npm run build         # production build
npm run check         # type check
npm run fix           # ESLint --fix
```

### Conventions
- Single File Components (`.vue`) with `<script setup lang="ts">`.
- State in Pinia stores under `src/stores/`.
- HTTP calls go through a typed `ky` instance per upstream service (`ms-gateway-api` is the default).
- ESLint + Prettier enforced.
- No `console.log` in production code.

## ms-sftp-api/ui (Mapping Engine UI)

Located at `ms-sftp-api/ui/`. Runs on port **5174** in dev. **React 19** based.

### Stack
- React 19 + Vite 7
- TailwindCSS for styling
- TypeScript

### How it ships
- In production it's built and served by `nginx` inside the `ms-sftp-api` container.
- In dev, Vite proxies `/api` to `ms-sftp-api:3003`.

### Scripts
```bash
cd ms-sftp-api/ui
npm install
npm run dev           # Vite dev server on :5174
npm run build
```

## ms-logs-api/ui

Located at `ms-logs-api/ui/`. Runs on port **3005** in dev. **React 18** based. Internal log inspection UI.

## Cross-Frontend Conventions

- Code, identifiers, comments in English.
- UI copy: Spanish (project domain language).
- All HTTP requests go through `ms-gateway-api` (port 3000) when the frontend is talking to the platform; direct calls to other microservices are reserved for tooling UIs (`ms-sftp-api/ui`, `ms-logs-api/ui`).
- Tests live next to source code: `*.spec.ts` (Vitest/unit) or `cypress/e2e/*.cy.ts` (Cypress).
