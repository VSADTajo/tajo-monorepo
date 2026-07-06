# Implementation Plan: Calculator Integration — Model Hook

**Feature Branch**: `calculator-integration-model-hook`
**Service**: `ms-model-api` (NestJS 11, hexagonal + CQRS)
**Created**: 2026-07-05
**Companion spec**: `.specify/specs/calculator-integration-model-hook/spec.md`

---

## 1. Architectural summary

The change is scoped to the **infrastructure layer** of `ms-model-api`. No new domain entities, no migrations, no controllers. The manual-simulation output pipeline gets:

1. A new configuration node (`app.useCalculatorPipeline`, `app.vobsCsvSftpPath`, `app.vobsCsvTimezone`, `app.vobsCsvFetchTimeoutMs`) exposed via `AppConfigService`.
2. A new **registry entry** `SIMULATION_EVENTS.routingKeys.MANUAL_OUTPUT_FETCHED` in `messaging.registry.ts`.
3. A new **WISKI CSV parser** utility (pure TypeScript, framework-free) that turns a CSV string into an array of `NormalizedTimeSeriesResult`.
4. A new method on `SimulationResultFetcherService` that fetches and parses the WISKI CSV from SFTP, returning `NormalizedTimeSeriesResult[]` (or `null` on failure).
5. A branch in `SimulationRunPollerService.processSingleRun()` that, when the flag is ON:
   - Attempts to fetch and merge the v.obs series.
   - Publishes to `simulation-events` / `simulation.manual.output.fetched`.
   When the flag is OFF, existing behavior is preserved verbatim.
6. An extension of `IMessageBroker.publishToTopic()` to accept optional AMQP headers (needed to attach `x-simulation-id`). The addition is backwards-compatible (optional parameter, existing calls untouched).

Existing tests keep passing without modification because:
- The flag default is `false`.
- The `IMessageBroker.publishToTopic()` signature change is additive.
- `ingestion.commands.ts` is not touched.

---

## 2. Configuration changes

### 2.1 `src/configuration/app/app-config.type.ts`

Add four fields to `AppConfig`:

```ts
export type AppConfig = {
    // ...existing fields...
    useCalculatorPipeline: boolean;
    vobsCsvSftpPath: string;         // e.g. '/simulations/wiski/Tagus_FlowCast.csv'
    vobsCsvTimezone: string;         // IANA tz, e.g. 'Europe/Madrid'
    vobsCsvFetchTimeoutMs: number;   // e.g. 30_000
};
```

### 2.2 `src/configuration/app/app-config.ts`

Add class-validator decorators + defaults:

```ts
class EnvVariablesValidator {
    // ...existing fields...

    @IsOptional()
    @IsString()
    USE_CALCULATOR_PIPELINE: string;

    @IsOptional()
    @IsString()
    VOBS_CSV_SFTP_PATH: string;

    @IsOptional()
    @IsString()
    VOBS_CSV_TIMEZONE: string;

    @IsOptional()
    @IsInt()
    @Min(0)
    VOBS_CSV_FETCH_TIMEOUT_MS: number;
}

// inside registerAs:
return {
    // ...existing fields...
    useCalculatorPipeline: process.env.USE_CALCULATOR_PIPELINE === 'true',
    vobsCsvSftpPath: process.env.VOBS_CSV_SFTP_PATH || '',
    vobsCsvTimezone: process.env.VOBS_CSV_TIMEZONE || 'Europe/Madrid',
    vobsCsvFetchTimeoutMs: Number(process.env.VOBS_CSV_FETCH_TIMEOUT_MS) || 30_000,
};
```

### 2.3 `src/configuration/app/app-config.service.ts`

Add four getters:

```ts
public get useCalculatorPipeline(): boolean {
    return this.configService.getOrThrow('app.useCalculatorPipeline', { infer: true });
}

public get vobsCsvSftpPath(): string {
    return this.configService.getOrThrow('app.vobsCsvSftpPath', { infer: true });
}

public get vobsCsvTimezone(): string {
    return this.configService.getOrThrow('app.vobsCsvTimezone', { infer: true });
}

public get vobsCsvFetchTimeoutMs(): number {
    return this.configService.getOrThrow('app.vobsCsvFetchTimeoutMs', { infer: true });
}
```

### 2.4 `.env.example`

Append:

