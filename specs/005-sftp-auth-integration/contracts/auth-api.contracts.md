# Contracts: External Auth API Integration

**Feature**: 005-sftp-auth-integration
**Date**: 2026-03-10

These contracts document the external API surface of `ms-authentication-api` that `ms-sftp-api` (backend and frontend) depends on. `ms-sftp-api` is a **consumer** of these contracts — it does not own them.

---

## Contract 1: Token Issuance (Frontend → ms-authentication-api)

**Endpoint**: `POST /auth/login`
**Used by**: SFTP frontend (`LoginPage`)
**Auth required**: None

### Request
```
Content-Type: application/json

{
  "email": "string (required, valid email format)",
  "password": "string (required, non-empty)"
}
```

### Response 200 OK
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "15m",
  "tokenType": "Bearer",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshExpiresIn": "15d"
}
```

### Response 401 Unauthorized
```json
{
  "StatusCode": 401,
  "ErrorCode": "TR999",
  "ErrorDescription": "Invalid credentials"
}
```

### Consumer obligations
- Store `accessToken` as `sftp_access_token` in `localStorage`
- Store `refreshToken` as `sftp_refresh_token` in `localStorage`
- Redirect user to main application on success
- Display error message on 401

---

## Contract 2: Token Validation (Backend middleware → ms-authentication-api)

**Endpoint**: `POST /auth/validate`
**Used by**: `AuthMiddleware` in `ms-sftp-api` backend on every protected request
**Auth required**: None (internal service-to-service call)

### Request
```
Content-Type: application/json

{
  "token": "string (raw JWT, without 'Bearer ' prefix)"
}
```

### Response 200 OK — Valid token
```json
{
  "valid": true,
  "userId": "uuid-string",
  "roles": ["string"]
}
```

### Response 200 OK — Invalid token
```json
{
  "valid": false
}
```

Or any 4xx/5xx error response.

### Consumer obligations
- If `valid === true`: set `req.user = { userId, roles }` and call `next()`
- If `valid === false` or any error: throw HTTP 401
- If auth service unreachable (network error): throw HTTP 503

---

## Contract 3: Token Refresh (Frontend → ms-authentication-api)

**Endpoint**: `POST /auth/refresh`
**Used by**: `fetchWithAuth` utility in SFTP frontend
**Auth required**: None

### Request
```
Content-Type: application/json

{
  "refreshToken": "string (current refresh JWT from localStorage)"
}
```

### Response 200 OK
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "15m",
  "tokenType": "Bearer",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshExpiresIn": "15d"
}
```

### Response 401 Unauthorized (expired or invalid refresh token)
Any 4xx error.

### Consumer obligations
- On success: update `sftp_access_token` and `sftp_refresh_token` in `localStorage`, retry original request
- On failure: clear all tokens from `localStorage`, redirect to `/login`

---

## Notes

- All three endpoints are exposed by `ms-authentication-api` at `port 3002`
- CORS must be enabled on `ms-authentication-api` to allow direct browser requests from the SFTP frontend origin
- The backend (`ms-sftp-api`) calls only `/auth/validate` — the other two contracts are frontend-to-auth-api
- Token format is JWT; payload includes `exp` claim for expiry calculation (frontend proactive refresh)
