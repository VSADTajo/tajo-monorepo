# Feature Specification: Calculator Integration — Model Hook

**Feature Branch**: `calculator-integration-model-hook`
**Created**: 2026-07-05
**Status**: Ready for Plan
**Team**: calculator-integration (teammate 2 of 4)
**Umbrella spec**: `.specify/specs/calculator-integration/spec.md` (repo root, if any)
**Related teammates**:
- teammate 1 (calculator-service) — defines the input contract we publish to
- teammate 3 (predictions-consumer) — consumes calculator output downstream
- teammate 4 (observability-runbook) — cross-cutting correlation IDs and runbook

---

## Overview

`ms-model-api` currently publishes the result of every completed simulation run (manual and automatic) to the topic `model-events` with routing key `timeseries.ingested`, which is consumed directly by `ms-predictions-api`.

The new **volume calculator** service (teammate 1) needs to be inserted **only** into the manual simulation flow, between `ms-model-api` and `ms-predictions-api`. For manual runs the model output must go to the calculator first (which computes reservoir volume balances) before landing in predictions. The automatic-provider path stays unchanged.

Additionally, the calculator is **stateless** — it does not read the observed reservoir volume (`v.obs`) from disk. Therefore `ms-model-api` is responsible for **enriching the outgoing event with the observed-volume series** by fetching and parsing the WISKI CSV file `Tagus_FlowCast.csv` from SFTP at the same poll cycle.

The change is guarded by a feature flag `USE_CALCULATOR_PIPELINE` so it can be rolled out and rolled back without redeploy.

### Non-goals

- Modify the automatic-provider ingestion flow (`ingestion.commands.ts` and everything invoked from it).
- Change the payload shape of the outgoing event beyond appending the parsed `v.obs` series to `timeSeries[]`.
- Publish to both topics at once (dual publish).
- Persist the WISKI CSV or its parsed representation. Fetch-and-forward only.
- Change what the calculator or predictions services consume/produce.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Route manual simulation output to the calculator (Priority: P1)

**As** the platform
**I want** manual-simulation outputs published to the calculator topic instead of directly to predictions when the calculator pipeline is enabled
**So that** predictions receives reservoir volume balances instead of raw simulation output

**Why this priority**: Without this, the calculator never receives work and the whole team's integration is a no-op.

**Independent Test**: Toggle `USE_CALCULATOR_PIPELINE=true`, publish a valid `simulation.manual.dispatched` event, drop a valid result file in the SFTP output folder, and observe an AMQP message on the `simulation-events` exchange with routing key `simulation.manual.output.fetched` bound to the calculator queue. No message is published to `model-events`/`timeseries.ingested` for that run.

**Acceptance Scenarios**:

1. **Given** a `SimulationRun` in `WAITING_RESULT`, `USE_CALCULATOR_PIPELINE=true`, and a valid result file in the output folder, **When** the poller processes the run, **Then** exactly one AMQP message is published to exchange `simulation-events` with routing key `simulation.manual.output.fetched`, and none to `model-events`/`timeseries.ingested`.
2. **Given** the same state but with `USE_CALCULATOR_PIPELINE=false` (or unset), **When** the poller processes the run, **Then** exactly one AMQP message is published to exchange `model-events` with routing key `timeseries.ingested`, and none to `simulation-events`/`simulation.manual.output.fetched`. This preserves current production behavior.
3. **Given** an automatic-provider ingestion run finishes, **When** the ingestion command publishes its event, **Then** the destination topic is unaffected by the value of `USE_CALCULATOR_PIPELINE` — the automatic flow always publishes to the original topic.
4. **Given** any successful publish path, **When** the message is inspected on the broker, **Then** the payload contains `simulationId`, `providerName='manual-simulation'`, `seriesCount`, `eventsCount`, and `timeSeries[]`; and the AMQP headers include the correlation identifier so downstream services (and the runbook of teammate 4) can trace the flow.

---

### User Story 2 — Enrich payload with observed-volume series from WISKI CSV (Priority: P1)

**As** the calculator
**I want** the observed-volume series (`v.obs`) inside the input payload
**So that** I can compute the reservoir balance without reading any file myself

**Why this priority**: The calculator will publish `simulation.manual.balance.failed` with `errorType='invalid_payload'` whenever `v.obs` is missing for a configured reservoir. So without this enrichment the pipeline is effectively broken.

**Independent Test**: With `USE_CALCULATOR_PIPELINE=true` and a valid WISKI CSV at the configured SFTP path, run a manual simulation. The published event's `timeSeries[]` array MUST include one entry per reservoir/parameter pair present in `Tagus_FlowCast.csv`, using the same header shape as JSON-derived series (`{ locationId, parameterId, units, stationName, sourceTimezone, ... }`) and events shaped as `{ date, time, value, flag }`.

**Acceptance Scenarios**:

