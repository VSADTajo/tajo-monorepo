# Data Model: SFTP Auth Integration

**Feature**: 005-sftp-auth-integration
**Date**: 2026-03-10

---

## Database Changes

**None.** This feature introduces no new database tables or migrations.

Authentication is fully stateless (JWT). The backend validates tokens via an HTTP call to `ms-authentication-api` on each request. No token data is persisted in `ms-sftp-api`'s database.

---

## In-Memory / Storage Data Structures

### Browser localStorage (Frontend)

| Key | Type | Description |
|-----|------|-------------|
| `sftp_access_token` | `string` | JWT access token (15-min expiry). Sent as `Authorization: Bearer` on every API call. |
| `sftp_refresh_token` | `string` | JWT refresh token (15-day expiry). Used exclusively to renew `sftp_access_token`. |

**Cleared on**: logout, 401 when refresh also fails, manual browser clear.

---

### Frontend Auth State (React Context)

```typescript
interface AuthState {
    isAuthenticated: boolean;      // true when a valid accessToken exists in localStorage
    isLoading: boolean;            // true during initial token validation on app boot
    login: (email: string, password: string) => Promise<void>;  // calls /auth/login
    logout: () => void;            // clears localStorage tokens, redirects to /login
    getAccessToken: () => string | null;  // reads sftp_access_token from localStorage
}
```

---

### Backend Request Extension

The `AuthMiddleware` attaches validated user data to the Express request object after successful token validation:

```typescript
interface RequestUser {
    userId: string;    // from ms-authentication-api validate response
    roles: string[];   // from ms-authentication-api validate response
}

// Available as req.user in any controller after middleware runs
(req as Request & { user: RequestUser }).user
```

---

## External API Data Shapes (Consumed)

### POST /auth/login (ms-authentication-api → Frontend)

**Request:**
```typescript
{ email: string; password: string }
```

**Response:**
```typescript
{
    accessToken: string;       // JWT, 15-min expiry
    expiresIn: string;         // "15m"
    tokenType: string;         // "Bearer"
    refreshToken: string;      // JWT, 15-day expiry
    refreshExpiresIn: string;  // "15d"
}
```

### POST /auth/validate (ms-authentication-api → Backend middleware)

**Request:**
```typescript
{ token: string }  // raw JWT string (without "Bearer " prefix)
```

**Response (valid):**
```typescript
{
    valid: true;
    userId: string;
    roles: string[];
}
```

**Response (invalid):**
```typescript
{
    valid: false;
}
```
Or HTTP 401/400 error response.

### POST /auth/refresh (ms-authentication-api → Frontend)

**Request:**
```typescript
{ refreshToken: string }
```

**Response:**
```typescript
{
    accessToken: string;
    expiresIn: string;
    tokenType: string;
    refreshToken: string;      // new refresh token (rotation)
    refreshExpiresIn: string;
}
```

---

## New Configuration

### Backend environment variable

| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `AUTH_API_URL` | Yes | `http://ms-authentication-api:3002` | Base URL of `ms-authentication-api`. Used by `AuthMiddleware` for token validation. |

### Frontend build-time environment variable

| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `VITE_AUTH_API_URL` | Yes | `http://65.21.97.113:3002` | Public URL of `ms-authentication-api`. Accessed directly from the browser. |
