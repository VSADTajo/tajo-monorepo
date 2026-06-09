# Feature Specification: File Mapping Engine

**Feature Branch**: `002-file-mapping-engine`
**Created**: 2026-03-05
**Status**: Draft
**Input**: User description: "Motor de mappeo para archivos SFTP, con UI de configuracion de esquemas por path, soporte multi-formato, y toggle de activacion por path"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configure a Mapping Schema for a Path (Priority: P1)

As an administrator, I want to define a mapping schema for a specific SFTP path so that files downloaded from that path are automatically transformed into my desired output format.

The system already manages files via SFTP across multiple remote paths. I need a way to tell the system: "When I download files from path X, transform them using this schema and give me the result in JSON (or Parquet, or DAT, etc.)."

**Why this priority**: Without the ability to create and save mapping schemas, no transformation can happen. This is the foundational capability.

**Independent Test**: Can be fully tested by creating a mapping schema for a path through the UI and verifying it is persisted and retrievable.

**Acceptance Scenarios**:

1. **Given** an SFTP path `/forecast/NAM/` exists with files, **When** I open the mapping configuration UI for that path, **Then** I can define a mapping schema specifying source fields, target fields, and output format (e.g., JSON).
2. **Given** I have defined a mapping schema, **When** I save it, **Then** the schema is persisted and appears in the list of configured paths.
3. **Given** a path already has a mapping schema, **When** I edit the schema, **Then** the changes are saved and the previous version is replaced.

---

### User Story 2 - Download Files with Automatic Transformation (Priority: P1)

As a user, I want files downloaded from a configured path to be automatically transformed according to the mapping schema, so I receive data in the format I need without manual conversion.

When I request a file download from a path that has an active mapping schema, the system should parse the source file (XML, CSV, etc.), apply the mapping rules, and return the file in the configured output format.

**Why this priority**: This is the core value proposition -- automated file transformation on download. Tied with P1 because it's useless without Story 1 and vice versa.

**Independent Test**: Can be tested by configuring a schema for a path, uploading a sample file, and downloading it -- verifying the output matches the expected format and structure.

**Acceptance Scenarios**:

1. **Given** path `/forecast/NAM/` has an active mapping schema configured for JSON output, **When** I download an XML file from that path, **Then** I receive a JSON file with data mapped according to the schema.
2. **Given** path `/historico/caudales/` has an active mapping schema configured for DAT output, **When** I download a CSV file from that path, **Then** I receive a .dat file with the mapped data.
3. **Given** a mapping schema is configured but the source file format doesn't match expected input, **When** I attempt to download, **Then** the system returns a clear error indicating the format mismatch.
4. **Given** a file contains missing or invalid data for mapped fields, **When** I download with transformation, **Then** missing fields use default values or are omitted, and the user is informed of any data quality issues.

---

### User Story 3 - Toggle Mapping On/Off per Path (Priority: P2)

As an administrator, I want to enable or disable the mapping engine for each path independently, so that I can switch between raw file downloads and transformed downloads without deleting my mapping configuration.

**Why this priority**: Flexibility to toggle without losing configuration is important for operations, but the core mapping must work first.

**Independent Test**: Can be tested by toggling a path's mapping status and verifying download behavior changes accordingly.

**Acceptance Scenarios**:

1. **Given** a path has an active mapping schema, **When** I disable mapping for that path, **Then** file downloads from that path return the original raw file.
2. **Given** a path has mapping disabled, **When** I re-enable it, **Then** file downloads resume using the previously configured schema.
3. **Given** a path has no mapping schema configured, **When** I view it in the UI, **Then** it shows as "No schema configured" and downloads return the raw file.

---

### User Story 4 - View All Paths and Their Mapping Status (Priority: P2)

As an administrator, I want to see a dashboard of all SFTP paths and their mapping status (active, inactive, not configured) so I can manage mappings across the system at a glance.

**Why this priority**: Operational visibility is essential for managing multiple paths but is secondary to the core mapping functionality.

**Independent Test**: Can be tested by navigating to the path listing UI and verifying all known paths are shown with correct status indicators.

**Acceptance Scenarios**:

1. **Given** multiple SFTP paths exist, **When** I open the mapping management UI, **Then** I see a list of all paths with their mapping status (Active, Inactive, Not Configured).
2. **Given** the path list is displayed, **When** I click on a path, **Then** I can view and edit its mapping schema configuration.
3. **Given** a new SFTP path is added to the system, **When** I refresh the mapping UI, **Then** the new path appears in the list with status "Not Configured".

---

### User Story 5 - Support Multiple Output Formats (Priority: P2)

As an administrator, I want to choose from multiple output formats (JSON, Parquet, DAT, CSV, and others) when configuring a mapping schema, so I can deliver data in whatever format downstream systems require.

