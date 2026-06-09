# Research: Data Provider Layer

**Feature**: 002-data-provider-layer
**Date**: 2026-03-11

## R1: PI-XML/CSV Parsing Strategy

**Decision**: Delegate parsing to ms-sftp-api — model-api receives pre-parsed JSON
**Rationale**: ms-sftp-api already has a parsing/mapping engine built in. Instead of duplicating XML/CSV parsing in model-api, ms-sftp-api returns pre-parsed JSON via its REST API. Model-api only maps the JSON response to `NormalizedTimeSeries[]`. This reduces dependencies (no `fast-xml-parser` needed) and centralizes parsing logic in one service. For the FEWS API path, the API itself returns PI-JSON natively (`documentFormat=PI_JSON`), so no XML parsing is needed there either.
**Alternatives considered**:
- `fast-xml-parser` in model-api: Would work but duplicates parsing logic already in ms-sftp-api.
- Both: Keep `fast-xml-parser` as optional fallback — unnecessary complexity given ms-sftp-api handles all file formats.

## R2: CRON Scheduling Strategy

**Decision**: `@nestjs/schedule` with dynamic intervals via `SchedulerRegistry`
**Rationale**: Already in the boilerplate dependencies. `SchedulerRegistry` allows adding/removing CronJobs dynamically at runtime — essential since each provider has its own polling interval configured in the database. On startup, the scheduler loads all active providers and registers their intervals. On provider update/toggle, the corresponding job is added/removed.
**Alternatives considered**:
- Fixed cron expressions: Too rigid — each provider needs its own interval.
- Bull/BullMQ: Overkill for simple polling. Adds Redis queue dependency for a job that's just "call fetch()".
- `node-cron`: Works but doesn't integrate with NestJS DI/lifecycle.

**Implementation pattern**:
```typescript
@Injectable()
export class ProviderSchedulerService implements OnModuleInit {
    constructor(
        private schedulerRegistry: SchedulerRegistry,
        private providerConfigRepo: IProviderConfigRepository,
        private commandBus: CommandBus,
    ) {}

    async onModuleInit() {
        const activeProviders = await this.providerConfigRepo.findActive();
        for (const provider of activeProviders) {
            this.registerJob(provider);
        }
    }

    registerJob(config: ProviderConfig) {
        const interval = setInterval(() => {
            this.commandBus.execute(new ExecuteIngestionCommand({ providerConfigId: config.id }));
        }, config.pollingIntervalMinutes * 60 * 1000);
        this.schedulerRegistry.addInterval(`provider-${config.id}`, interval);
    }

    removeJob(configId: string) {
        const key = `provider-${configId}`;
        if (this.schedulerRegistry.doesExist('interval', key)) {
            this.schedulerRegistry.deleteInterval(key);
        }
    }
}
```

## R3: Data Provider Factory Pattern

**Decision**: Factory service with injected provider map, resolved by ProviderType enum
**Rationale**: The constitution mandates dependency inversion via ports. `IDataProvider` is the abstract class. `FewsApiProviderService` and `SftpFileProviderService` are implementations. A `DataProviderFactoryService` resolves the correct implementation based on `ProviderType`. This keeps the ingestion command handler decoupled from specific provider implementations.
**Alternatives considered**:
- Strategy pattern with NestJS `ModuleRef`: More dynamic but harder to test.
- Switch statement in command handler: Violates open/closed principle.
- NestJS custom provider with factory: Works but less explicit than a dedicated factory service.

**Implementation pattern**:
```typescript
@Injectable()
export class DataProviderFactoryService {
    constructor(
        private readonly fewsProvider: FewsApiProviderService,
        private readonly sftpProvider: SftpFileProviderService,
    ) {}

    getProvider(type: ProviderType): IDataProvider {
        switch (type) {
            case ProviderType.FEWS_API: return this.fewsProvider;
            case ProviderType.SFTP_FILE: return this.sftpProvider;
            default: throw new ApiError(HttpStatus.BAD_REQUEST, `Unknown provider type: ${type}`);
        }
    }
}
```

## R4: FEWS PI-JSON Format

