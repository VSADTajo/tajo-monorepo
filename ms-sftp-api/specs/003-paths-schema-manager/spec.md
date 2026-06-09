# Feature Specification: Paths & Files Manager

**Feature Branch**: `003-paths-schema-manager`
**Created**: 2026-03-09
**Status**: Draft
**Input**: User description: "Necesito agregar en el panel del frontend, otra seccion, donde pueda ver todos los paths que tengo y sus archivos, con la opcion de descargarlos tambien, y que muestre si estos paths ya tienen esquemas, y si es asi, que esquemas son, y poder activar y desactivar de ahi el propio esquema de parseo de cada path."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse paths and their files (Priority: P1)

An administrator opens the "Paths & Files" section and sees a list of all configured directory paths in the system. They can expand any path to see the files it contains, along with basic file information (name, size, last modification date).

**Why this priority**: This is the foundational view of the feature — without it, none of the other actions (download, schema management) are accessible. It provides immediate visibility into what data exists across all configured paths.

**Independent Test**: Can be fully tested by opening the section and verifying all known paths appear with their files visible on expand. Delivers value even without download or schema features.

**Acceptance Scenarios**:

1. **Given** there are configured paths in the system, **When** the administrator opens the "Paths & Files" section, **Then** all paths are listed, one per row, sorted alphabetically
2. **Given** a path is shown in the list, **When** the administrator clicks on it, **Then** the files inside that path are shown in a table with name, size, and last modification date
3. **Given** a path has no files, **When** the administrator expands it, **Then** a "No files" message is shown
4. **Given** a path cannot be read (access error), **When** the administrator expands it, **Then** an error message is displayed without crashing the page

---

### User Story 2 - Download files (Priority: P2)

An administrator sees the list of files inside a path and downloads any file with a single click.

**Why this priority**: Direct file access and retrieval is a core operational need. The system already handles schema-based transformation on download, so this unlocks that value for operators without requiring technical knowledge.

**Independent Test**: Can be fully tested by expanding a path with files and clicking the download button on a file. Delivers value independently of schema management.

**Acceptance Scenarios**:

1. **Given** a path is expanded with files visible, **When** the administrator clicks "Download" on a file, **Then** the file download starts immediately in the browser
2. **Given** a file's path has an active schema, **When** the administrator downloads the file, **Then** the downloaded file is transformed according to the schema (e.g., XML → JSON)
3. **Given** a file's path has no active schema, **When** the administrator downloads the file, **Then** the original file is downloaded without transformation

---

### User Story 3 - View schema assignment per path (Priority: P3)

An administrator can see at a glance, for each path, whether a parsing schema is assigned and what its name and current activation state are.

**Why this priority**: Understanding which paths have automated parsing configured is essential for operational oversight. This is read-only visibility and does not depend on schema editing features.

**Independent Test**: Can be fully tested by verifying that paths with existing schemas show the schema name and active/inactive badge, and paths without schemas show a "No schema" indicator.

**Acceptance Scenarios**:

1. **Given** a path has an assigned schema, **When** the administrator views the paths list, **Then** the schema name and its status (Active / Inactive) are displayed inline on the path row
2. **Given** a path has no assigned schema, **When** the administrator views the paths list, **Then** a "No schema" indicator is shown on that row
3. **Given** the schema status changes elsewhere in the system, **When** the administrator refreshes the section, **Then** the updated status is reflected

---

### User Story 4 - Toggle schema activation from the paths view (Priority: P4)

An administrator activates or deactivates the parsing schema for a specific path directly from the "Paths & Files" section, without navigating to the Schemas section.

**Why this priority**: Reduces the number of steps needed to control schema processing per path. Enables operational workflows where the administrator needs to pause or resume parsing for a specific path quickly.

**Independent Test**: Can be fully tested by toggling a schema from the path row and verifying the status badge updates, and that subsequent downloads reflect the new activation state.

**Acceptance Scenarios**:

1. **Given** a path has an active schema, **When** the administrator clicks the toggle to deactivate it, **Then** the schema is deactivated and the status badge updates to "Inactive" immediately
2. **Given** a path has an inactive schema, **When** the administrator clicks the toggle to activate it, **Then** the schema is activated and the status badge updates to "Active" immediately
3. **Given** the toggle action is in progress, **When** the administrator looks at the toggle button, **Then** the button is visually disabled to prevent double-clicks
4. **Given** a path has no schema, **When** the administrator views the row, **Then** no toggle control is displayed

---

### Edge Cases

- What happens when a path exists in the system but the directory does not exist on disk? → Show the path row but display an error message when the user tries to expand it
- What happens when two sources (SFTP users and mapping schemas) reference the same path? → The path appears only once in the list (deduplicated)
- What happens when the list of paths is empty (no SFTP users and no schemas configured)? → A clear "No paths configured" message is shown
- What happens when a file download fails? → The browser handles the failed download; no full-page error is triggered

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a dedicated "Paths & Files" section accessible from the main navigation panel
- **FR-002**: The section MUST display all unique directory paths sourced from SFTP user root directories and mapping schema directory paths, deduplicated and sorted alphabetically
- **FR-003**: Each path row MUST be expandable to reveal the list of files inside that directory
- **FR-004**: Each file entry MUST display: file name, file size (human-readable), and last modification date
- **FR-005**: Each file entry MUST include a download action that retrieves the file (applying schema transformation automatically if an active schema exists for that path)
- **FR-006**: Each path row MUST display whether a parsing schema is assigned to it
- **FR-007**: For paths with an assigned schema, the row MUST display the schema name and its current activation state (Active / Inactive)
- **FR-008**: For paths with an assigned schema, the row MUST include a toggle control to activate or deactivate the schema inline
- **FR-009**: The toggle control MUST be disabled while a toggle action is in progress to prevent concurrent changes
- **FR-010**: Paths without an assigned schema MUST show a "No schema" indicator with no toggle control

### Key Entities

- **Path**: A directory in the file storage system, sourced from SFTP user root directories and/or mapping schema directory paths. A path may or may not have files and may or may not have a schema assigned.
- **File**: A file stored within a path. Has a name, size, and last modification date. Can be downloaded, optionally with automatic schema-based transformation.
- **Parsing Schema**: A configuration that maps a directory path to a transformation rule. Has a name and an active/inactive state. At most one schema can be assigned per path.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Administrators can see all configured paths and their schema status without navigating more than 1 click from the main panel
- **SC-002**: Administrators can download any file with a single action
- **SC-003**: Administrators can toggle schema activation for a path with immediate visual feedback (under 2 seconds)
- **SC-004**: All paths from all sources (SFTP users + schemas) appear in a single unified view with zero duplication
- **SC-005**: The section correctly reflects the current schema activation state on each page visit

---

## Assumptions

- A path can only have one parsing schema assigned (enforced by the existing system — directory paths are unique per schema)
- The "Paths & Files" section shows files at the top level of each path only (no recursive subdirectory browsing)
- All users of the admin panel have equal access to all paths and schemas (no per-user permission scoping in this feature)
- Files listed may include only files, not subdirectories
