# Feature: Manual Simulation Flow — ms-model-api

**Status**: Draft
**Created**: 2026-06-19
**Last Updated**: 2026-06-19
**Umbrella spec**: `.specify/specs/manual-simulation-flow/spec.md`

---

## Overview

ms-model-api handles the "return leg" of the manual simulation pipeline. It does not dispatch to SFTP — that is handled by ms-predictions-api. Instead, it:

1. **Tracking**: Consumes `simulation.manual.dispatched` events and creates a `SimulationRun` record so it knows which output folder to watch.

2. **Polling**: A dedicated cron job periodically checks the SFTP output folder for each active `SimulationRun`. When a result file is found, it is downloaded and parsed using the **existing SFTP ingestion logic** (`SftpFileProviderService`).

3. **Publishing**: Publishes `timeseries.ingested` enriched with the `simulationId` so ms-predictions-api can persist the predictions. On parse failure, publishes `simulation.status.updated` with `MODEL_FAILED`.

This is a minimal extension of the existing automatic ingestion flow. The existing `ProviderConfig` / `IngestionRun` / `ProviderSchedulerService` infrastructure is **not modified**.

---

## User Scenarios

### US1: Register a SimulationRun on Dispatch Event [P1]

**As a** system
**I want** to consume `simulation.manual.dispatched` and create a tracking record
**So that** the polling job knows which output folder to watch

**Acceptance Criteria:**
- Given a `simulation.manual.dispatched` event with `{ simulationId, outputFolder }`
- When ms-model-api consumes it
- Then a `SimulationRun` record is created with `status = WAITING_RESULT`, `simulationId`, and `outputFolder`

**Edge Cases:**
- Duplicate event for the same simulationId → idempotent: skip if a SimulationRun already exists for that simulationId

---

### US2: Poll SFTP Output Folder and Process Result File [P1]

**As a** system
**I want** to periodically check the SFTP output folder for each active SimulationRun and process the result file when available
**So that** the prediction data is published back to ms-predictions-api

**Acceptance Criteria:**
- Given one or more `SimulationRun` records in `WAITING_RESULT` status
- When the scheduled polling job runs
- Then for each pending run, the system checks the registered `outputFolder` via ms-sftp-api; if a result file is found, it downloads and parses it using the existing ingestion logic, marks the SimulationRun as `COMPLETED`, moves the result file to the historial folder, and publishes `timeseries.ingested` with `{ simulationId, timeSeries: [...] }`

**Edge Cases:**
- No result file yet → polling skips that run, no state change
- Result file malformed/corrupted → SimulationRun transitions to `FAILED`, file is moved to the corrupted folder, `simulation.status.updated` with `{ simulationId, status: MODEL_FAILED }` is published
- Multiple result files in output folder → process one per polling tick; remaining are processed in subsequent ticks

---

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | The service must consume `simulation.manual.dispatched` events from RabbitMQ | P1 |
| FR-002 | On consumption, a `SimulationRun` must be created with `simulationId`, `outputFolder`, and `status = WAITING_RESULT` | P1 |
| FR-003 | Duplicate `simulation.manual.dispatched` for the same simulationId must be handled idempotently | P1 |
| FR-004 | A scheduled cron job must query all `SimulationRun` records in `WAITING_RESULT` status and check their output folders | P1 |
| FR-005 | When a result file is found, it must be downloaded and parsed using the existing SFTP file ingestion logic | P1 |
| FR-006 | The parsed result must be published as `timeseries.ingested` including the `simulationId` field | P1 |
| FR-007 | Successfully processed result files must be moved to `<outputFolder>/historial/` (same pattern as existing automatic flow) | P1 |
| FR-008 | The SimulationRun must transition to `COMPLETED` after successful processing | P1 |
| FR-009 | Malformed result files must be moved to `<outputFolder>/corrupted/` and the SimulationRun transitioned to `FAILED` | P1 |
| FR-010 | On parse failure, `simulation.status.updated` with `{ simulationId, status: MODEL_FAILED }` must be published | P1 |
| FR-011 | The polling interval for manual simulation runs must be configurable independently of the existing provider polling intervals | P2 |

---

## Success Criteria

- [ ] Consuming a `simulation.manual.dispatched` event creates a `SimulationRun` in `WAITING_RESULT` status
- [ ] A duplicate event for the same simulationId does not create a duplicate SimulationRun
- [ ] Placing a valid result file in the registered output path causes the polling job to publish `timeseries.ingested` with the correct simulationId
- [ ] The SimulationRun transitions to `COMPLETED` and the result file is moved to the historial folder
- [ ] A malformed result file transitions the SimulationRun to `FAILED`, moves the file to corrupted, and publishes a `MODEL_FAILED` status event

---

## Assumptions

- ms-sftp-api exposes `GET /files`, `GET /files/download`, and `POST /files/move` (already used by the existing flow)
- The result file format is the same JSON time-series structure already handled by `SftpFileProviderService`
- The existing `timeseries.ingested` topic exchange and routing key are reused; the `simulationId` field is added as an optional enrichment without breaking existing consumers
- The existing automatic ingestion flow (`ProviderConfig` / `IngestionRun` / `ProviderSchedulerService`) is not modified

---

## Out of Scope

- SFTP input file dispatch (handled by ms-predictions-api)
- Changes to the existing automatic ingestion flow
- Retrying failed SimulationRuns (operator creates a new simulation)
- Authentication between ms-model-api and ms-sftp-api (existing `x-internal-caller` header pattern is used)