```
## Calculator Integration
# Set to 'true' to publish manual-simulation output to the calculator topic
# (simulation.manual.output.fetched) instead of the legacy topic
# (timeseries.ingested). Default: false.
USE_CALCULATOR_PIPELINE=false

# Absolute path (on the SFTP mount served by ms-sftp-api) to the WISKI CSV
# containing the observed reservoir volume series (v.obs). Required only when
# USE_CALCULATOR_PIPELINE=true. Example: /simulations/wiski/Tagus_FlowCast.csv
VOBS_CSV_SFTP_PATH=

# IANA timezone for interpreting timestamps in the WISKI CSV before converting
# them to UTC. Default: Europe/Madrid.
VOBS_CSV_TIMEZONE=Europe/Madrid

# Per-fetch timeout in milliseconds for the WISKI CSV download. Default: 30000.
VOBS_CSV_FETCH_TIMEOUT_MS=30000
```

---

## 3. Messaging registry

### 3.1 `src/app/infrastructure/messaging/messaging.registry.ts`

Add one routing key (no new exchange — reuse `SIMULATION_EVENTS`):

```ts
export const Topics = {
    MODEL_EVENTS: {
        exchange: 'model-events',
        routingKeys: {
            TIMESERIES_INGESTED: 'timeseries.ingested',
        },
    },
    SIMULATION_EVENTS: {
        exchange: 'simulation-events',
        routingKeys: {
            MANUAL_DISPATCHED: 'simulation.manual.dispatched',
            MANUAL_OUTPUT_FETCHED: 'simulation.manual.output.fetched', // NEW
            STATUS_UPDATED: 'simulation.status.updated',
        },
    },
};
```

---

## 4. Message-broker port extension

### 4.1 `src/app/domain/ports/message-broker.port.ts`

Add an **optional** `headers` argument to `publishToTopic` (backwards-compatible — all existing callers pass 3 args and stay green):

```ts
export type AmqpHeaders = Record<string, string | number | boolean>;

export abstract class IMessageBroker {
    abstract publish<T>(queue: string, message: T): Promise<void>;
    abstract publishToTopic<T>(
        exchange: string,
        routingKey: string,
        message: T,
        headers?: AmqpHeaders,
    ): Promise<void>;
    abstract subscribeToTopic<T>(
        exchange: string,
        routingKey: string,
        queue: string,
        handler: MessageHandler<T>,
    ): Promise<void>;
}
```

### 4.2 `src/app/infrastructure/messaging/rabbitmq.service.ts`

Implement the new parameter by merging into the AMQP header map (trace id + custom headers, custom wins for conflicting keys):

```ts
async publishToTopic<T>(
    exchange: string,
    routingKey: string,
    message: T,
    headers?: AmqpHeaders,
): Promise<void> {
    // ...enabled/channel/assert as today...
    const traceId = this.traceContext.traceId;
    const baseHeaders: Record<string, string | number | boolean> = {};
    if (traceId) baseHeaders[X_TRACE_ID_HEADER] = traceId;
    if (headers) Object.assign(baseHeaders, headers);
    const finalHeaders = Object.keys(baseHeaders).length > 0 ? baseHeaders : undefined;

    // ...envelope + publish, passing headers: finalHeaders...
}
```

---

## 5. WISKI CSV parser (new file)

### 5.1 `src/app/infrastructure/services/wiski-csv-parser.ts`

Framework-free, pure function so it can be unit-tested with plain fixtures. Ports the Python logic from `tajo-volume_calculator/volume_calculator/reservoir_timeseries.py` (`load_wiski_csv_payload`, `_parse_wiski_event`, `_parse_wiski_header_line`, `_build_wiski_time_series`) into TypeScript.

**Library choice**: **no external CSV library**. The format is line-oriented, semicolon-delimited events, tab/colon-delimited headers, and the Python reference implementation itself walks lines manually — importing `papaparse` or `csv-parse` for a line loop adds no value. Timezone conversion uses **`date-fns-tz`** (already common in the Node ecosystem, small footprint, tree-shakeable). If a lighter option is preferred, `luxon` or `@date-fns/tz` are acceptable — the tasks step will pin the choice.

Public API:

