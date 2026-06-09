# Research: SFTP Auth Integration

**Feature**: 005-sftp-auth-integration
**Date**: 2026-03-10
**Status**: Complete — no NEEDS CLARIFICATION remaining

---

## Decision 1: Auth Middleware Pattern (Backend)

**Decision**: Use `NestMiddleware` (not `AuthGuard`) applied globally in `app.module.ts`, identical to `ms-gateway-api`.

**Rationale**: The existing codebase (`ms-gateway-api`) already solved this with a `NestMiddleware` + axios call to `/auth/validate`. Reusing the same pattern ensures consistency across the platform, leverages battle-tested code, and avoids introducing `@nestjs/passport` as a new dependency.

**Implementation reference**: `ms-gateway-api/src/app/infrastructure/middleware/auth.middleware.ts` — POST to `${authApiUrl}/auth/validate` with `{ token }` body. If `response.data.valid === true`, set `req.user` and call `next()`.

**Alternatives considered**:
- `@UseGuards(AuthGuard)` per controller: Rejected — requires decorator on every new controller; middleware is cleaner for universal protection.
- Local JWT verification (`@nestjs/jwt`): Rejected — decided in clarifications to use remote validation for consistency.

---

## Decision 2: Auth Service Port in Backend

**Decision**: Create a new `IAuthValidationService` abstract class (domain port) and `AuthValidationService` infrastructure implementation.

**Rationale**: The existing `IHttpService` (`domain/types/http-service.type.ts`) requires `HTTP_BASE_URL` injected at construction, making it unsuitable for direct reuse in the middleware without a dedicated provider. A dedicated `IAuthValidationService` port follows the established Hexagonal pattern, enables test mocking, and is clean to inject.

**Alternatives considered**:
- Direct `axios.post()` call in middleware (no port): Matches ms-gateway-api exactly, but violates hexagonal port principle and can't be mocked for tests.
- Reuse `IHttpService` via a factory: Overly complex — requires named DI token per base URL.

---

## Decision 3: Auth API Config Module

**Decision**: Create `configuration/auth-api/` config module (4 files: `.type.ts`, `.ts`, `.service.ts`, `.module.ts`) with `AUTH_API_URL` env var.

**Rationale**: Every external service config in this project follows the same 4-file pattern. Adding `auth-api` config as a proper config module keeps the codebase consistent and allows injection via `AuthApiConfigService`.

---

## Decision 4: Frontend Token Storage

**Decision**: `localStorage` for both `accessToken` and `refreshToken`.

**Rationale**: Decided in clarifications. Enables persistence across page reloads and tab navigation. Acceptable for this internal developer tool.

**Key names**: `sftp_access_token`, `sftp_refresh_token` (prefixed to avoid collisions with other apps on same origin).

---

## Decision 5: Frontend Auth State Management

**Decision**: React Context (`AuthContext`) — no external state library.

**Rationale**: The frontend has no state management library (no Zustand, Redux, etc.) and the token/auth state is simple enough for Context. Adding a library would be over-engineering.

**Context provides**: `{ isAuthenticated, login, logout, getAccessToken, isLoading }`

---

## Decision 6: Frontend Token Injection & 401 Handling

**Decision**: Create a `fetchWithAuth` utility function that:
1. Reads `accessToken` from `localStorage`
2. Injects `Authorization: Bearer <token>` header
3. On 401: attempts silent refresh via `ms-authentication-api/auth/refresh`
4. On refresh success: retries original request once with new token
5. On refresh failure: clears tokens, triggers redirect to `/login`

**Rationale**: The frontend uses native `fetch` (no axios), so interceptors don't exist. A `fetchWithAuth` wrapper is the idiomatic fetch equivalent of an axios interceptor. All 4 existing API files will be updated to use this utility.

**Alternatives considered**:
- React Query's `retry` callback: Can't add auth headers or handle token refresh cleanly.
- Axios: Not in deps; adding it just for interceptors is unnecessary.

---

## Decision 7: Frontend Login Call Path

**Decision**: Frontend calls `ms-authentication-api` directly via `VITE_AUTH_API_URL`.

**Rationale**: Decided in clarifications. `ms-sftp-api` does not expose auth endpoints.

**CORS requirement**: `ms-authentication-api` must have CORS enabled for the SFTP frontend origin. The backend already has `app.enableCors()` on all services.

---

## Decision 8: Proactive Token Refresh

**Decision**: Proactive refresh via `setInterval` or token expiry check on each `fetchWithAuth` call (check if token expires within 60 seconds, refresh proactively).

**Rationale**: `accessToken` expires in 15 min. Proactive refresh prevents mid-request failures. Implementation: decode JWT expiry from `exp` claim (no library needed — base64 decode payload), refresh if `exp - now < 60s`.

---

## Decision 9: No New Database Migrations

**Decision**: Zero new migrations for this feature.

**Rationale**: Auth is fully stateless (JWT). No tables, no entities. Backend only needs a middleware + config + service.

---

## Decision 10: Copy Token Button Location

**Decision**: In the `Layout` header component (top navigation bar), visible only when authenticated.

**Rationale**: Developer utility — should be accessible from any page without navigating away. Header is the natural place for global session controls (logout + copy token).
