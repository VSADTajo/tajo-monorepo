# Implementation Plan: File Mapping Engine

**Branch**: `002-file-mapping-engine` | **Date**: 2026-03-05 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-file-mapping-engine/spec.md`

## Summary

A configurable file mapping engine that transforms SFTP files on download. Administrators define mapping schemas per SFTP directory path via a dedicated React + Tailwind frontend with a visual schema builder, specifying field mappings and output format (JSON, CSV, DAT, Parquet). When a mapped path is active, `POST /sftp/download` automatically transforms the file; when inactive, it returns the raw file. Input formats: XML (FEWS PI TimeSeries) and CSV (hydrological station data). Transformation is on-the-fly at download time.

## Technical Context

**Language/Version**: TypeScript 5.7+ on Node.js >= 22
**Primary Dependencies**: NestJS 11, @nestjs/cqrs 11, TypeORM 0.3, fast-xml-parser, csv-parse, @dsnp/parquetjs | Frontend: React 19, Tailwind CSS 4, Vite, TanStack Query, React Hook Form
**Storage**: PostgreSQL 16 (MappingSchema entity with JSONB field mappings)
**Testing**: Jest + Supertest + Testcontainers
**Target Platform**: Linux server (Docker)
**Project Type**: web (NestJS backend + React frontend)
**Performance Goals**: <10 seconds transformation for files up to 50MB
**Constraints**: On-the-fly transformation (no pre-generation/cache), real-time at download
**Scale/Scope**: Dozens of SFTP paths, files typically <50MB, admin users only

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Hexagonal Architecture | PASS | New feature follows api/application/domain/infrastructure layers |
| II. CQRS with MediatR Pattern | PASS | Commands: Create/Update/Delete/Toggle. Queries: List/GetById/GetByPath. All via buses. |
| III. Dependency Inversion via Ports | PASS | IMappingSchemaRepository port, IFileTransformer port, bound in infrastructure.module |
| IV. Domain-Driven Validation | PASS | DirectoryPathValueObject, FieldMappingValueObject, entity validate() |
| V. Integration Testing through Endpoints | PASS | E2E tests via HTTP endpoints with Testcontainers |
| VI. Type Safety & Strictness | PASS | All new code uses strict TypeScript, path aliases |
| VII. Structured Error Hierarchy | PASS | EntityError for validation, ApiError for business rules, ProviderError for transformer failures |

**Post-Design Re-check**: All gates pass. No violations.

## Project Structure

### Documentation (this feature)

```text
specs/002-file-mapping-engine/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: research decisions
├── data-model.md        # Phase 1: entity design
├── quickstart.md        # Phase 1: setup guide
├── contracts/           # Phase 1: API contracts
│   └── mapping-schema-api.yaml
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### Source Code — Backend (repository root)

```text
src/
├── app/
│   ├── api/
│   │   ├── controllers/
│   │   │   └── mapping-schema.controller.ts      # NEW: CRUD + toggle endpoints
│   │   └── dtos/
│   │       └── mapping-schema.dtos.ts             # NEW: Request/Response DTOs
│   │
│   ├── application/
│   │   ├── commands/
│   │   │   └── mapping-schema.commands.ts         # NEW: Create, Update, Delete, Toggle
│   │   ├── queries/
│   │   │   ├── mapping-schema.queries.ts          # NEW: List, GetById, GetByPath
│   │   │   └── sftp.queries.ts                    # MODIFIED: download handler checks schema
│   │   └── mappers/
│   │       └── mapping-schema.mappers.ts          # NEW: DTO <-> Command/Result mappers
│   │
│   ├── domain/
│   │   ├── entities/
│   │   │   └── mapping-schema.entity.ts           # NEW: MappingSchema entity
│   │   ├── value-objects/
│   │   │   ├── directory-path.value-object.ts     # NEW: Validates dir path format
│   │   │   └── field-mapping.value-object.ts      # NEW: Validates field mapping rules
│   │   ├── ports/
│   │   │   ├── mapping-schema-repository.port.ts  # NEW: IMappingSchemaRepository
│   │   │   └── file-transformer.port.ts           # NEW: IFileTransformer
│   │   └── results/
│   │       └── mapping-schema.result.ts           # NEW: Schema operation results
│   │
│   └── infrastructure/
│       ├── persistence/
│       │   └── mapping-schema.repository.ts       # NEW: TypeORM implementation
│       └── services/
│           ├── file-transformer.service.ts        # NEW: Orchestrator
│           ├── parsers/
│           │   ├── xml-parser.service.ts           # NEW: XML input parser
│           │   └── csv-parser.service.ts           # NEW: CSV input parser
│           └── formatters/
│               ├── json-formatter.service.ts       # NEW: JSON output
│               ├── csv-formatter.service.ts        # NEW: CSV output
│               ├── dat-formatter.service.ts        # NEW: DAT output
│               └── parquet-formatter.service.ts    # NEW: Parquet output
│
├── migrations/
│   └── XXXXXXXXX-add-mapping-schemas-table.ts     # NEW: DDL migration

test/
├── factories/
│   └── mapping-schema.factory.ts                   # NEW: Test data factory
└── modules/
    └── mapping-schemas/
        ├── create-mapping-schema.e2e-spec.ts       # NEW
        ├── list-mapping-schemas.e2e-spec.ts         # NEW
        ├── toggle-mapping-schema.e2e-spec.ts        # NEW
        └── download-with-mapping.e2e-spec.ts        # NEW
```

### Source Code — Frontend (`frontend/`)

```text
frontend/
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── src/
│   ├── main.tsx                          # App entry point
│   ├── App.tsx                           # Router + QueryClient provider
│   ├── api/
│   │   └── mapping-schemas.api.ts        # API client (fetch calls to backend)
│   ├── pages/
│   │   ├── SchemasListPage.tsx           # Dashboard: all paths + status + toggle
│   │   ├── SchemaCreatePage.tsx          # Create new schema
│   │   └── SchemaEditPage.tsx            # Edit existing schema
│   ├── components/
│   │   ├── SchemaTable.tsx               # Path list table with status badges
│   │   ├── SchemaForm.tsx                # Main form (name, path, formats)
│   │   ├── FieldMappingEditor.tsx        # Visual field mapping builder (add/remove/reorder rows)
│   │   ├── CsvOptionsPanel.tsx           # CSV-specific options (delimiter, encoding, metadata rows)
│   │   ├── StatusToggle.tsx              # Active/Inactive toggle switch
│   │   └── Layout.tsx                    # Shared layout (sidebar, header)
│   ├── hooks/
│   │   ├── useSchemas.ts                 # TanStack Query: list, getById
│   │   └── useSchemaMutations.ts         # TanStack Query: create, update, delete, toggle
│   └── types/
│       └── mapping-schema.types.ts       # TypeScript interfaces (shared with API)
```

**Structure Decision**: Web application with separate backend (NestJS hexagonal architecture) and frontend (React + Tailwind + Vite). Backend follows existing patterns. Frontend is a new Vite project in `frontend/` with visual schema builder components. `admin.ts` (AdminJS) is NOT modified — the React frontend replaces it for this feature.

## Complexity Tracking

No constitution violations. No complexity justifications needed.