```ts
import { NormalizedTimeSeriesResult } from '@domain/results/normalized-timeseries.result';

export interface WiskiParseOptions {
    /** IANA timezone the CSV timestamps are expressed in. Default: 'UTC'. */
    sourceTimezone?: string;
}

/** Parse the raw CSV text into normalized time-series entries. */
export function parseWiskiCsv(csvText: string, options?: WiskiParseOptions): NormalizedTimeSeriesResult[];
```

**Recognized WISKI headers** (mirrors the Python `WISKI_HEADER_FIELDS`):

- `Número de la estación` → `locationId`
- `Nombre de la serie temporal` → `parameterId`
- `Nombre de la estación` → `stationName`
- `Unidad de la serie temporal` → `units`
- `LocalX` / `LocalY` / `GlobalX` / `GlobalY` / `Longitud` / `Latitud` — parsed as numbers when possible (lat/lon populate the entity's `lat`/`lon`, others populate `x`/`y`)

**Row format**: `dd/mm/yyyy;hh:mm:ss;value` (semicolon delimited).

**Timezone**: interpret raw timestamp in `options.sourceTimezone` (default `UTC`), then convert to UTC. Emit `{ date: 'YYYY-MM-DD', time: 'HH:MM:SS', ... }` in UTC. `value` is passed through as string with `,` → `.` normalization. `flag` defaults to `'2'` (valid, per calculator convention).

**Missing / invalid**: rows that are neither header (contains `\t` or `:`) nor a valid event (`dd/mm/yyyy;hh:mm:ss;...`) are skipped with a debug log; rows with an invalid date are skipped individually.

**Multiple blocks**: a new header block starts when a new "header line" is seen after an event has been collected. Each block yields one `NormalizedTimeSeriesResult`. The `moduleInstanceId` is set to `wiski_csv` and `timeStep` defaulted to `{ unit: 'hour', multiplier: 1 }` (calculator does not require it for v.obs but the type expects it).

**Encoding**: the SFTP endpoint returns bytes; we decode with `utf-8` first, then fall back to `latin-1` if the first pass throws. That mirrors the Python `WISKI_ENCODINGS`.

### 5.2 Unit tests: `src/app/infrastructure/services/wiski-csv-parser.spec.ts`

Fixtures embedded inline in the spec (no external files under `test/`, since it's a pure unit test near the source):

- Single-block CSV → one `NormalizedTimeSeriesResult` with one event, verifying `locationId`, `parameterId`, and UTC conversion.
- Multi-block CSV → two entries.
- Invalid date row is skipped, valid rows survive.
- Comma decimal `12,34` becomes `'12.34'`.
- `Europe/Madrid` in summer (DST) → offset `+02:00` applied.

---

## 6. `SimulationResultFetcherService` extension

### 6.1 New public method

Add a method that fetches the WISKI CSV from SFTP and returns parsed series. Returns `null` and logs a warning on any failure (network, decode, parse). It NEVER throws — callers keep publishing.

```ts
async fetchVobsSeries(simulationId: string): Promise<NormalizedTimeSeriesResult[] | null> {
    const path = this.appConfigService.vobsCsvSftpPath;
    if (!path) {
        this.logger.warn({ msg: 'VOBS_CSV_SFTP_PATH not configured — skipping v.obs enrichment', entity: 'SimulationResultFetcher', simulationId });
        return null;
    }

    try {
        const baseUrl = this.sftpApiConfigService.baseUrl;
        const timeout = this.appConfigService.vobsCsvFetchTimeoutMs;
        const response = await axios.get(`${baseUrl}/files/download`, {
            params: { path },
            responseType: 'arraybuffer',   // decode ourselves for encoding fallback
            timeout,
            headers: { 'x-internal-caller': 'ms-model-api' },
        });
        const csvText = this.decodeCsvBuffer(response.data as Buffer);
        return parseWiskiCsv(csvText, { sourceTimezone: this.appConfigService.vobsCsvTimezone });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn({
            msg: 'Failed to fetch or parse WISKI CSV — publishing without v.obs enrichment',
            entity: 'SimulationResultFetcher',
            simulationId,
            path,
            error: message,
        });
        return null;
    }
}

private decodeCsvBuffer(buffer: Buffer): string {
    try {
        return buffer.toString('utf-8');
    } catch {
        return buffer.toString('latin1');
    }
}
```

Injected dependencies added: `AppConfigService` (for `vobsCsvSftpPath`, `vobsCsvTimezone`, `vobsCsvFetchTimeoutMs`).

### 6.2 Unit tests: `src/app/infrastructure/services/simulation-result-fetcher.service.spec.ts` (new file)

- Happy path: `axios.get` returns a valid CSV buffer → returns parsed `NormalizedTimeSeriesResult[]`.
- Empty path config → returns `null`, logs warning, does NOT call axios.
- Axios throws (network) → returns `null`, logs warning.
- CSV decode fails (parser throws) → returns `null`, logs warning.

---

## 7. `SimulationRunPollerService` branch

### 7.1 Constructor

Inject `AppConfigService` (or a smaller `CalculatorPipelineConfig` type — the plan uses `AppConfigService` for simplicity).

```ts
constructor(
    @Inject(Logger) private readonly logger: Logger,
    private readonly simulationRunRepository: ISimulationRunRepository,
    private readonly simulationResultFetcherService: SimulationResultFetcherService,
    private readonly messageBroker: IMessageBroker,
    private readonly appConfigService: AppConfigService,
) { /* ...existing setInterval bootstrap... */ }
```

### 7.2 `processSingleRun` publish branch

After the existing `result` fetch, replace the single `publishToTopic` call with a branch:

```ts
const useCalculator = this.appConfigService.useCalculatorPipeline;

let outgoingTimeSeries: NormalizedTimeSeriesResult[] = result.timeSeries;

if (useCalculator) {
    const vobs = await this.simulationResultFetcherService.fetchVobsSeries(run.simulationId);
    if (vobs && vobs.length > 0) {
        outgoingTimeSeries = [...result.timeSeries, ...vobs];
    }
}

const eventsCount = outgoingTimeSeries.reduce((sum, s) => sum + s.events.length, 0);
const payload = {
    simulationId: run.simulationId,
    providerName: 'manual-simulation',
    seriesCount: outgoingTimeSeries.length,
    eventsCount,
    timeSeries: outgoingTimeSeries,
};

if (useCalculator) {
    await this.messageBroker.publishToTopic(
        Topics.SIMULATION_EVENTS.exchange,
        Topics.SIMULATION_EVENTS.routingKeys.MANUAL_OUTPUT_FETCHED,
        payload,
        { 'x-simulation-id': run.simulationId },
    );
} else {
    await this.messageBroker.publishToTopic(
        Topics.MODEL_EVENTS.exchange,
        Topics.MODEL_EVENTS.routingKeys.TIMESERIES_INGESTED,
        payload,
    );
}

run.complete();
await this.simulationRunRepository.update(run);
```

Notes:
- On flag OFF: `outgoingTimeSeries === result.timeSeries` (no allocation, no v.obs fetch call), so the existing test (which asserts `timeSeries` deep equality by reference) still passes.
- The AMQP header `x-simulation-id` is redundant for the calculator (which reads `simulationId` from the body) but valuable for teammate 4's runbook queries and for cross-service log correlation.

### 7.3 Failure path (unchanged)

The `catch` block that publishes `simulation.status.updated` with `MODEL_FAILED` stays exactly as it is today.

### 7.4 Unit-test update: `simulation-run-poller.service.spec.ts`

- Adjust the constructor call in `beforeEach` to inject a mock `AppConfigService` with `useCalculatorPipeline=false` (preserves existing behavior).
- Existing case `(a)` — no change.
- Existing case `(b)` — no change to assertions (still expects `MODEL_EVENTS.TIMESERIES_INGESTED`); the extra optional-headers argument is not passed, so existing `toHaveBeenCalledWith(...)` still matches.
- Existing case `(c)` — no change.
- **New case `(d)`**: flag ON + v.obs fetch returns `null` → publishes to `SIMULATION_EVENTS.MANUAL_OUTPUT_FETCHED` with `x-simulation-id` header; payload contains only the model series.
- **New case `(e)`**: flag ON + v.obs fetch returns a valid series → publishes to the same routing key; payload's `timeSeries` includes both series in that order; `seriesCount` and `eventsCount` reflect the merged content.
- **New case `(f)`**: flag ON + v.obs fetch throws (or returns null due to internal error) → still publishes to the calculator topic (payload w/o v.obs) and logs a warning; no exception propagates.

---

## 8. Module wiring

### 8.1 `infrastructure.module.ts`

- Import `AppConfigModule` (or ensure `AppConfigService` is already provided globally — it is, since `AppConfigModule` uses `ConfigModule.forRoot({ isGlobal: true, ... })` and exports `AppConfigService`). Add `AppConfigModule` to `imports` if not already.
- No provider list changes: the new WISKI parser is a pure function (no `@Injectable()`). `SimulationResultFetcherService` and `SimulationRunPollerService` are already registered.

### 8.2 `application.module.ts`

No changes. Consumers list already includes `SimulationDispatchedConsumerService`.

### 8.3 `main.ts`

No changes. Existing hybrid microservice bootstrap already binds the RabbitMQ transport.

---

## 9. Contracts summary (source of truth)

### 9.1 Outgoing message (flag ON) — matches the calculator's input contract

- **Exchange**: `simulation-events` (topic, durable)
- **Routing key**: `simulation.manual.output.fetched`
- **Queue** (bound by calculator, not by ms-model-api): `calculator-simulation-manual-output`
- **Delivery**: persistent
- **Headers**:
  - `x-trace-id`: from `TraceContext` (existing behavior)
  - `x-simulation-id`: `<simulationId>` (new)
- **Body**:
```json
{
  "simulationId": "<uuid>",
  "providerName": "manual-simulation",
  "seriesCount": <int>,
  "eventsCount": <int>,
  "timeSeries": [
    {
      "header": { "locationId": "...", "parameterId": "...", "stationName": "...", "units": "...", "moduleInstanceId": "...", "timeStep": { "unit": "...", "multiplier": <int> }, "forecastDate": "...", "startDate": "...", "endDate": "...", "sourceTimezone": "UTC", ... },
      "events": [ { "date": "YYYY-MM-DD", "time": "HH:MM:SS", "value": "<string>", "flag": "2" }, ... ]
    },
    ...
  ]
}
```

The `NormalizedTimeSeriesResult` shape ms-model-api emits today is compatible with `SimulationOutputPayload.timeSeries[]` in the calculator (validated against `TimeSeriesEntry` with `model_config = ConfigDict(extra="allow")`, so extra fields like `moduleInstanceId`/`stationName`/`lat`/`lon`/`x`/`y`/`z`/`forecastDate`/`startDate`/`endDate` are tolerated).

### 9.2 Outgoing message (flag OFF) — unchanged from today

- **Exchange**: `model-events`
- **Routing key**: `timeseries.ingested`
- **Headers**: `x-trace-id` only
- **Body**: same as above, minus the v.obs series (payload is byte-for-byte compatible with today's messages).

### 9.3 Failure path (unchanged)

- **Exchange**: `simulation-events`
- **Routing key**: `simulation.status.updated`
- **Body**: `{ simulationId, status: 'MODEL_FAILED' }`

---

## 10. Testing strategy

### 10.1 Unit tests (Jest, no Docker)

- `wiski-csv-parser.spec.ts` — pure function, embedded fixture strings, checks parsing, timezone conversion, multi-block, error skipping.
- `simulation-result-fetcher.service.spec.ts` — mocks `axios` and `AppConfigService`, verifies happy path and all "return null" paths.
- `simulation-run-poller.service.spec.ts` — extended with mock `AppConfigService`; new cases `(d)`, `(e)`, `(f)` for the flag-ON branch.

### 10.2 Integration / e2e (Testcontainers, per `.claude/rules/05-testing.md`)

**Location**: `test/modules/simulation-run/calculator-integration.e2e-spec.ts`.

**Setup** (following existing e2e patterns in `test/modules/simulation-run/`):
- Compose a NestJS test app via `createTestApp({...})` with:
  - Entities: `[SimulationRun, ProviderConfig, IngestionRun]` (or whatever the existing simulation-run e2e uses).
  - Providers: real `SimulationRunPollerService`, real `SimulationResultFetcherService`, mocked `IMessageBroker` (a spy), mocked `AppConfigService` variant per test.
- Testcontainer Postgres bootstrapped as usual.
- Mock the SFTP HTTP layer: intercept `axios.get(/files)` and `axios.get(/files/download)` with `axios-mock-adapter` (or a similar in-process mock; whichever is already used in existing SFTP e2e specs — check `test/modules/provider-config/` for the current pattern before writing).

**Test cases**:
- `should publish to legacy topic when flag is OFF and v.obs is not fetched` — creates a `SimulationRun` in `WAITING_RESULT`, seeds a mock JSON result file, calls `service.pollOnce()`, asserts one call to `messageBroker.publishToTopic('model-events', 'timeseries.ingested', payload)` and zero calls to the calculator topic; the axios mock never receives a request for `VOBS_CSV_SFTP_PATH`.
- `should publish to calculator topic with merged v.obs when flag is ON and CSV is valid` — same setup, with `useCalculatorPipeline=true` and a mocked WISKI CSV response; asserts one call to `publishToTopic('simulation-events', 'simulation.manual.output.fetched', payloadWithVobs, { 'x-simulation-id': ... })`.
- `should publish to calculator topic without v.obs when CSV fetch fails` — as above, but the SFTP download mock throws; asserts the same publish call minus the v.obs series and a warning log entry with the `simulationId`.
- `should NOT affect automatic-provider ingestion path` — trigger the existing ingestion command path (or assert via a smoke test that the `ingestion.commands.ts` publish target is unchanged when the flag is toggled). Optionally, this can be verified as a unit assertion at the command handler level rather than through e2e — decision deferred to the tasks step.

### 10.3 Non-regressions

- `npm run test` — all existing suites green.
- `npm run test:e2e` — existing SFTP / dispatched-consumer / poller e2e specs unchanged.
- `npm run lint`, `npm run build` — pass.

---

## 11. Rollout & rollback

### 11.1 Rollout

1. Merge PR with `USE_CALCULATOR_PIPELINE=false` on the VM's `/opt/infra/infra/.env`.
2. Redeploy ms-model-api (Jenkins pipeline).
3. Verify `/health` and confirm existing manual flows still hit `timeseries.ingested`.
4. Set `USE_CALCULATOR_PIPELINE=true` and `VOBS_CSV_SFTP_PATH=/simulations/wiski/Tagus_FlowCast.csv` (or the ops-agreed path) on the VM.
5. Restart the ms-model-api container (`docker compose restart ms-model-api`).
6. Trigger a manual simulation and watch RabbitMQ management UI: message should land on queue `calculator-simulation-manual-output`.

### 11.2 Rollback

- `USE_CALCULATOR_PIPELINE=false` in `.env` on the VM.
- Restart the container.
- Confirmed rollback: next manual run publishes to `model-events`/`timeseries.ingested`.
- No data migration or schema change to revert.

---

## 12. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| WISKI CSV parser diverges from the Python reference | Port unit-by-unit with the Python source as the spec; unit tests use realistic fixtures derived from the calculator's own test data if available. |
| Timezone conversion off by one hour | Explicit DST tests in `wiski-csv-parser.spec.ts` (winter + summer) with `Europe/Madrid`. |
| Adding optional headers to `IMessageBroker` breaks other services in the monorepo | The change is inside `ms-model-api` only. Other services carry their own copy of `IMessageBroker` (per-service hexagonal). Verified: no shared library exports this port. |
| WISKI CSV very large — pulling the whole file per poll cycle | Bounded by the poll interval (default 5 min) and the fetch timeout. If it becomes a problem, we can add a modification-time cache (out of scope). |
| Downstream idempotency assumption is wrong | Documented in the spec's Assumptions section. Teammate 3 owns idempotency in predictions; teammate 1 owns it in the calculator. |
| Existing test `(b)` breaks due to the constructor signature change | Update the test's `beforeEach` to construct with the mocked `AppConfigService`; the assertions on `publishToTopic` remain unchanged. This is a mechanical adjustment, not a behavior change. |

---

## 13. Deferred to `/speckit-tasks`

- Exact library choice for timezone conversion (`date-fns-tz` vs `luxon` vs a hand-rolled TZ table — the tasks step will pick one and check the monorepo for prior art).
- Exact e2e file placement and whether the automatic-path non-regression is asserted at the unit or e2e level.
- Whether to add a Testcontainer-level RabbitMQ (currently mocked via `IMessageBroker`), or keep the broker mocked at the port boundary (per `.claude/rules/05-testing.md`, mocking at the port boundary is preferred — sticking with that).
- Where inline WISKI CSV fixtures should live (embedded in the `.spec.ts` file vs a `test/fixtures/` folder).
