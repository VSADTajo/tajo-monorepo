# Tasks: SFTP Auth Integration

**Input**: Design documents from `/specs/005-sftp-auth-integration/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Backend e2e tests included per spec (test/modules/auth/auth-middleware.e2e-spec.ts). No frontend tests in scope.

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths in every description

---

## Phase 1: Setup

**Purpose**: Add new environment variables to example files before any implementation begins.

- [X] T001 Add `AUTH_API_URL=http://localhost:3002` to `src/.env.example` and `VITE_AUTH_API_URL=http://localhost:3002` to `frontend/.env.example`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend auth-api config module + domain port + infrastructure service. Must be complete before the auth middleware (US2) and before any frontend auth calls (US1) make sense to wire up.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 [P] Create `src/configuration/auth-api/auth-api-config.type.ts` — export `AuthApiConfig` type `{ authApiUrl: string }`
- [X] T003 [P] Create `src/configuration/auth-api/auth-api-config.ts` — `registerAs('auth-api', ...)` factory reading `AUTH_API_URL` from `process.env`, reuse existing `validateConfig` + `EnvVariablesValidator` pattern from `src/configuration/`
- [X] T004 [P] Create `src/configuration/auth-api/auth-api-config.service.ts` — `@Injectable() AuthApiConfigService` with `get authApiUrl(): string` using `ConfigService<AllConfig>.getOrThrow('auth-api.authApiUrl', { infer: true })`
- [X] T005 Create `src/configuration/auth-api/auth-api-config.module.ts` — `@Module` that imports `ConfigModule.forFeature(authApiConfig)`, provides and exports `AuthApiConfigService` (depends on T002, T003, T004)
- [X] T006 Update `src/configuration/configuration.type.ts` — add `'auth-api': AuthApiConfig` to the `AllConfig` union type (depends on T002)
- [X] T007 [P] Create `src/app/domain/ports/auth-validation.port.ts` — export `AuthValidationResult` interface `{ valid: boolean; userId?: string; roles?: string[] }` and `abstract class IAuthValidationService { abstract validate(token: string): Promise<AuthValidationResult>; }`
- [X] T008 Create `src/app/infrastructure/services/auth-validation.service.ts` — `@Injectable() AuthValidationService implements IAuthValidationService`, inject `Logger` and `AuthApiConfigService`, call `axios.post(\`\${authApiUrl}/auth/validate\`, { token })`, return `{ valid, userId, roles }` on success, throw `ProviderError` on network failure (depends on T005, T007)

**Checkpoint**: Foundation ready — config module, port, and service exist. Auth middleware can now be implemented.

---

## Phase 3: User Story 1 — User Login (Priority: P1) 🎯 MVP

**Goal**: React SPA shows a login screen to unauthenticated users. Submitting valid credentials calls `ms-authentication-api` directly, stores tokens in `localStorage`, and redirects to the main app. Invalid credentials show an error. Unauthenticated navigation redirects to `/login`.

**Independent Test**: Open the app → login screen appears. Submit valid credentials → redirect to main UI. Submit invalid credentials → error message shown. Manually navigate to `/` without token → redirected to `/login`.

- [X] T009 [P] [US1] Create `frontend/src/api/auth.api.ts` — export `loginUser(email, password): Promise<LoginResponse>` calling `POST ${VITE_AUTH_API_URL}/auth/login` and `refreshAccessToken(refreshToken): Promise<LoginResponse>` calling `POST ${VITE_AUTH_API_URL}/auth/refresh`; define `LoginResponse` type `{ accessToken: string; refreshToken: string; expiresIn: string; tokenType: string; refreshExpiresIn: string }`
- [X] T010 [P] [US1] Create `frontend/src/context/AuthContext.tsx` — export `AuthProvider` (React Context) managing `{ isAuthenticated: boolean; isLoading: boolean }` state from `localStorage`; export `useAuth()` hook returning `{ isAuthenticated, isLoading, login(email, password), logout(), getAccessToken() }`; `login()` calls `loginUser()` and writes `sftp_access_token` / `sftp_refresh_token` to `localStorage`; `logout()` removes both keys (depends on T009)
- [X] T011 [US1] Create `frontend/src/pages/LoginPage.tsx` — login form using `react-hook-form` with `email` (type=email, required) and `password` (type=password, required) fields; calls `useAuth().login()`; on success navigates to `/`; on failure calls `setError('root', { message: 'Email o contraseña inválidos' })`; shows `errors.root.message` and inline field validation messages (depends on T010)
- [X] T012 [US1] Create `frontend/src/guards/AuthGuard.tsx` — component that reads `useAuth().isAuthenticated`; if loading shows spinner/text "Cargando..."; if not authenticated returns `<Navigate to="/login" replace />`; otherwise renders `{children}` (depends on T010)
- [X] T013 [US1] Update `frontend/src/App.tsx` — wrap entire tree with `<AuthProvider>`; add `<Route path="/login" element={<LoginPage />} />`; wrap all existing routes inside `<AuthGuard><Layout /></AuthGuard>` as a layout route; preserve all existing routes unchanged (depends on T011, T012)

