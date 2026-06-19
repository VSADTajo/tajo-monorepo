# Feature: Manual Simulation Flow — ms-predictions-api

**Status**: Draft
**Created**: 2026-06-19
**Last Updated**: 2026-06-19
**Umbrella spec**: `.specify/specs/manual-simulation-flow/spec.md`

---

## Overview

ms-predictions-api is the initiator and finalizer of the manual simulation pipeline. It owns three responsibilities:

1. **Initiation**: Creates `Simulation` (type=MANUAL) and `Maneuver` entities. Queries its own forecast prediction data for the reservoirs in the maneuvers, builds the SFTP input file, uploads it to ms-sftp-api, transitions the simulation to `MODEL_PROCESSING`, and publishes `simulation.manual.dispatched` so ms-model-api starts watching the output folder.

2. **Status tracking**: Consumes `simulation.status.updated` events from ms-model-api to reflect failures (`MODEL_FAILED`) in the simulation record.

3. **Finalization**: Consumes `timeseries.ingested` events that carry a `simulationId`, persists all predictions linked to that simulation, and transitions it to `FINALIZED`.

The `Maneuver` entity is new. It associates a reservoir code and a non-negative output flow value (caudal de salida) with a `Simulation`.

---

## User Scenarios

### US1: Create Manual Simulation with Maneuvers [P1]

**As a** system operator
**I want** to create a manual simulation with one or more reservoir maneuvers
**So that** I can define a custom operating scenario and trigger model processing

**Acceptance Criteria:**
- Given a simulation date, optional description, and a non-empty list of maneuvers (each with reservoir code + non-negative output flow value)
- When the creation request is submitted
- Then a `Simulation` with `type = MANUAL`, `status = CREATED` is persisted with all `Maneuver` records linked to it

**Edge Cases:**
- Zero maneuvers → rejected with a validation error
- Negative output flow value → rejected with a validation error

---

### US2: Build and Upload Forecast Input File to SFTP [P1]

**As a** system
**I want** to query forecast prediction data for the simulation's reservoirs and upload the input file to SFTP
**So that** the external hydrological model has the data it needs to run

**Acceptance Criteria:**
- Given a `Simulation` in `CREATED` status with its maneuvers
- When the SFTP dispatch step executes (as part of the creation flow or as a separate triggered step)
- Then the service queries its own forecast predictions for each reservoir code in the maneuvers, builds the input file, uploads it to ms-sftp-api at `/simulations/<simulationId>/input/`, transitions the simulation to `MODEL_PROCESSING`, and publishes `simulation.manual.dispatched` with `{ simulationId, outputFolder: /simulations/<simulationId>/output/ }`

**Edge Cases:**
- SFTP upload fails → simulation stays in `CREATED`, error is returned, no event is published
- No forecast predictions found for a reservoir → that reservoir's data is included as empty entries in the file; upload still proceeds

---

### US3: React to Failure Events from ms-model-api [P1]

**As a** system
**I want** to consume `simulation.status.updated` events published by ms-model-api
**So that** simulation failures are reflected in the simulation record

**Acceptance Criteria:**
- Given a `simulation.status.updated` event with `{ simulationId, status: MODEL_FAILED }`
- When the service consumes it
- Then the corresponding `Simulation` is transitioned to `MODEL_FAILED`

**Edge Cases:**
- SimulationId not found → event is acked and a warning is logged

---

### US4: Persist Predictions from Model Results [P1]

**As a** system
**I want** to consume `timeseries.ingested` events that carry a `simulationId`
**So that** all predictions from the model result are saved and the simulation is finalized

**Acceptance Criteria:**
- Given a `timeseries.ingested` event with `simulationId` and time series data
- When the service consumes it
- Then all prediction records are persisted with the `simulationId` reference and the simulation transitions to `FINALIZED`

**Edge Cases:**
- Persistence fails → event is nacked (requeue), simulation stays in `MODEL_PROCESSING`
- Partial failure → entire batch is rolled back, no partial predictions saved

---

### US5: Retrieve Simulation with Maneuvers [P2]

**As a** system operator
**I want** to retrieve a simulation including its maneuvers and current status
**So that** I can inspect the scenario before and after model execution

**Acceptance Criteria:**
- Given a valid simulation ID
- When the GET endpoint is called
- Then simulation data, all associated maneuvers, and current status are returned

---

### US6: List Manual Simulations [P2]

**As a** system operator
**I want** to list manual simulations with their status
**So that** I can monitor the pipeline

**Acceptance Criteria:**
- Given the list endpoint is called (optionally filtered by status)
- Then a list of manual simulations is returned, each with status, creation date, and maneuver count

---

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | A `Maneuver` record must link a reservoir code and a non-negative output flow value to a `Simulation` | P1 |
| FR-002 | Manual simulation creation requires at least one maneuver | P1 |
| FR-003 | The service must query its own forecast prediction data (DataOrigin.FORECAST) for the reservoir codes in the maneuvers to build the SFTP input file | P1 |
| FR-004 | The input file must be uploaded to ms-sftp-api at `/simulations/<simulationId>/input/` | P1 |
| FR-005 | After successful upload, the simulation must transition to `MODEL_PROCESSING` | P1 |
| FR-006 | After successful upload, a `simulation.manual.dispatched` event must be published with `simulationId` and `outputFolder` | P1 |
| FR-007 | If SFTP upload fails, the simulation must remain in `CREATED` and the error must be returned to the caller | P1 |
| FR-008 | The service must consume `simulation.status.updated` events and transition the simulation to the indicated status | P1 |
| FR-009 | The service must consume `timeseries.ingested` events that contain a `simulationId` and persist all predictions with that reference | P1 |
| FR-010 | Prediction persistence for a simulation must be transactional: all or nothing | P1 |
| FR-011 | On successful prediction persistence, the simulation must transition to `FINALIZED` | P1 |
| FR-012 | The service must expose a GET endpoint to retrieve a simulation by ID including its maneuvers | P2 |
| FR-013 | The service must expose a GET endpoint to list manual simulations filterable by status | P2 |

---

## Success Criteria

- [ ] POST to create a manual simulation with maneuvers returns the created simulation with all maneuver data
- [ ] The forecast input file is present at the expected SFTP path after creation
- [ ] A `simulation.manual.dispatched` event is verifiable in RabbitMQ after successful upload
- [ ] After consuming a `timeseries.ingested` event with simulationId, predictions appear in the DB linked to that simulation
- [ ] The simulation transitions `CREATED → MODEL_PROCESSING → FINALIZED`
- [ ] A failed SFTP upload leaves the simulation in `CREATED` and returns an error
- [ ] Creating a simulation with zero maneuvers returns a 400 validation error

---

## Assumptions

- ms-sftp-api exposes `POST /files/upload` and accepts a file stream with a target path
- Forecast prediction data (DataOrigin.FORECAST) for the relevant reservoirs is already present in the predictions table before a manual simulation is created
- `SimulationType.MANUAL`, `SimulationStatus.MODEL_PROCESSING`, `SimulationStatus.FINALIZED`, and `SimulationStatus.MODEL_FAILED` already exist in the `Simulation` entity
- The existing `timeseries.ingested` consumer (if any) handles events without `simulationId` as before — the new consumer handles only those with `simulationId`

---

## Out of Scope

- Changes to the AUTOMATIC simulation flow
- SFTP result file polling and parsing (handled entirely by ms-model-api)
- Editing maneuvers after the simulation has been dispatched