1. **Given** `USE_CALCULATOR_PIPELINE=true` and the WISKI CSV is fetchable from SFTP, **When** the poller processes a manual run, **Then** the published payload's `timeSeries[]` contains **both** the model-output series and the parsed observed-volume series, and the CSV is not persisted anywhere.
2. **Given** the same state but the WISKI CSV cannot be fetched (path missing / SFTP down / decode error), **When** the poller processes the run, **Then** the event is still published (only the model-output series is included), a warning is logged with the `simulationId`, and the run transitions to `COMPLETED` as usual. The calculator will emit `simulation.manual.balance.failed` for the run — that is acceptable and expected.
3. **Given** the WISKI CSV is fetched successfully, **When** its events are parsed, **Then** each row `dd/mm/yyyy;hh:mm:ss;value` is converted to `{ date: 'YYYY-MM-DD', time: 'HH:MM:SS', value: <string>, flag: '2' }` in UTC, applying the source timezone (default `Europe/Madrid`, configurable) to the input timestamps.
4. **Given** the WISKI CSV includes multiple time-series blocks (multiple reservoirs), **When** parsed, **Then** each block becomes an independent `TimeSeriesEntry` with its own header (using `Número de la estación` as `locationId` and `Nombre de la serie temporal` as `parameterId`).

---

### User Story 3 — Feature flag rollback (Priority: P1)

**As** an operator
**I want** to toggle the calculator pipeline off at any time without redeploying
**So that** I can roll back the integration if the calculator is unhealthy

**Why this priority**: Ops safety net for a change that reroutes production traffic between two services.

**Independent Test**: Change `USE_CALCULATOR_PIPELINE` to `false`, restart the process, and confirm the next successful poll publishes to `model-events`/`timeseries.ingested` and not to `simulation-events`/`simulation.manual.output.fetched`.

**Acceptance Scenarios**:

1. **Given** the service is running with `USE_CALCULATOR_PIPELINE=true`, **When** the env var is changed to `false` and the process restarts, **Then** subsequent manual runs publish to the original topic (`model-events`/`timeseries.ingested`) with the original payload shape (no v.obs enrichment).
2. **Given** the env var is unset entirely, **When** the process starts, **Then** the flag evaluates to `false` (safe default) and current production behavior is preserved.

---

### Edge Cases

- **CSV missing but flag ON**: publish without `v.obs`; log warning with `simulationId`; the calculator will fail balance with `invalid_payload` and emit `simulation.manual.balance.failed`.
- **CSV present but malformed** (unreadable encoding, missing headers, non-numeric event values): treat as CSV missing — publish without `v.obs` and log a warning. Do NOT move or delete the CSV. Do NOT fail the simulation run.
- **CSV present but contains no headers we recognize**: log warning, publish without `v.obs`. Same as malformed.
- **CSV row with an invalid date**: skip that single row (log at debug), keep the rest of the block.
- **`v.obs` fetch is slow**: bounded by a per-fetch timeout (default 30 s). Timeout is treated as "CSV missing".
- **Result file malformed** (unchanged from today): SimulationRun goes to `FAILED`, `simulation.status.updated` with `MODEL_FAILED` is published to `simulation-events`. This path is not affected by the flag.
- **Duplicate publish on retry** (unchanged from today): the poller updates the run to `COMPLETED` after publish; a duplicate publish is not guarded against — downstream is expected to be idempotent on `simulationId`.
- **RabbitMQ down at publish time**: same behavior as today — the publish call throws, the run stays in `WAITING_RESULT` and is retried on the next poll cycle (result file is not moved to `historial/` in that path? — this is already the current behavior; not in scope to change).

---

## Requirements *(mandatory)*

### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | The service MUST expose a boolean feature flag `USE_CALCULATOR_PIPELINE` sourced from environment (`USE_CALCULATOR_PIPELINE=true` enables the calculator pipeline, any other value including missing is treated as `false`). | P1 |
| FR-002 | When the flag is enabled AND the run being processed is a manual simulation, the outgoing event MUST be published to exchange `simulation-events` with routing key `simulation.manual.output.fetched`. | P1 |
| FR-003 | When the flag is disabled, the outgoing event MUST be published to exchange `model-events` with routing key `timeseries.ingested` (current behavior). | P1 |
| FR-004 | The service MUST NOT publish to both topics for the same run. Exactly one topic per run. | P1 |
| FR-005 | The payload MUST include `simulationId`, `providerName='manual-simulation'`, `seriesCount`, `eventsCount`, and `timeSeries[]`. | P1 |
| FR-006 | When the flag is enabled, the service MUST attempt to fetch a WISKI CSV from the configured SFTP path (env `VOBS_CSV_SFTP_PATH`) and append the parsed observed-volume series to `timeSeries[]` before publishing. | P1 |
| FR-007 | The WISKI CSV parser MUST convert each `dd/mm/yyyy;hh:mm:ss;value` row to `{ date, time, value, flag='2' }` interpreting the source timezone (env `VOBS_CSV_TIMEZONE`, default `Europe/Madrid`) and rendering the output in UTC. It MUST recognize the WISKI headers `Número de la estación` (→ `locationId`) and `Nombre de la serie temporal` (→ `parameterId`), and support multiple time-series blocks in a single file. | P1 |
| FR-008 | If the WISKI CSV cannot be fetched or parsed, the service MUST still publish the event without the v.obs series and log a warning that includes the `simulationId`. It MUST NOT fail the simulation run for this reason. | P1 |
| FR-009 | The service MUST NOT change the behavior of the automatic-provider ingestion path (`ingestion.commands.ts` and everything invoked from it) regardless of the flag's value. | P1 |
| FR-010 | AMQP headers on the outgoing manual-simulation message MUST include a correlation identifier that carries the `simulationId` so it can be traced by teammate 4's log/runbook queries. | P1 |
| FR-011 | The messaging registry (`messaging.registry.ts`) MUST expose the new routing key `MANUAL_OUTPUT_FETCHED` under the existing `SIMULATION_EVENTS` topic (single source of truth). | P1 |
| FR-012 | Existing unit test `simulation-run-poller.service.spec.ts` case `(b) should publish timeseries.ingested and mark run COMPLETED` MUST still pass unchanged with the flag OFF (or unset). | P1 |
| FR-013 | New unit tests MUST cover: flag ON → publishes to calculator topic; flag OFF → publishes to legacy topic; WISKI CSV missing → publishes without v.obs and logs warning; WISKI CSV valid → publishes with v.obs merged into `timeSeries[]`. | P1 |
| FR-014 | The `/health` endpoint MUST continue to work regardless of the flag's value or the reachability of the WISKI CSV. | P2 |

### Key Entities *(no persistence changes)*

- **SimulationRun** — existing entity, no schema change. The change is limited to what happens after `WAITING_RESULT` transitions to `COMPLETED`.

No database migrations are required. No new tables, columns, or indices.

---

## Success Criteria *(mandatory)*

- [ ] With `USE_CALCULATOR_PIPELINE=false` (or unset), a manual simulation run publishes to `model-events`/`timeseries.ingested` and the payload shape is identical to what is published today.
- [ ] With `USE_CALCULATOR_PIPELINE=true` and a valid WISKI CSV at `VOBS_CSV_SFTP_PATH`, a manual simulation run publishes exactly one AMQP message to `simulation-events`/`simulation.manual.output.fetched`, and the payload's `timeSeries[]` includes both the model-output series and the parsed observed-volume series.
- [ ] With `USE_CALCULATOR_PIPELINE=true` and the WISKI CSV unavailable, the same run still publishes exactly one AMQP message to `simulation-events`/`simulation.manual.output.fetched`, but the payload's `timeSeries[]` contains only the model-output series; a warning is logged with the `simulationId`.
- [ ] Automatic-provider ingestion still publishes to its original topic, regardless of the flag's value.
- [ ] Existing test `(b) should publish timeseries.ingested and mark run COMPLETED when result file is valid` still passes without modification.
- [ ] `/health` is green after the change.
- [ ] `npm run lint && npm run test && npm run test:e2e && npm run build` all pass locally.
- [ ] Rolling back is a matter of setting `USE_CALCULATOR_PIPELINE=false` (or removing the env var) and restarting the process — no code changes required.

---

## Out of Scope

- Persisting the WISKI CSV, its parsed representation, or the observed-volume snapshot in the ms-model-api database.
- Alerting/monitoring on the WISKI fetch failure rate (the observability-runbook teammate owns that).
- Auto-refreshing the config-driven mapping between reservoir IDs and WISKI parameter names (the calculator loads its own config).
- Any change to `ingestion.commands.ts` or the automatic-provider path.
- Retry logic on the calculator side.
- Dual-publish or shadow-publish strategies for progressive rollout.

---

## Assumptions

- The WISKI CSV `Tagus_FlowCast.csv` is delivered to a stable SFTP path that ms-sftp-api can serve via the existing `/files/download` endpoint (the same one the poller already uses for the model output).
- The CSV's canonical timezone is `Europe/Madrid` (with `CET/CEST` DST). This is configurable so ops can override it.
- The CSV format is the "WISKI export" documented in `tajo-volume_calculator/README.md` and implemented in `tajo-volume_calculator/volume_calculator/reservoir_timeseries.py::load_wiski_csv_payload`. The block-per-series structure with header key/value lines followed by `dd/mm/yyyy;hh:mm:ss;value` event rows is the source of truth.
- Downstream consumers (calculator, predictions) are idempotent on `simulationId` — a duplicate publish caused by a crash between publish and DB update is safe.
- Teammate 1's contract is stable: exchange `simulation-events`, routing key `simulation.manual.output.fetched`, queue `calculator-simulation-manual-output`.
