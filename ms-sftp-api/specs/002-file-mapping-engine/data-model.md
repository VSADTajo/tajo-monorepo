# Data Model: File Mapping Engine

**Feature**: 002-file-mapping-engine
**Date**: 2026-03-05

## Entities

### MappingSchema

Represents the transformation configuration for a specific SFTP directory path.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK, auto-generated | Unique identifier |
| directoryPath | VARCHAR(500) | NOT NULL, UNIQUE | SFTP directory path this schema applies to (e.g., `/forecast/NAM/`) |
| name | VARCHAR(255) | NOT NULL | Human-readable name for the schema (e.g., "NAM Forecast EPS Stats") |
| inputFormat | VARCHAR(20) | NOT NULL | Expected source format: `xml`, `csv` |
| outputFormat | VARCHAR(20) | NOT NULL | Target output format: `json`, `csv`, `dat`, `parquet` |
| isActive | BOOLEAN | NOT NULL, DEFAULT true | Whether transformation is enabled for this path |
| fieldMappings | JSONB | NOT NULL | Array of field mapping rules (see FieldMapping structure below) |
| csvOptions | JSONB | NULL | CSV-specific options (delimiter, encoding, headerRows, metadataRows) |
| createdAt | TIMESTAMP | NOT NULL, DEFAULT now() | Audit timestamp |
| updatedAt | TIMESTAMP | NOT NULL, DEFAULT now() | Audit timestamp |

### FieldMapping (JSONB structure within MappingSchema.fieldMappings)

Each element in the `fieldMappings` JSONB array:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sourceField | string | YES | Path to source field. For XML: XPath-like (e.g., `series.header.locationId`). For CSV: column index or header name. |
| targetField | string | YES | Name of the field in the output (e.g., `location_id`) |
| dataType | string | NO | Target data type: `string`, `number`, `date`, `boolean`. Default: `string` |
| defaultValue | string | NO | Value to use when source field is missing or empty |
| transform | string | NO | Optional transformation rule: `lowercase`, `uppercase`, `trim`, `dateFormat:YYYY-MM-DD`, etc. |

### CsvOptions (JSONB structure within MappingSchema.csvOptions)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| delimiter | string | `;` | Column delimiter for CSV input |
| encoding | string | `utf-8` | File encoding |
| metadataRows | number | `0` | Number of header/metadata rows to skip before data starts |
| outputDelimiter | string | `,` | Delimiter for CSV/DAT output |
| includeHeader | boolean | `true` | Whether to include a header row in CSV output |

## Relationships

```
MappingSchema (1) ── embeds ──> FieldMapping[] (JSONB)
MappingSchema (1) ── embeds ──> CsvOptions (JSONB)
```

No foreign key relationships to other entities. The `directoryPath` field is a logical reference to SFTP directory paths (SFTP connections are stateless/inline).

## Validation Rules

### MappingSchema
- `directoryPath`: Must start with `/`, must not be empty, must be unique across all schemas
- `name`: Must not be empty, max 255 characters
- `inputFormat`: Must be one of: `xml`, `csv`
- `outputFormat`: Must be one of: `json`, `csv`, `dat`, `parquet`
- `fieldMappings`: Must contain at least one mapping rule
- Each field mapping must have non-empty `sourceField` and `targetField`

### CsvOptions (when inputFormat is `csv`)
- `delimiter`: Must be a single character
- `metadataRows`: Must be >= 0
- `encoding`: Must be a valid encoding name (`utf-8`, `latin1`, `ascii`, etc.)

## State Transitions

```
MappingSchema lifecycle:
  Created (isActive: true by default)
    → Deactivated (isActive: false) — toggle off
    → Reactivated (isActive: true) — toggle on
    → Updated (fieldMappings/options changed)
    → Deleted
```

## Migration

Table: `mapping_schemas`

```sql
CREATE TABLE "mapping_schemas" (
    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "directoryPath" character varying(500) NOT NULL,
    "name" character varying(255) NOT NULL,
    "inputFormat" character varying(20) NOT NULL,
    "outputFormat" character varying(20) NOT NULL,
    "isActive" boolean NOT NULL DEFAULT true,
    "fieldMappings" jsonb NOT NULL,
    "csvOptions" jsonb,
    CONSTRAINT "PK_mapping_schema_id" PRIMARY KEY ("id"),
    CONSTRAINT "UQ_mapping_schema_directory_path" UNIQUE ("directoryPath")
);
```