**Checkpoint**: User Story 1 is fully functional — login screen, auth redirection, session creation, and logout work independently of backend protection.

---

## Phase 4: User Story 2 — Protected Route Access (Priority: P2)

**Goal**: Every request to `ms-sftp-api` backend requires a valid JWT (401 otherwise). The frontend automatically injects the stored access token into all API calls. The `/health` endpoint remains unprotected.

**Independent Test**: `curl http://localhost:3003/mapping-schemas` → 401. `curl http://localhost:3003/mapping-schemas -H "Authorization: Bearer <valid-token>"` → 200. `curl http://localhost:3003/health` → 200 (no token needed).

- [X] T014 [US2] Create `src/app/infrastructure/middleware/auth.middleware.ts` — `@Injectable() AuthMiddleware implements NestMiddleware`; extract `Bearer` token from `Authorization` header (throw `HttpException(401)` if missing/malformed); call `this.authValidationService.validate(token)`; if `valid === true` attach `req.user = { userId, roles }` and call `next()`; if `valid === false` throw `HttpException(401)`; if `ProviderError` throw `HttpException(503)`; inject `Logger` and `IAuthValidationService` (depends on T007, T008)
- [X] T015 [US2] Update `src/app.module.ts` — implement `NestModule` on `AppModule`; add `configure(consumer: MiddlewareConsumer)` that applies `AuthMiddleware` globally via `.apply(AuthMiddleware).exclude({ path: 'health', method: RequestMethod.GET }).forRoutes('*')`; add `AuthApiConfigModule` to imports; add `AuthMiddleware` as a provider (depends on T005, T014)
- [X] T016 [US2] Update `src/app/infrastructure/infrastructure.module.ts` — add `AuthApiConfigModule` to imports; add `{ provide: IAuthValidationService, useClass: AuthValidationService }` and `AuthMiddleware` to providers; add `IAuthValidationService` to exports (depends on T005, T007, T008, T014)
- [X] T017 [P] [US2] Create `frontend/src/utils/fetchWithAuth.ts` — export `fetchWithAuth(input, init?): Promise<Response>` that reads `sftp_access_token` from `localStorage`, injects `Authorization: Bearer <token>` header, makes the fetch call, and returns the response; export token key constants `ACCESS_TOKEN_KEY = 'sftp_access_token'` and `REFRESH_TOKEN_KEY = 'sftp_refresh_token'`; export `clearTokens()` helper that removes both keys from `localStorage`
- [X] T018 [P] [US2] Update `frontend/src/api/cleanup-jobs.api.ts` — replace all `fetch(` calls with `fetchWithAuth(` (depends on T017)
- [X] T019 [P] [US2] Update `frontend/src/api/files.api.ts` — replace all `fetch(` calls with `fetchWithAuth(` (depends on T017)
- [X] T020 [P] [US2] Update `frontend/src/api/mapping-schemas.api.ts` — replace all `fetch(` calls with `fetchWithAuth(` (depends on T017)
- [X] T021 [P] [US2] Update `frontend/src/api/sftp-users.api.ts` — replace all `fetch(` calls with `fetchWithAuth(` (depends on T017)
- [X] T022 [US2] Update `frontend/src/components/Layout.tsx` — import `useAuth`; add `const { logout, getAccessToken } = useAuth()`; add `copyToken()` async handler that calls `navigator.clipboard.writeText(getAccessToken()!)`; render `<button onClick={copyToken}>Copiar Token</button>` and `<button onClick={logout}>Salir</button>` in the header (depends on T010)
- [X] T023 [US2] Create `test/modules/auth/auth-middleware.e2e-spec.ts` — e2e test that mocks `IAuthValidationService` via `{ provide: IAuthValidationService, useValue: mockAuthValidationService }`; tests: (1) missing `Authorization` header → 401, (2) `validate()` returns `{ valid: false }` → 401, (3) `validate()` returns `{ valid: true, userId, roles }` → 200 and `req.user` set, (4) `validate()` throws `ProviderError` → 503, (5) `GET /health` without token → 200 (excluded from middleware) (depends on T014, T015, T016)

**Checkpoint**: User Story 2 complete — all backend routes protected, frontend injects tokens automatically, logout and copy-token available in header.

---

