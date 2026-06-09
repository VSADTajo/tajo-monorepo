# Quickstart: Paths & Files Manager

**Feature**: 003-paths-schema-manager

---

## End-to-End Flow

### 1. User opens the "Paths & Files" section

**Frontend** calls `GET /api/files/paths-overview`

**Backend**:
1. Loads all SFTP users → collects `rootDirectory` values
2. Loads all mapping schemas → collects `directoryPath` values
3. Deduplicates (key = normalized absolute path)
4. For each path, attaches schema info if `MappingSchema.directoryPath` matches
5. Converts paths to relative form (strips `storageConfig.basePath` prefix)
6. Returns sorted list

**Frontend** renders a list of path cards with schema badges.

---

### 2. User expands a path to see files

**Frontend** calls `GET /api/files?directory=<path>` (where `path` is the relative path from the overview response)

**Backend** uses existing `ListFilesHandler` — no changes needed.

**Frontend** renders file table with name, size, modified date, and download button.

---

### 3. User downloads a file

**Frontend** renders `<a href="/api/files/download?path=<filePath>" download>` link.

**Backend** uses existing `DownloadFileHandler` + `GetActiveMappingSchemaByPathQuery` — no changes needed. If an active schema exists, the file is transformed before download.

---

### 4. User toggles schema activation

**Frontend** calls `PATCH /api/mapping-schemas/:id/toggle` with `{ isActive: !current }`.

**Backend** uses existing `ToggleMappingSchemaHandler` — no changes needed.

**Frontend** invalidates `['paths-overview']` and `['mapping-schemas']` queries → schema badge updates immediately.

---

## Integration Scenarios

### Path with active schema
```
GET /api/files/paths-overview
→ { paths: [{ path: "forecast", schema: { isActive: true, name: "Forecast Parser" } }] }

GET /api/files?directory=forecast
→ { files: [{ name: "report.xml", path: "forecast/report.xml", size: 2048 }] }

GET /api/files/download?path=forecast/report.xml
→ [file transformed to JSON per schema]
```

### Path without schema
```
GET /api/files/paths-overview
→ { paths: [{ path: "inbox", schema: null }] }

GET /api/files?directory=inbox
→ { files: [{ name: "data.csv", path: "inbox/data.csv", size: 512 }] }

GET /api/files/download?path=inbox/data.csv
→ [original file, no transformation]
```

### Toggling schema off
```
PATCH /api/mapping-schemas/uuid/toggle  { isActive: false }
→ 200 OK

GET /api/files/paths-overview  (re-fetch)
→ schema.isActive = false → badge shows "Inactive"

GET /api/files/download?path=forecast/report.xml  (next download)
→ [original file, no transformation — schema inactive]
```

---

## Frontend Query Keys

| Data | Query key | Invalidated by |
|------|-----------|----------------|
| Paths overview | `['paths-overview']` | — (read-only, refreshes on mount) |
| Files per path | `['files', directory]` | — (lazy, per expansion) |
| Schemas (for toggle) | `['mapping-schemas']` | `toggleSchema` mutation |
