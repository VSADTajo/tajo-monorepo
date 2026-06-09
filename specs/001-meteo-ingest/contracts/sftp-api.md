# Contract Consumed: ms-sftp-api

Endpoints that `ms-meteo-api` calls on `ms-sftp-api`. All requests carry header `x-internal-caller: ms-meteo-api` (must be added to the sftp-api whitelist as part of this feature).

**Base URL**: `http://ms-sftp-api:8212` (configurable via `SFTP_API_URL`).

---

## `GET /files?directory=<relative-path>`

**Status**: ✅ Already exists in `ms-sftp-api`.

Lists entries in a directory under `/data/files/`.

**Response 200**:
```json
{
  "directory": "tajo/METEO/HARMONIE/Precipitacion",
  "files": [
    {
      "name": "harm_prec0000.000",
      "path": "tajo/METEO/HARMONIE/Precipitacion/harm_prec0000.000",
      "size": 955223,
      "modifiedAt": "2026-04-06T18:02:00Z",
      "isDirectory": false
    },
    {
      "name": "info.json",
      "path": "tajo/METEO/HARMONIE/Precipitacion/info.json",
      "size": 312,
      "modifiedAt": "2026-04-06T18:02:00Z",
      "isDirectory": false
    }
  ]
}
```

Used for: discovering providers (`tajo/METEO/`), discovering variables of a provider (`tajo/METEO/HARMONIE/`), listing files of a variable (`tajo/METEO/HARMONIE/Precipitacion/`).

---

## `GET /files/download?path=<relative-path>`

**Status**: ✅ Already exists in `ms-sftp-api`.

Streams a binary file as `application/octet-stream` with `Content-Disposition: attachment`.

Used for: downloading individual raster files (`radarprec0000.NNN`, `harm_prec0000.NNN`, ...).

---

## `GET /files/read?path=<relative-path>`

**Status**: ❌ **NEW endpoint to add to `ms-sftp-api` as part of this feature.**

Returns the textual content of a file as JSON-wrapped string. Used to read `info.json` without abusing the `download` endpoint (which sets `Content-Disposition`).

**Response 200**:
```json
{
  "path": "tajo/METEO/HARMONIE/Precipitacion/info.json",
  "size": 312,
  "modifiedAt": "2026-04-06T18:02:00Z",
  "content": "{\"nombre\":\"Precipitación\", ... }"
}
```

**Errors**:
- `404` — file not found.
- `400` — path traversal attempt or path outside `/data/files`.
- `413` — file larger than a configurable text limit (default 1 MB) — `info.json` is always tiny.

**Implementation hint**: in `ms-sftp-api/src/app/api/controllers/file.controller.ts`, mirror the existing `download` handler but `readFile(... 'utf8')` and return JSON. Add a `ReadFileTextQuery` + `ReadFileTextHandler` next to `DownloadFileHandler` in `file.queries.ts`.

---

## Whitelist update

In `ms-sftp-api/src/app/api/middlewares/client-whitelist.middleware.ts`:

```ts
const ALLOWED_CALLERS = ['ms-gateway-api', 'ms-model-api', 'sftp-frontend', 'ms-meteo-api'];
```
