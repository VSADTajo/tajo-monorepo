# Data Model: Paths & Files Manager

**Feature**: 003-paths-schema-manager
**Date**: 2026-03-09

---

## No new database entities

This feature adds no new database tables or domain entities. It is a **read aggregation** over existing data:

| Source entity | Field used | Purpose |
|--------------|-----------|---------|
| `SftpUser` | `rootDirectory` | Source of paths |
| `MappingSchema` | `directoryPath`, `name`, `isActive`, `inputFormat`, `outputFormat` | Schema assignment per path |

---

## View model: PathOverview

This is a computed read model returned by `GET /api/files/paths-overview`. Not persisted.

```
PathOverview
├── path          : string   — relative path for use with the file listing endpoint
├── displayPath   : string   — original path as stored (may be absolute), for display
├── canListFiles  : boolean  — false if path is outside storage basePath
└── schema        : PathSchemaInfo | null
       ├── id           : string (UUID)
       ├── name         : string
       ├── isActive     : boolean
       ├── inputFormat  : 'xml' | 'csv'
       └── outputFormat : 'json' | 'csv' | 'dat' | 'parquet'
```

### Derivation rules

- **path deduplication**: Paths from `SftpUser.rootDirectory` and `MappingSchema.directoryPath` are merged into a unique set keyed by their **absolute** (or normalized) form
- **schema matching**: A `PathSchemaInfo` is attached if `MappingSchema.directoryPath` equals the absolute form of the path
- **sorting**: Paths are sorted alphabetically by `displayPath`

---

## Existing entities (read-only, no changes)

### SftpUser (existing)
- `id`: UUID
- `username`: string
- `rootDirectory`: string (free-form path, may be absolute or relative)
- `isActive`: boolean

### MappingSchema (existing)
- `id`: UUID
- `directoryPath`: string (absolute path, always starts with `/`)
- `name`: string
- `isActive`: boolean
- `inputFormat`: 'xml' | 'csv'
- `outputFormat`: 'json' | 'csv' | 'dat' | 'parquet'
