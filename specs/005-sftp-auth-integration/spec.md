# Feature Specification: SFTP Auth Integration

**Feature Branch**: `005-sftp-auth-integration`
**Created**: 2026-03-10
**Status**: Draft
**Input**: User description: "Integrar ms-sftp-api con ms-authentication-api para añadir login y protección de rutas. El frontend de ms-sftp-api (React SPA) debe tener una pantalla de login que llame a ms-authentication-api para autenticar al usuario. Una vez autenticado, todas las rutas del backend ms-sftp-api deben estar protegidas con JWT validado contra ms-authentication-api. Ambos servicios estarán desplegados en el mismo servidor (65.21.97.113)."

## Overview

The SFTP Mapping Engine UI (React SPA) currently has no authentication. This feature adds a login screen to the frontend and protects all backend routes in `ms-sftp-api` by delegating authentication to the existing `ms-authentication-api` service. Users must log in before accessing any SFTP functionality.

## Clarifications

### Session 2026-03-10

- Q: Should the authenticated UI provide a way to copy the current access token? → A: Yes — an authenticated user can tap a UI element to copy their access token to clipboard (developer utility for direct API testing).
- Q: How should ms-sftp-api validate JWT tokens on each request? → A: Remote validation — call `ms-authentication-api`'s `/auth/validate` endpoint on each request (consistent with ms-gateway-api pattern).
- Q: How should the frontend store the auth token and manage session lifetime? → A: Store both `accessToken` and `refreshToken` in `localStorage`; silently refresh the access token using the refresh token before it expires (15-min access token, 15-day refresh token).
- Q: Does the frontend call ms-authentication-api directly for login/refresh, or proxy through ms-sftp-api? → A: Directly — the frontend calls `ms-authentication-api` for login and token refresh; `ms-sftp-api` does not expose auth endpoints.
- Q: How should the frontend know the URL of ms-authentication-api? → A: Via a build-time environment variable (`VITE_AUTH_API_URL`), injected at Docker build/deploy time.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - User Login (Priority: P1)

A user opens the SFTP Mapping Engine UI and is presented with a login screen. They enter their credentials, which are validated by the authentication service. On success, they are redirected to the main application and can use all features. On failure, they see a clear error message.

**Why this priority**: Without login, nothing else works. This is the entry point for all authenticated functionality and delivers immediate standalone value (users can authenticate).

**Independent Test**: Can be fully tested by navigating to the app, submitting valid credentials, and verifying redirection to the main view — or submitting invalid credentials and verifying the error message is shown.

**Acceptance Scenarios**:

1. **Given** a user is not logged in, **When** they open the SFTP frontend, **Then** they are shown the login screen and cannot access any other page.
2. **Given** a user is on the login screen, **When** they submit valid credentials, **Then** they are redirected to the main SFTP UI and their session is active.
3. **Given** a user is on the login screen, **When** they submit invalid credentials, **Then** they remain on the login screen and see a descriptive error message (e.g., "Invalid email or password").
4. **Given** a user is on the login screen, **When** they submit with empty fields, **Then** inline validation messages are shown before the request is sent.

---

### User Story 2 - Protected Route Access (Priority: P2)

An authenticated user navigates through the SFTP UI. All requests from the frontend to the backend carry the authentication token automatically. The backend accepts these requests. An unauthenticated request (e.g., direct API call without a token) is rejected.

**Why this priority**: Core security requirement — without route protection, login provides no real security guarantee.

**Independent Test**: Can be fully tested by making API calls to any `ms-sftp-api` endpoint with and without a valid token, verifying 200 vs 401 responses.

**Acceptance Scenarios**:

1. **Given** a user is authenticated, **When** they interact with any SFTP feature (list mappings, run jobs, etc.), **Then** all backend requests succeed and return expected data.
2. **Given** a request arrives at any `ms-sftp-api` endpoint without a token, **When** the backend processes it, **Then** it returns a 401 Unauthorized response and the request is not processed.
3. **Given** a request arrives with a tampered or invalid token, **When** the backend validates it, **Then** it returns a 401 Unauthorized response.

---

### User Story 3 - Silent Token Refresh & Session Expiry (Priority: P3)

A user is working in the SFTP UI. Their access token (15 min) is about to expire, but the frontend silently obtains a new one using the refresh token — the user experiences no interruption. If both tokens are expired or invalid, the user is redirected to the login screen.

**Why this priority**: Without silent refresh, users would be forced to re-login every 15 minutes, which is unacceptable for normal use.

**Independent Test**: Can be fully tested by simulating an expired access token with a valid refresh token, verifying the session continues uninterrupted; and simulating an expired refresh token, verifying redirection to login.

**Acceptance Scenarios**:

1. **Given** an authenticated user's access token has expired and a valid refresh token exists, **When** any backend call is made, **Then** the frontend silently obtains a new access token and retries the request without user interruption.
2. **Given** both access token and refresh token are expired, **When** the user attempts any action, **Then** all stored tokens are cleared and the user is redirected to the login screen.
3. **Given** a user was redirected to login due to full session expiry, **When** they re-authenticate successfully, **Then** they are taken to the main application with a fresh session.

