# Quickstart: File Mapping Engine

**Feature**: 002-file-mapping-engine

## Prerequisites

- Node.js >= 22
- Docker (for PostgreSQL, Redis, RabbitMQ)
- Existing SFTP feature working (`001-sftp-file-management`)

## Setup

```bash
# Backend: Install new dependencies
npm install fast-xml-parser csv-parse @dsnp/parquetjs

# Frontend: Initialize and install
cd frontend
npm create vite@latest . -- --template react-ts
npm install @tanstack/react-query react-router-dom react-hook-form
npm install -D tailwindcss @tailwindcss/vite

# Start infrastructure
docker compose up -d

# Run migrations (after creating the migration)
npm run migration:run

# Start backend (from root)
npm run start:dev

# Start frontend (from frontend/)
cd frontend && npm run dev
```

## New Dependencies

### Backend

| Package | Purpose | Version |
|---------|---------|---------|
| `fast-xml-parser` | Parse XML input files (FEWS PI TimeSeries format) | ^4.x |
| `csv-parse` | Parse CSV input files with configurable delimiters | ^5.x |
| `@dsnp/parquetjs` | Generate Parquet output files | ^1.x |

### Frontend

| Package | Purpose | Version |
|---------|---------|---------|
| `react` | UI framework | ^19.x |
| `react-router-dom` | Client-side routing | ^7.x |
| `@tanstack/react-query` | Server state management, caching, mutations | ^5.x |
| `react-hook-form` | Form handling for schema editor | ^7.x |
| `tailwindcss` | Utility-first CSS framework | ^4.x |
| `@tailwindcss/vite` | Tailwind Vite plugin | ^4.x |

## New Files to Create

### Domain Layer
- `src/app/domain/entities/mapping-schema.entity.ts` — MappingSchema entity with JSONB fieldMappings
- `src/app/domain/value-objects/directory-path.value-object.ts` — Validates directory path format
- `src/app/domain/value-objects/field-mapping.value-object.ts` — Validates field mapping rules
- `src/app/domain/ports/mapping-schema-repository.port.ts` — IMappingSchemaRepository abstract class
- `src/app/domain/ports/file-transformer.port.ts` — IFileTransformer abstract class
- `src/app/domain/results/mapping-schema.result.ts` — Result DTOs for schema operations
- `src/app/domain/errors/transformation.error.ts` — TransformationError for mapping failures

### Application Layer
- `src/app/application/commands/mapping-schema.commands.ts` — CreateMappingSchema, UpdateMappingSchema, DeleteMappingSchema, ToggleMappingSchema
- `src/app/application/queries/mapping-schema.queries.ts` — ListMappingSchemas, GetMappingSchemaById, GetMappingSchemaByPath
- `src/app/application/mappers/mapping-schema.mappers.ts` — All mapper classes
- `src/app/api/controllers/mapping-schema.controller.ts` — REST controller
- `src/app/api/dtos/mapping-schema.dtos.ts` — Request/Response DTOs

### Infrastructure Layer
- `src/app/infrastructure/persistence/mapping-schema.repository.ts` — TypeORM repository implementation
- `src/app/infrastructure/services/file-transformer.service.ts` — Main transformation orchestrator
- `src/app/infrastructure/services/parsers/xml-parser.service.ts` — XML input parser
- `src/app/infrastructure/services/parsers/csv-parser.service.ts` — CSV input parser
- `src/app/infrastructure/services/formatters/json-formatter.service.ts` — JSON output formatter
- `src/app/infrastructure/services/formatters/csv-formatter.service.ts` — CSV output formatter
- `src/app/infrastructure/services/formatters/dat-formatter.service.ts` — DAT output formatter
- `src/app/infrastructure/services/formatters/parquet-formatter.service.ts` — Parquet output formatter

### Migration
- `src/migrations/XXXXXXXXX-add-mapping-schemas-table.ts`

### Frontend (React + Tailwind)
- `frontend/src/api/mapping-schemas.api.ts` — API client (fetch to backend)
- `frontend/src/pages/SchemasListPage.tsx` — Dashboard: all paths + status + toggle
- `frontend/src/pages/SchemaCreatePage.tsx` — Create new schema
- `frontend/src/pages/SchemaEditPage.tsx` — Edit existing schema
- `frontend/src/components/SchemaTable.tsx` — Path list table with status badges
- `frontend/src/components/SchemaForm.tsx` — Main form (name, path, formats)
- `frontend/src/components/FieldMappingEditor.tsx` — Visual field mapping builder (add/remove/reorder rows)
- `frontend/src/components/CsvOptionsPanel.tsx` — CSV options panel
- `frontend/src/components/StatusToggle.tsx` — Active/Inactive toggle switch
- `frontend/src/components/Layout.tsx` — Shared layout
- `frontend/src/hooks/useSchemas.ts` — TanStack Query hooks for reads
- `frontend/src/hooks/useSchemaMutations.ts` — TanStack Query hooks for mutations
- `frontend/src/types/mapping-schema.types.ts` — TypeScript interfaces

### Tests
- `test/factories/mapping-schema.factory.ts`
- `test/modules/mapping-schemas/create-mapping-schema.e2e-spec.ts`
- `test/modules/mapping-schemas/list-mapping-schemas.e2e-spec.ts`
- `test/modules/mapping-schemas/toggle-mapping-schema.e2e-spec.ts`
- `test/modules/mapping-schemas/download-with-mapping.e2e-spec.ts`

## Files to Modify

- `src/app/infrastructure/infrastructure.module.ts` — Register new ports/implementations, add entity to TypeORM
- `src/app/application/application.module.ts` — Register handlers and controller
- `src/app/application/queries/sftp.queries.ts` — Modify SftpDownloadFileHandler to check for active schema
- `src/main.ts` — Enable CORS for frontend dev server (localhost:5173)

## Key Architectural Decisions

1. **MappingSchema entity uses JSONB** for fieldMappings (not a separate table) — loaded/saved as unit
2. **Transformation is on-the-fly** — no pre-generation or caching
3. **React + Tailwind frontend** — separate Vite app in `frontend/` with visual schema builder
4. **Parser/Formatter pattern** — pluggable input parsers and output formatters behind a port
5. **Download endpoint extended** — existing `POST /sftp/download` checks for active schema automatically

## Verification

```bash
# 1. Create a mapping schema
curl -X POST http://localhost:3000/mapping-schemas \
  -H 'Content-Type: application/json' \
  -d '{
    "directoryPath": "/forecast/NAM/",
    "name": "NAM EPS Stats",
    "inputFormat": "xml",
    "outputFormat": "json",
    "fieldMappings": [
      {"sourceField": "series.header.locationId", "targetField": "location_id"},
      {"sourceField": "series.header.stationName", "targetField": "station_name"},
      {"sourceField": "series.event.date", "targetField": "date"},
      {"sourceField": "series.event.value", "targetField": "value", "dataType": "number"}
    ]
  }'

# 2. List schemas
curl http://localhost:3000/mapping-schemas

# 3. Download with transformation (auto-applies if schema is active)
curl -X POST http://localhost:3000/sftp/download \
  -H 'Content-Type: application/json' \
  -d '{
    "connection": {"host": "sftp.example.com", "username": "user", "password": "pass"},
    "path": "/forecast/NAM/ForecastNAM_EPSstat_20260129.xml"
  }' -o output.json

# 4. Toggle mapping off
curl -X PATCH http://localhost:3000/mapping-schemas/{id}/toggle \
  -H 'Content-Type: application/json' \
  -d '{"isActive": false}'
```