## Phase 5: User Story 3 — Silent Token Refresh & Session Expiry (Priority: P3)

**Goal**: `fetchWithAuth` proactively refreshes the access token before expiry (checks JWT `exp` claim) and reactively retries on 401 using the refresh token. If refresh fails, tokens are cleared and user is redirected to `/login`.

**Independent Test**: With a near-expired access token and valid refresh token: make any API call → request succeeds (transparent refresh). With both tokens expired: make any API call → redirected to `/login`.

- [X] T024 [US3] Extend `frontend/src/utils/fetchWithAuth.ts` — add `proactiveRefreshIfNeeded()`: decode JWT `exp` from `localStorage.getItem(ACCESS_TOKEN_KEY)` payload (base64 decode, no library), if `exp - Date.now()/1000 < 60` call `refreshAccessToken()` and update `localStorage`; add `tryRefresh()`: calls `refreshAccessToken(localStorage.getItem(REFRESH_TOKEN_KEY)!)`, updates both tokens in `localStorage`, returns `true` on success and `false` on failure; update `fetchWithAuth` to call `proactiveRefreshIfNeeded()` before injecting the token, and on 401 call `tryRefresh()` then retry once — if `tryRefresh()` returns `false`, call `clearTokens()` and `window.location.href = '/login'` (depends on T017)

**Checkpoint**: All three user stories are fully functional. Silent refresh ensures uninterrupted sessions throughout the 15-day refresh token lifetime.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T025 Run backend e2e test suite: `cd ms-sftp-api && npm run test:e2e -- --testPathPattern=auth-middleware` and validate all 5 scenarios pass
- [ ] T026 Validate against `quickstart.md` test commands: confirm `curl http://localhost:3003/mapping-schemas` returns 401, curl with valid token returns 200, `curl http://localhost:3003/health` returns 200


---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — **BLOCKS all user stories**
- **User Story 1 (Phase 3)**: Depends on Phase 2 only — no backend dependencies, frontend-only
- **User Story 2 (Phase 4)**: Depends on Phase 2 (for middleware) + Phase 3 (for token storage via fetchWithAuth)
- **User Story 3 (Phase 5)**: Depends on Phase 3 (for refreshAccessToken) + Phase 4 (for fetchWithAuth base)
- **Polish (Phase 6)**: Depends on Phases 4 + 5

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2 — independently testable (frontend only)
- **US2 (P2)**: Can start after Phase 2 — depends on US1 for `useAuth` in Layout, `fetchWithAuth` base exists
- **US3 (P3)**: Depends on US1 (refreshAccessToken in auth.api.ts) and US2 (fetchWithAuth in utils/)

### Within Each User Story

- T009 (auth.api.ts) and T010 (AuthContext) are independent — start in parallel
- T011 (LoginPage) and T012 (AuthGuard) both depend on T010 — start in parallel after T010
- T013 (App.tsx) depends on T011 + T012
- T017 (fetchWithAuth base) is independent — start in parallel with T014
- T018–T021 (api file updates) all depend on T017 — start in parallel after T017

### Parallel Opportunities

```bash
# Phase 2 — all parallel after T001:
T002, T003, T004, T007  # independent files

# Phase 3 — parallel pair:
T009, T010              # auth.api.ts and AuthContext are independent
T011, T012              # LoginPage and AuthGuard are independent (after T010)

# Phase 4 — parallel pair:
T014, T017              # middleware and fetchWithAuth are independent
T018, T019, T020, T021  # 4 api file updates are independent (after T017)
```

---

## Implementation Strategy

### MVP First (User Story 1 + 2 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002–T008) — **CRITICAL**
3. Complete Phase 3: User Story 1 (T009–T013) — login flow working
4. Complete Phase 4: User Story 2 (T014–T023) — backend protected, frontend wired
5. **STOP and VALIDATE**: `curl /mapping-schemas` → 401, app login → works, logout → works
6. Deploy if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 (T009–T013) → Login screen works, tokens stored → **Demo: user can log in**
3. Add US2 (T014–T023) → Backend protected, API calls carry token → **Demo: full auth flow**
4. Add US3 (T024) → Silent refresh, no forced re-logins → **Demo: 15-min session extension invisible to user**

---

## Notes

- [P] tasks = different files, no incomplete dependencies — safe to run in parallel
- [Story] label maps each task to a specific user story for traceability
- Tests in T023 use mock `IAuthValidationService` — no real `ms-authentication-api` needed
- No new DB migrations in this feature (stateless JWT)
- No new npm packages on backend (`axios` already present)
- `VITE_AUTH_API_URL` must be set at Docker build time for the frontend
- `AUTH_API_URL` uses internal Docker network name in production (`http://ms-authentication-api:3002`)