---

### Edge Cases

- What happens when `ms-authentication-api` is unreachable at login time? → Login fails with a user-friendly "Service temporarily unavailable" message; no crash or blank screen.
- What happens when `ms-authentication-api` is unreachable during token validation? → The backend returns 503 and the frontend shows an error message.
- What happens if a user manually navigates to a protected route URL while unauthenticated? → They are redirected to the login screen.
- What happens if the same user logs in from two browser tabs? → Both sessions remain valid independently.
- What happens if the user's token is valid but the user account was disabled on the auth service? → The backend rejects the request with 401.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The SFTP frontend MUST display a login screen as the default view for unauthenticated users, preventing access to all other views.
- **FR-002**: The login screen MUST collect user email and password and submit them directly to `ms-authentication-api`'s `/auth/login` endpoint for validation.
- **FR-003**: Upon successful authentication, the system MUST store both the `accessToken` and `refreshToken` in `localStorage` and redirect the user to the main SFTP interface.
- **FR-004**: All routes in `ms-sftp-api` backend MUST be protected and require a valid access token in each request.
- **FR-005**: The backend MUST validate each incoming token by calling `ms-authentication-api`'s `/auth/validate` endpoint on every request before processing it (remote validation, consistent with ms-gateway-api pattern).
- **FR-006**: The backend MUST return HTTP 401 for requests with no token, an invalid token, or an expired token.
- **FR-007**: The frontend MUST automatically include the stored token in all backend API requests.
- **FR-008**: When the frontend receives a 401 response from the backend, it MUST attempt a silent token refresh using the stored `refreshToken`; if the refresh also fails, it MUST clear all stored tokens and redirect the user to the login screen.
- **FR-014**: The frontend MUST proactively refresh the `accessToken` before it expires using the `refreshToken`, without requiring any user action.
- **FR-009**: The login screen MUST validate that email and password fields are not empty before submitting.
- **FR-010**: The system MUST display a clear, user-facing error message when login fails due to invalid credentials.
- **FR-011**: The system MUST display a user-facing error message when login fails due to the authentication service being unavailable.
- **FR-012**: A "Logout" action MUST be available in the authenticated UI, which clears all stored tokens from `localStorage` and returns the user to the login screen.
- **FR-013**: The authenticated UI MUST provide a clearly accessible element (e.g., a button) that copies the current access token to the clipboard when activated, to support direct API testing by developers.

### Key Entities

- **Access Token**: Short-lived JWT (15 min) issued by `ms-authentication-api` on login. Stored in `localStorage`. Sent as `Authorization: Bearer` header on every request to `ms-sftp-api`. Renewed silently via the refresh token before expiry.
- **Refresh Token**: Long-lived JWT (15 days) issued alongside the access token. Stored in `localStorage`. Used exclusively to obtain a new access token via `ms-authentication-api`'s `/auth/refresh` endpoint. Cleared on logout or full session expiry.
- **User Credentials**: Email and password submitted at login. Never stored by `ms-sftp-api`; only forwarded to `ms-authentication-api`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can complete the login flow (enter credentials → reach main UI) in under 5 seconds under normal network conditions.
- **SC-002**: 100% of `ms-sftp-api` backend routes reject unauthenticated requests (zero unprotected endpoints).
- **SC-003**: Login failure due to invalid credentials is communicated to the user within 3 seconds with a descriptive message.
- **SC-004**: The frontend never exposes a protected view or data to a user without a valid active session.
- **SC-005**: When `ms-authentication-api` is unavailable, users see an error message (no blank screen, no unhandled crash) in 100% of cases.

## Assumptions

- Users and their credentials already exist in `ms-authentication-api`; this feature does not include user registration or password recovery.
- `ms-authentication-api` exposes: `POST /auth/login` (issues accessToken + refreshToken), `POST /auth/validate` (validates token), and `POST /auth/refresh` (renews accessToken using refreshToken) — all accessible within the same server network.
- Access tokens expire in 15 minutes; refresh tokens expire in 15 days (configured on `ms-authentication-api`).
- The token format is JWT; `ms-sftp-api` backend does not parse token contents, only validates via the remote call.
- The SFTP frontend currently has no auth guard or login screen — this feature adds them from scratch.
- All existing SFTP API routes are currently unprotected; all will be protected by this feature.
- No role-based access control (RBAC) is required at this stage — any authenticated user may access all SFTP features.
- The URL of `ms-authentication-api` is provided to the frontend via a build-time environment variable (`VITE_AUTH_API_URL`); CORS must be enabled on `ms-authentication-api` to allow requests from the SFTP frontend origin.

## Out of Scope

- User registration, password reset, or account management.
- Role-based or permission-based access control within `ms-sftp-api`.
- Multi-factor authentication (MFA).
- OAuth2 / SSO / social login.
- Explicit "Remember me" toggle or user-configurable session duration.
- Audit logging of authentication events (may be handled by `ms-authentication-api`).
