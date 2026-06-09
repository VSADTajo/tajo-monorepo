# Quickstart: Data Provider Layer

**Feature**: 002-data-provider-layer

## Prerequisites

- Node.js >= 22 (check `.nvmrc`)
- Docker running (for PostgreSQL, Redis, RabbitMQ)
- ms-sftp-api running (if testing SFTP_FILE provider)

## Setup

```bash
# Install new dependencies
npm install @nestjs/schedule

# Copy env and configure
cp .env.example .env
# Add to .env:
# FEWS_API_BASE_URL=https://your-fews-server/rest/fewspiservice/v1
# SFTP_API_BASE_URL=http://ms-sftp-api:3003

# Run migrations
npm run migration:run

# Start dev
npm run start:dev
```

## New Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `FEWS_API_BASE_URL` | (none) | Default FEWS REST API base URL |
| `SFTP_API_BASE_URL` | `http://localhost:3003` | ms-sftp-api REST API base URL |

## Quick Test

```bash
# 1. Create a FEWS API provider
curl -X POST http://localhost:3000/provider-configs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "FEWS Test",
    "type": "FEWS_API",
    "baseUrl": "https://fews.example.com/rest/fewspiservice/v1",
    "pollingIntervalMinutes": 60,
    "settings": {
      "filterId": "NAM_EPS",
      "locationIds": ["AR01"],
      "parameterIds": ["Q.NAM.ens.Med"],
      "documentFormat": "PI_JSON"
    }
  }'

# 2. Activate it
curl -X PATCH http://localhost:3000/provider-configs/{id}/toggle

# 3. Trigger manual ingestion
curl -X POST http://localhost:3000/provider-configs/{id}/trigger

# 4. Check ingestion run status
curl http://localhost:3000/ingestion-runs?providerConfigId={id}
```

## Key Files

| Purpose | File |
|---------|------|
| Provider Config CRUD | `src/app/api/controllers/provider-config.controller.ts` |
| Ingestion Runs | `src/app/api/controllers/ingestion-run.controller.ts` |
| FEWS API Provider | `src/app/infrastructure/services/fews-api-provider.service.ts` |
| SFTP File Provider | `src/app/infrastructure/services/sftp-file-provider.service.ts` |
| Scheduler | `src/app/infrastructure/services/provider-scheduler.service.ts` |
| Migration | `src/migrations/XXXX-add-provider-configs-and-ingestion-runs.ts` |

## Architecture Flow

```
HTTP Request → Controller → CommandBus → Handler → IDataProvider (port)
                                                          ↓
                                           DataProviderFactory.getProvider(type)
                                                          ↓
                                    ┌─────────────────────┼─────────────────────┐
                                    ↓                                           ↓
                          FewsApiProvider                              SftpFileProvider
                          (axios → FEWS API)                          (axios → ms-sftp-api)
                                    ↓                                           ↓
                          PI-JSON response                            Pre-parsed JSON response
                                    ↓                                           ↓
                          Map to NormalizedTimeSeries[]               Map to NormalizedTimeSeries[]
                                    ↓                                           ↓
                                    └───────────────────┬───────────────────────┘
                                                        ↓
                                              Publish to RabbitMQ
                                              (topic: model-events,
                                               key: timeseries.ingested)
                                                        ↓
                                              predictions-api consumes
```
