# Quickstart: SFTP Auth Integration

**Feature**: 005-sftp-auth-integration

---

## New Environment Variables

### Backend (`ms-sftp-api` — add to `.env`)

```bash
# URL of ms-authentication-api (service-to-service, internal network)
AUTH_API_URL=http://localhost:3002
```

In Docker Compose / production:
```bash
AUTH_API_URL=http://ms-authentication-api:3002
```

### Frontend (`ms-sftp-api/frontend` — add to `frontend/.env`)

```bash
# Public URL of ms-authentication-api (accessed from browser)
VITE_AUTH_API_URL=http://localhost:3002
```

In production:
```bash
VITE_AUTH_API_URL=http://65.21.97.113:3002
```

---

## New Files (Backend)

| File | Purpose |
|------|---------|
| `src/configuration/auth-api/auth-api-config.type.ts` | `AuthApiConfig` type definition |
| `src/configuration/auth-api/auth-api-config.ts` | `registerAs('auth-api', ...)` with `AUTH_API_URL` |
| `src/configuration/auth-api/auth-api-config.service.ts` | Injectable service exposing `authApiUrl` |
| `src/configuration/auth-api/auth-api-config.module.ts` | NestJS module |
| `src/app/domain/ports/auth-validation.port.ts` | `IAuthValidationService` abstract class |
| `src/app/infrastructure/services/auth-validation.service.ts` | Calls `POST /auth/validate` on ms-authentication-api |
| `src/app/infrastructure/middleware/auth.middleware.ts` | Global middleware — validates token on every request |

## Modified Files (Backend)

| File | Change |
|------|--------|
| `src/app.module.ts` | Add `NestModule`, register `AuthMiddleware` globally, exclude `/health` |
| `src/app/infrastructure/infrastructure.module.ts` | Import `AuthApiConfigModule`, bind `IAuthValidationService` |
| `.env.example` | Add `AUTH_API_URL` |

---

## New Files (Frontend)

| File | Purpose |
|------|---------|
| `frontend/src/api/auth.api.ts` | `loginUser()`, `refreshToken()` calls to `VITE_AUTH_API_URL` |
| `frontend/src/context/AuthContext.tsx` | Auth state: `isAuthenticated`, `login`, `logout`, `getAccessToken` |
| `frontend/src/utils/fetchWithAuth.ts` | Token-injecting fetch wrapper with 401 + refresh handling |
| `frontend/src/guards/AuthGuard.tsx` | Protected route component — redirects to `/login` if not authenticated |
| `frontend/src/pages/LoginPage.tsx` | Login form (email + password) using `react-hook-form` |
| `frontend/.env.example` | Add `VITE_AUTH_API_URL` |

## Modified Files (Frontend)

| File | Change |
|------|--------|
| `frontend/src/App.tsx` | Wrap with `AuthProvider`, add `/login` route, protect all other routes with `AuthGuard` |
| `frontend/src/components/Layout.tsx` | Add logout button + copy token button in header |
| `frontend/src/api/cleanup-jobs.api.ts` | Replace `fetch` with `fetchWithAuth` |
| `frontend/src/api/files.api.ts` | Replace `fetch` with `fetchWithAuth` |
| `frontend/src/api/mapping-schemas.api.ts` | Replace `fetch` with `fetchWithAuth` |
| `frontend/src/api/sftp-users.api.ts` | Replace `fetch` with `fetchWithAuth` |

---

## Running the Feature Locally

1. Ensure `ms-authentication-api` is running on port 3002:
   ```bash
   cd infra && docker compose up -d
   ```

2. Start backend with new env var:
   ```bash
   cd ms-sftp-api
   # Add AUTH_API_URL=http://localhost:3002 to .env
   npm run start:dev
   ```

3. Start frontend with new env var:
   ```bash
   cd ms-sftp-api/frontend
   # Add VITE_AUTH_API_URL=http://localhost:3002 to frontend/.env
   npm run dev
   ```

4. Navigate to `http://localhost:5173` — login screen appears.

---

## Testing Auth Behavior

```bash
# Test unprotected endpoint (should return 401 now)
curl http://localhost:3003/mapping-schemas

# Test with valid token
TOKEN=$(curl -s -X POST http://localhost:3002/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"secret"}' | jq -r '.accessToken')

curl http://localhost:3003/mapping-schemas \
  -H "Authorization: Bearer $TOKEN"

# Health check (should still work without token)
curl http://localhost:3003/health
```