**Decision**: Request PI-JSON from FEWS API (`documentFormat=PI_JSON`) instead of PI-XML
**Rationale**: The FEWS REST API supports `documentFormat=PI_JSON` which returns the same data structure as PI-XML but in JSON. This avoids XML parsing overhead for the API path. The PI-JSON structure mirrors PI-XML:
```json
{
    "version": "1.34",
    "timeZone": "0.0",
    "timeSeries": [{
        "header": {
            "type": "instantaneous",
            "moduleInstanceId": "EnsembleStat_EPS_NAM_Alt",
            "locationId": "AR01",
            "parameterId": "Q.NAM.ens.Med",
            "timeStep": { "unit": "second", "multiplier": 900 },
            "startDate": { "date": "2026-01-29", "time": "01:00:00" },
            "endDate": { "date": "2026-02-04", "time": "01:00:00" },
            "forecastDate": { "date": "2026-01-29", "time": "00:00:00" },
            "missVal": -999.0,
            "stationName": "AR01 GALLO EN PEÑAMEDIODIA",
            "lat": 40.826895,
            "lon": -1.987333,
            "units": "m3/s"
        },
        "events": [
            { "date": "2026-01-29", "time": "01:00:00", "value": 9.17, "flag": 0 }
        ]
    }]
}
```
**Alternatives considered**:
- PI-XML only: Would require XML parsing for API calls. Unnecessary overhead.
- Both formats with auto-detect: Over-engineered. FEWS API always supports PI-JSON.

## R5: SFTP File Provider via ms-sftp-api (Pre-parsed JSON)

**Decision**: Call ms-sftp-api REST endpoints that return pre-parsed JSON data
**Rationale**: ms-sftp-api already has a built-in parsing/mapping engine that handles PI-XML and CSV files. Instead of downloading raw files and parsing them in model-api, we call ms-sftp-api endpoints that return the data already parsed as JSON. Model-api's `SftpFileProviderService` only needs to map the JSON response to `NormalizedTimeSeries[]` — no XML/CSV parsing needed.

**Integration flow**:
1. model-api calls ms-sftp-api with file path/pattern
2. ms-sftp-api fetches the file from SFTP, parses it (XML/CSV), and returns JSON
3. model-api maps the JSON to `NormalizedTimeSeries[]`

**Alternatives considered**:
- Download raw files and parse in model-api: Duplicates parsing logic already in ms-sftp-api.
- Direct SFTP connection from model-api: Duplicates SFTP connection logic, violates single responsibility.

## R6: Concurrency Guard for Ingestion Runs

**Decision**: In-memory Set of running provider IDs + IngestionRun status check
**Rationale**: Before starting an ingestion, check if there's already an in-progress run for the same provider. Use an in-memory `Set<string>` of currently-running provider IDs (cleared on completion/failure). This is simpler than distributed locks and sufficient since ms-model-api runs as a single instance.
**Alternatives considered**:
- Database-level lock (SELECT FOR UPDATE): Overkill for single instance.
- Redis distributed lock: Unnecessary complexity for single-instance deployment.
- Bull queue with concurrency=1 per provider: Good for multi-instance but adds Bull dependency.

## R7: Normalized TimeSeries Format (RabbitMQ Message Schema)

**Decision**: Publish one message per ingestion run containing all series
**Rationale**: Each ingestion run produces a batch of normalized time series. Publishing them as a single message keeps the downstream consumer (predictions-api) simple — it receives one message per forecast and can process/persist atomically.

**Message schema**:
```typescript
interface TimeSeriesIngestedEvent {
    providerConfigId: string;
    providerType: 'FEWS_API' | 'SFTP_FILE';
    ingestionRunId: string;
    forecastDate: string;              // ISO date of the model run
    ingestedAt: string;                // ISO timestamp
    series: NormalizedTimeSeries[];
}

interface NormalizedTimeSeries {
    locationId: string;
    parameterId: string;
    moduleInstanceId: string;
    stationName: string;
    lat: number;
    lon: number;
    x?: number;
    y?: number;
    z?: number;
    units: string;
    timeStep: { unit: string; multiplier: number };
    forecastDate: string;
    startDate: string;
    endDate: string;
    events: TimeSeriesEvent[];
}

interface TimeSeriesEvent {
    timestamp: string;                 // ISO datetime (date + time combined)
    value: number;
    flag: number;
    isMissing: boolean;                // true if value equals missVal or flag indicates missing
}
```

## R8: Configuration Modules for External Services

**Decision**: Two new config modules following the existing `registerAs` pattern
**Rationale**: Following the established boilerplate pattern, each external service gets its own config module:
- `configuration/fews-api/` — `FEWS_API_BASE_URL` (default URL for FEWS, can be overridden per provider config)
- `configuration/sftp-api/` — `SFTP_API_BASE_URL` (URL of ms-sftp-api, e.g., `http://ms-sftp-api:3003`)

These provide default base URLs. Individual ProviderConfig entities can override the base URL for specific providers.
**Alternatives considered**:
- Single config module: Less clean separation.
- No config module (only in DB): Would make local dev harder without a configured provider.