**Why this priority**: Multi-format support is a key differentiator but can be incrementally added after the core JSON transformation works.

**Independent Test**: Can be tested by configuring the same source path with different output formats and verifying each produces correct output.

**Acceptance Scenarios**:

1. **Given** I am configuring a mapping schema, **When** I select the output format, **Then** I can choose from at least: JSON, CSV, DAT, and Parquet.
2. **Given** I configure a schema with Parquet output, **When** I download a file, **Then** I receive a valid Parquet file with the mapped data.
3. **Given** I change a path's output format from JSON to CSV, **When** I download a file, **Then** the output reflects the new format while using the same field mappings.

---

### Edge Cases

- What happens when the source file is empty (0 bytes)?
- What happens when the source file exceeds a maximum size threshold (e.g., 500MB)?
- What happens when the mapping schema references fields that don't exist in the source file?
- How does the system handle files with encoding issues (e.g., Latin-1 vs UTF-8)?
- What happens if two users modify the same path's schema simultaneously?
- What happens when the source XML has deeply nested structures not anticipated by the schema?
- How are files handled that contain multiple data series (e.g., XML files with multiple `<series>` blocks)?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow administrators to create mapping schemas for any SFTP path.
- **FR-002**: System MUST persist mapping schemas so they survive restarts and are available across sessions.
- **FR-003**: System MUST support defining field-level mappings: source field path, target field name, and optional transformation (e.g., type casting, date formatting).
- **FR-004**: System MUST support at least the following input formats: XML, CSV.
- **FR-005**: System MUST support at least the following output formats: JSON, CSV, DAT, Parquet.
- **FR-006**: System MUST allow enabling or disabling the mapping engine per path without deleting the schema configuration.
- **FR-007**: When mapping is disabled for a path, the system MUST serve the original file as-is on download.
- **FR-008**: When mapping is enabled for a path, the system MUST transform the file according to the schema before serving it on download.
- **FR-009**: System MUST provide a management UI where administrators can view all paths, their mapping status, and configure schemas.
- **FR-010**: System MUST validate mapping schemas before saving (e.g., required fields present, valid output format selected).
- **FR-011**: System MUST handle multi-series files (e.g., XML files with multiple `<series>` blocks) by mapping each series according to the schema.
- **FR-012**: System MUST provide clear error messages when transformation fails (format mismatch, missing fields, corrupt file).
- **FR-013**: The mapping schema MUST support defining how to handle header/metadata rows in CSV files (e.g., the first 15 lines of the hydrological CSV are metadata, data starts after).
- **FR-014**: System MUST support configuring the delimiter and encoding for CSV input/output files.
- **FR-015**: System MUST perform file transformation in real-time at download time. No pre-generation or caching of transformed files is required.

### Key Entities

- **MappingSchema**: Represents the transformation configuration for a specific SFTP path. Key attributes: associated path, input format, output format, field mappings, active/inactive status, schema version.
- **FieldMapping**: Represents a single field transformation rule within a schema. Key attributes: source field path (e.g., XPath for XML, column index/name for CSV), target field name, data type, default value, transformation rule.
- **SFTPPath**: Represents a remote directory being monitored. Key attributes: path string, connection details, mapping status.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Administrators can create and save a mapping schema for any path in under 5 minutes through the UI.
- **SC-002**: File transformation completes within 10 seconds for files up to 50MB.
- **SC-003**: 100% of downloaded files from active-mapping paths are correctly transformed according to their schema (zero silent data corruption).
- **SC-004**: Toggling mapping on/off for a path takes effect immediately on the next download request.
- **SC-005**: The system supports at least 4 output formats (JSON, CSV, DAT, Parquet) at launch.
- **SC-006**: Administrators can view and manage all path mappings from a single dashboard screen.
- **SC-007**: Schema validation catches 100% of invalid configurations before save (missing required fields, invalid format combinations).

## Assumptions

- The SFTP file management feature (branch `001-sftp-file-management`) is already implemented and provides the path listing and file download capabilities that this feature extends.
- Administrators are technical users familiar with data formats and field mapping concepts -- the UI does not need to be simplified for non-technical users.
- The initial supported input formats are XML and CSV, as these are the formats currently received (hydrological forecast XML from FEWS/Delft, and CSV station data). Additional input formats can be added later.
- DAT format refers to a delimited text format with configurable separator and no header row (common in hydrological/meteorological data exchange).
- Parquet output is binary columnar format -- the system will generate valid Parquet files readable by standard tools.
- File sizes are typically under 50MB; files larger than 500MB are considered exceptional and may have longer processing times.
- The mapping UI will be part of the existing application (e.g., integrated into the admin panel or a dedicated section).
- Multi-series XML files (like the ForecastNAM files with multiple `<series>` blocks) should produce one output record per event per series, preserving the series header metadata.
