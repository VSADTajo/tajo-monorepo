# Quickstart: CSV File Provider

## Setup

No new environment variables required. The CSV provider reuses the existing `SFTP_API_BASE_URL` configuration.

## Configuration

After deploying the updated code, create a provider configuration:

```bash
curl -X POST http://ms-model-api:3008/provider-configs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "FlowCast Observados",
    "type": "CSV_FILE",
    "baseUrl": "http://ms-sftp-api:3003",
    "pollingIntervalMinutes": 360,
    "isActive": true,
    "settings": {
      "filePath": "/path/to/csv/directory",
      "filePrefix": "Tagus_FlowCast"
    }
  }'
```

## Manual Trigger

```bash
curl -X POST http://ms-model-api:3008/provider-configs/{id}/trigger
```

## Verification

After ingestion, check historical data in ms-predictions-api:

```bash
curl http://ms-predictions-api:3007/predictions/historical/AR35
```

## File Format Reference

Each CSV block:
```
Station Site:	ALAGON
Station Name:	ALAGON EN GARCIBUEY
Station Number:	AR35
LocalX:	250221.21
LocalY:	4487646.9
Datum:	---
Parameter Name:	Caudal Rio
Parameter Type:	Q
Parameter Type Name:	Caudal
Time series Name:	FICT98.Validado
Time series Unit:	m3/s
GlobalX:	250221.21
GlobalY:	4487646.9
Longitude:	-5.947684
Latitude:	40.501957
07/04/2026;18:45:00;2.076
07/04/2026;19:00:00;2.076
...
```
