# Research: File Mapping Engine

**Feature**: 002-file-mapping-engine
**Date**: 2026-03-05

## R1: Existing SFTP Architecture (Stateless vs Persistent)

**Decision**: Introduce persistent entities (MappingSchema, FieldMapping) stored in PostgreSQL. The existing SFTP feature is stateless (connection details sent per request), but the mapping engine requires configuration persistence.

**Rationale**: Mapping schemas must survive restarts, be editable through a UI, and be automatically applied on download. This requires database-backed entities. The SFTP connection details remain stateless (sent per request), while the mapping configuration is path-based and persisted.

**Alternatives considered**:
- File-based config (JSON/YAML on disk): Rejected — no transactional safety, harder to manage via UI, no audit trail.
- In-memory only: Rejected — lost on restart.

## R2: File Parsing Libraries

**Decision**: Use `fast-xml-parser` for XML and native string/stream parsing for CSV. Use `parquetjs-lite` for Parquet output.

**Rationale**:
- `fast-xml-parser` is the most performant XML parser for Node.js, supports attribute parsing, and works well with the FEWS PI TimeSeries XML format seen in the sample files.
- CSV parsing is straightforward given the known formats (semicolon-delimited with metadata header). A lightweight custom parser or `csv-parse` from the `csv` package handles this well.
- `parquetjs-lite` (or `@dsnp/parquetjs`) provides Parquet write capabilities for Node.js without native dependencies.

**Alternatives considered**:
- `xml2js`: Slower, callback-based, less suited for streaming.
- `Papa Parse`: Browser-focused CSV parser, unnecessary overhead for server-side.
- Apache Arrow JS: Heavy dependency for just Parquet output.

## R3: Transformation Strategy

**Decision**: On-the-fly transformation at download time (user confirmed).

**Rationale**: Simpler architecture, no storage overhead, always uses latest schema. Acceptable given typical file sizes under 50MB and the SC-002 requirement of <10 seconds transformation time.

**Alternatives considered**:
- Pre-generation with cache: More complex, requires invalidation logic.
- Hybrid: Unnecessary complexity for current scale.

## R4: UI Approach

**Decision**: Build a separate React + Tailwind CSS frontend application (`frontend/`) with a visual schema builder. The frontend communicates with the NestJS backend via the REST API.

**Rationale**: A dedicated React frontend with Tailwind provides full control over the UX, especially for the schema builder which needs a visual drag-and-drop or table-based field mapping interface. AdminJS was considered but only offers a JSON textarea for JSONB fields — not user-friendly enough for defining field mappings. React + Tailwind enables a proper dashboard with path listing, status indicators, and an interactive schema editor.

**Tech stack**:
- **Vite** — fast dev server and build tool
- **React 19** — component framework
- **Tailwind CSS 4** — utility-first styling
- **React Router** — client-side routing
- **TanStack Query (React Query)** — server state management, cache, mutations
- **React Hook Form** — form handling for schema editor

**Alternatives considered**:
- AdminJS (existing in project): CRUD forms auto-generated but JSONB fields render as raw JSON textarea. No visual schema builder possible without heavy custom components.
- Pure API-only (no UI): Doesn't meet FR-009 requirement for a management UI.

## R5: Mapping Schema Storage Model

**Decision**: Store mapping schemas as a JSON column within the MappingSchema entity rather than a separate FieldMapping table with rows per field.

**Rationale**: Field mappings are always loaded/saved as a unit with the schema. A JSON column simplifies queries (single row per path), avoids joins, and the schema is validated at the application level before persistence. PostgreSQL's JSONB type provides indexing if needed.

**Alternatives considered**:
- Separate FieldMapping table with FK: Normalized but adds complexity for something always loaded as a whole. Rejected for now — can be extracted later if needed.

## R6: Integration with Existing Download Endpoint

**Decision**: Modify the existing `SftpDownloadFileHandler` (or create a new query `SftpDownloadMappedFileQuery`) to check for an active mapping schema for the requested path. If found, the handler pipes the raw stream through the transformation engine before returning.

**Rationale**: The download endpoint already exists and works. The mapping engine acts as an interceptor/middleware in the download pipeline. A new query handler keeps concerns separated while reusing the existing SFTP connection logic.

**Alternatives considered**:
- Controller-level middleware: Less testable, mixes concerns.
- Separate endpoint: Creates API fragmentation — users would need to know which endpoint to call.

## R7: Path Matching Strategy

**Decision**: Match mapping schemas to SFTP paths using directory-level matching (schema configured per directory path, applies to all files in that directory).

**Rationale**: The spec describes per-path configuration where "path" refers to the SFTP directory. All files within a configured directory share the same format (e.g., all XML files in `/forecast/NAM/` follow the same structure). This aligns with the sample data where files in the same directory share format.

**Alternatives considered**:
- Per-file matching (exact path): Too granular, impractical for directories with many files.
- Glob/regex matching: More flexible but harder to configure via UI.

## R8: Multi-Series XML Handling

**Decision**: For XML files with multiple `<series>` blocks (like FEWS PI TimeSeries), flatten each series into rows. Each output row contains the series header metadata (locationId, parameterId, stationName, etc.) merged with each event's data (date, time, value, flag).

**Rationale**: This is the most useful output format for downstream consumption. The sample files show multiple series per file, each with its own header and list of events. Flattening produces a tabular structure suitable for all output formats (JSON array, CSV rows, Parquet columns, DAT lines).

**Alternatives considered**:
- Nested output (preserve XML hierarchy): Only works for JSON, not for tabular formats like CSV/DAT/Parquet.
- One output file per series: Complicates the download endpoint.
