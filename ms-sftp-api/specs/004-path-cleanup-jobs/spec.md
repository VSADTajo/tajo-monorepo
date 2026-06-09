# Feature Specification: Scheduled Path Cleanup Jobs

**Feature Branch**: `004-path-cleanup-jobs`
**Created**: 2026-03-09
**Status**: Draft
**Input**: User description: "Necesito crear cronjobs dinámicos por ruta de archivos. En el panel de Paths & Files, cada ruta debe tener un ícono de reloj que permita configurar una tarea de limpieza automática: elegir las extensiones de archivos a eliminar (ej. .xml, .csv) y la frecuencia de ejecución (ej. cada hora, cada día). Los cronjobs deben poder activarse/desactivarse sin eliminarlos. También debe verse el estado actual (activo/inactivo, próxima ejecución)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create a Cleanup Job for a Path (Priority: P1)

An administrator opens the Paths & Files panel, sees a clock icon on any path row, clicks it, and configures a new cleanup job: selects one or more file extensions to delete (e.g. `.xml`, `.csv`) and picks a frequency (e.g. every hour, every day). The job is saved and becomes active immediately.

**Why this priority**: Without the ability to create a job, no other story is possible. This is the core value of the feature — automating file cleanup without manual intervention.

**Independent Test**: Navigate to Paths & Files → click the clock icon on any path → fill in extensions and frequency → save → confirm the job appears with "Active" status and a calculated next-execution time.

**Acceptance Scenarios**:

1. **Given** a path with no cleanup job, **When** the administrator clicks the clock icon and configures `.xml` + every day, **Then** a new active cleanup job is saved, the clock icon updates to indicate a configured job, and the next execution time is displayed on the row.
2. **Given** the create form, **When** no extensions are selected, **Then** the form cannot be submitted and shows a validation message.
3. **Given** the create form, **When** no frequency is selected, **Then** the form cannot be submitted and shows a validation message.
4. **Given** a path that already has a cleanup job, **When** the administrator clicks the clock icon, **Then** the existing job configuration is shown (not a blank create form).

---

### User Story 2 - View Cleanup Job Status per Path (Priority: P2)

Each path row in the Paths & Files panel shows at a glance whether a cleanup job is configured: if yes, an active/inactive indicator and the next scheduled execution time are displayed alongside the clock icon.

**Why this priority**: Operators need visibility into which paths are being cleaned automatically and when, so they can identify misconfigured or inactive jobs without opening each one.

**Independent Test**: With a configured active job on a path, the path row shows "Active" and the next execution time without any clicks.

**Acceptance Scenarios**:

1. **Given** a path with an active cleanup job, **When** the administrator views the Paths & Files panel, **Then** the clock icon is highlighted, an "Active" badge is shown, and the next execution time is visible on the row.
2. **Given** a path with an inactive cleanup job, **When** the administrator views the panel, **Then** an "Inactive" badge is shown and no next-execution time is displayed.
3. **Given** a path with no cleanup job, **When** the administrator views the panel, **Then** the clock icon appears in a neutral state with no badge.

---

### User Story 3 - Toggle Cleanup Job On/Off (Priority: P3)

The administrator can activate or deactivate a cleanup job directly from the Paths & Files panel without deleting it, preserving the extensions and frequency configuration for future use.

**Why this priority**: Operators may need to temporarily stop cleanup during file processing windows without losing their configuration. Deleting and recreating is error-prone.

**Independent Test**: Click the toggle on an active cleanup job → status changes to "Inactive" → next execution disappears → toggle again → status returns to "Active" with recalculated next execution time.

**Acceptance Scenarios**:

1. **Given** an active cleanup job, **When** the administrator deactivates it, **Then** the status changes to "Inactive", the next execution time is removed, and no files are deleted at the previously scheduled time.
2. **Given** an inactive cleanup job, **When** the administrator activates it, **Then** the status changes to "Active" and the next execution time is recalculated from the current time.
3. **Given** a toggle action in progress, **When** the request is pending, **Then** the toggle button is disabled to prevent double-clicks.

---

### User Story 4 - Edit Cleanup Job Configuration (Priority: P4)

The administrator can change the extensions or frequency of an existing cleanup job. The updated configuration takes effect on the next scheduled execution.

**Why this priority**: Requirements change over time (e.g. adding a new extension, changing from daily to hourly). Edit is lower priority than create/view/toggle because it is less frequent.

**Independent Test**: Open an existing job → change frequency from daily to hourly → save → the next execution time on the row reflects the new schedule.

**Acceptance Scenarios**:

1. **Given** an active job configured to delete `.xml` every day, **When** the administrator adds `.csv` and changes frequency to every hour, **Then** the saved job now deletes `.xml` and `.csv` files every hour.
2. **Given** an edit that removes all extensions, **When** the administrator tries to save, **Then** validation prevents saving and shows an error.

---

### User Story 5 - Delete Cleanup Job (Priority: P5)

The administrator can permanently delete a cleanup job from a path. After deletion, the path row returns to its neutral (no job) state.

**Why this priority**: Cleanup is needed when a path no longer requires scheduled deletion. Lower priority because toggling off covers most temporary cases.

**Independent Test**: Delete a job from a path → path row returns to neutral clock icon with no badge → job no longer executes at its scheduled time.

**Acceptance Scenarios**:

1. **Given** a configured cleanup job, **When** the administrator deletes it after confirming the prompt, **Then** the job is permanently removed, the path row shows no badge, and no future executions occur.
2. **Given** a delete action, **When** the administrator has not confirmed, **Then** the job is not deleted and the confirmation prompt can be dismissed.

---

### Edge Cases

- What happens when a cleanup job fires but the directory does not exist or is inaccessible? The job logs the error and remains active, retrying on the next scheduled run.
- What happens when a cleanup job fires but there are no matching files? The job completes successfully with zero files deleted (not treated as an error).
- What happens when a path is removed from the system but a cleanup job still exists? The job is preserved and the administrator can manually delete it; it logs an error on each failed execution.
- What is the minimum configurable interval? Five minutes, to prevent resource exhaustion.
- What if an extension is entered with or without the leading dot (e.g. `xml` vs `.xml`)? Both are accepted and normalized to include the dot.
- Is extension matching case-sensitive? No — `.XML` and `.xml` are treated identically.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow administrators to create a cleanup job for any path listed in the Paths & Files panel.
- **FR-002**: A cleanup job MUST require at least one file extension and exactly one execution frequency before it can be saved.
- **FR-003**: Supported frequencies MUST include: every 5 minutes, every 15 minutes, every 30 minutes, every hour, every 6 hours, every 12 hours, every day, every week.
- **FR-004**: System MUST automatically execute each active cleanup job at the configured frequency, deleting all matching-extension files directly inside the configured path (non-recursive).
- **FR-005**: Each path MUST support at most one cleanup job at a time.
- **FR-006**: The Paths & Files panel MUST display a clock icon on every path row, regardless of whether a job is configured.
- **FR-007**: For paths with a configured job, the panel MUST show the job status (Active/Inactive) and, when active, the next scheduled execution time.
- **FR-008**: Administrators MUST be able to activate or deactivate a cleanup job without deleting its configuration.
- **FR-009**: Administrators MUST be able to edit the extensions and/or frequency of an existing cleanup job.
- **FR-010**: Administrators MUST be able to permanently delete a cleanup job, with a confirmation step.
- **FR-011**: When a cleanup job executes, the system MUST record: path, timestamp, number of files deleted, and any errors.
- **FR-012**: A failed execution MUST NOT deactivate the job — it continues to run on its next scheduled time.
- **FR-013**: File extension input MUST be normalized (case-insensitive, leading dot auto-added if missing).

### Key Entities

- **CleanupJob**: A scheduled file deletion task associated with one path. Attributes: unique identifier, target path, list of file extensions, frequency (human-readable label + schedule expression), active status, last execution time, last execution outcome (files deleted count, error message if any), next execution time.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Administrators can create a new cleanup job for any path in under 60 seconds from first click to saved confirmation.
- **SC-002**: Active cleanup jobs execute within 30 seconds of their scheduled time under normal system load.
- **SC-003**: 100% of configured active cleanup jobs execute on schedule without manual intervention.
- **SC-004**: The Paths & Files panel displays cleanup job status (active/inactive, next execution) for all paths without additional user interaction or page refresh.
- **SC-005**: Job activation/deactivation is reflected in the UI within 2 seconds of user action.

## Assumptions

- Only one cleanup job is allowed per path. Multiple schedules per path are out of scope for this feature.
- Cleanup is non-recursive: only files directly in the configured path are deleted, not files in subdirectories.
- The minimum scheduling interval is 5 minutes.
- All administrators have access to all paths — no per-path permission model in this feature.
- Cleanup jobs operate on the local filesystem only (not on external SFTP servers).
- The feature stores job configuration persistently so jobs survive application restarts.

## Dependencies

- Requires the Paths & Files panel (Feature 003) to be functional, as cleanup jobs are configured per path entry in that panel.
- Depends on the file deletion capability from the file management system (Feature 001).
