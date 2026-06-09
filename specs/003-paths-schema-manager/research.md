# Research: Paths & Files Manager

**Feature**: 003-paths-schema-manager
**Date**: 2026-03-09

---

## Decision 1: Frontend composition vs. new backend endpoint

**Decision**: Add a new backend endpoint `GET /api/files/paths-overview`

**Rationale**:
- `MappingSchema.directoryPath` is stored as absolute paths (e.g., `/data/files/forecast`) — enforced by `DirectoryPathValueObject` which requires paths starting with `/`
- `GET /api/files?directory=` expects **relative** paths (e.g., `forecast`) — resolved against `storageConfig.basePath` by `FilePathValueObject`
- The frontend has no knowledge of `storageConfig.basePath`, so it cannot convert absolute schema paths to relative file-API paths on its own
- A dedicated aggregation endpoint encapsulates this conversion cleanly, keeps the frontend simple, and avoids leaking server-side path knowledge

**Alternatives considered**:
- Frontend composition using existing endpoints — rejected because the frontend would need to know the base path to match schema directoryPaths with SFTP user rootDirectories
- Expose basePath via a config endpoint — rejected as unnecessarily exposing server internals

---

## Decision 2: Path format handling

**Decision**: Handler computes relative paths from absolute ones; paths outside basePath are included with their absolute form for display, but skipped for file listing

**Rationale**:
- `MappingSchema.directoryPath`: always absolute, always under storage basePath (by design — DirectoryPathValueObject enforces `/`-prefix and the app always writes schemas with the basePath prefix)
- `SftpUser.rootDirectory`: free-form string (only trimmed on save). May be absolute (e.g., `/data/sftp/user1`) or relative (e.g., `user1`). SFTP users may or may not be under the storage basePath

**Conversion rules**:
- If path starts with `/`: treat as absolute; compute relative via `path.relative(basePath, absolutePath)`. If result starts with `..`, the path is outside storage — include in overview with `canListFiles: false`
- If path does not start with `/`: treat as already relative to basePath — use as-is for file listing

---

## Decision 3: Files not included in paths-overview response

**Decision**: `GET /api/files/paths-overview` returns paths + schema info only — no file list

**Rationale**:
- Including file listings would create an N+1 problem (one FS listing per path)
- File listing is already available via `GET /api/files?directory=path`
- The frontend loads files lazily when a path is expanded — better UX (fast initial load)

---

## Decision 4: Hexagonal architecture — where the new handler lives

**Decision**: Add `ListPathsOverviewQuery` + `ListPathsOverviewHandler` to `src/app/application/queries/file.queries.ts`

**Rationale**:
- The query aggregates data about file paths — it belongs conceptually in the file domain
- The handler injects `ISftpUserRepository`, `IMappingSchemaRepository`, and `StorageConfigService` — cross-domain aggregate queries are acceptable per the constitution (handlers orchestrate ports)
- No new domain entity or value object is needed — this is a pure read aggregation

---

## Decision 5: No new domain entity or result class needed

**Decision**: Use a plain result interface inline in the query file; no new `src/app/domain/results/` file

**Rationale**:
- This is a view-model aggregation, not a persisted domain concept
- Adding a formal domain result class for a pure read aggregate would add complexity without value
- The result shape is defined by the DTO in `file.dtos.ts`

---

## Existing endpoints reused

| Endpoint | Frontend usage |
|----------|----------------|
| `GET /api/files/paths-overview` | NEW — load all paths + schema info on page open |
| `GET /api/files?directory=path` | Existing — lazy load files when path is expanded |
| `GET /api/files/download?path=file` | Existing — direct anchor link for download |
| `PATCH /api/mapping-schemas/:id/toggle` | Existing — toggle schema isActive from path row |
