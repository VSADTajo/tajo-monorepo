# Simulation results endpoint — quickstart para el frontend

Cómo pedir los resultados de una simulación manual desde el frontend, vía **`ms-gateway-api`**.

## Endpoint

```
GET  {GATEWAY_BASE_URL}/simulations/manual/{simulationId}/results
```

- **Local dev**: `http://localhost:3000`
- **Auth**: Bearer JWT (mismo token que el resto de endpoints del gateway).
- `simulationId` debe ser un UUID v4. La respuesta refleja el estado actual — si la simulación todavía está procesando, `predictions` viene vacío.

## Ejemplo mínimo (curl)

```bash
SIM_ID="7f2a8b3c-9d1e-4f5a-b6c7-8d9e0f1a2b3c"
TOKEN="eyJhbGciOi..."   # JWT del usuario autenticado

curl -sS "http://localhost:3000/simulations/manual/${SIM_ID}/results" \
     -H "Authorization: Bearer ${TOKEN}" \
     -H "Accept: application/json" | jq .
```

## Ejemplo con `ky` (frontend)

`vsad-tajo-frontend` ya usa `ky`. Podés agregar el método al service existente `src/services/predictions.ts` (o similar):

```ts
import ky from 'ky';

export interface PredictionResultPoint {
  date: string;    // ISO-8601 UTC
  value: number;
  flag: number;
}

export interface SimulationResultsPrediction {
  id: string;
  stationId: string;
  stationName: string | null;
  predictionTypeId: string;
  predictionTypeName: string | null;
  predictionTypeUnit: string | null;
  percentile: number | null;
  predictionProvider: string | null;
  predictedBy: string | null;
  predictionDate: string | null;
  predictionStartDate: string | null;
  predictionEndDate: string | null;
  results: PredictionResultPoint[];
}

export interface SimulationResultsIdentity {
  id: string;
  simulationDate: string;                                        // 'YYYYMMDDHHMMSS'
  status: 'CREATED' | 'MODEL_PROCESSING' | 'IN_PROGRESS'
        | 'FINALIZED' | 'MODEL_FAILED';
  type: 'MANUAL';
  dataOrigin: 'HISTORICAL' | 'FORECAST' | null;
  createdAt: string;
  updatedAt: string;
}

export interface GetSimulationResultsResponse {
  simulation: SimulationResultsIdentity;
  predictions: SimulationResultsPrediction[];
}

export async function getManualSimulationResults(
  simulationId: string,
): Promise<GetSimulationResultsResponse> {
  return ky
    .get(`simulations/manual/${simulationId}/results`, { prefixUrl: GATEWAY_BASE_URL })
    .json<GetSimulationResultsResponse>();
}
```

`ky` ya adjunta el Bearer token si está configurado en el instance global (mismo patrón que el resto de calls al gateway).

## Ejemplo de respuesta (200 OK)

```json
{
  "simulation": {
    "id": "7f2a8b3c-9d1e-4f5a-b6c7-8d9e0f1a2b3c",
    "simulationDate": "20260619120000",
    "status": "FINALIZED",
    "type": "MANUAL",
    "dataOrigin": "FORECAST",
    "createdAt": "2026-06-19T12:00:00.000Z",
    "updatedAt": "2026-06-19T13:45:12.000Z"
  },
  "predictions": [
    {
      "id": "3f9d1e2b-6c47-4a8b-9c1d-2e3f4a5b6c7d",
      "stationId": "AR35",
      "stationName": "Embalse de Arévalo",
      "predictionTypeId": "a1b2c3d4-e5f6-7890-abcd-ef0123456789",
      "predictionTypeName": "Q.NAM.forecast",
      "predictionTypeUnit": "m3/s",
      "percentile": null,
      "predictionProvider": "aemet",
      "predictedBy": "harmonie-2026-06-19",
      "predictionDate": "2026-06-19T00:00:00.000Z",
      "predictionStartDate": "2026-06-19T00:00:00.000Z",
      "predictionEndDate": "2026-06-22T00:00:00.000Z",
      "results": [
        { "date": "2026-06-19T00:00:00.000Z", "value": 123.4, "flag": 0 },
        { "date": "2026-06-19T01:00:00.000Z", "value": 121.9, "flag": 0 },
        { "date": "2026-06-19T02:00:00.000Z", "value": 118.6, "flag": 0 }
      ]
    },
    {
      "id": "4a2c9d3e-7b58-4f5a-9d0c-1e2f3a4b5c6d",
      "stationId": "AR35",
      "stationName": "Embalse de Arévalo",
      "predictionTypeId": "b2c3d4e5-f6a7-8901-bcde-f01234567890",
      "predictionTypeName": "P.ens.forecast",
      "predictionTypeUnit": "mm",
      "percentile": 50,
      "predictionProvider": "aemet",
      "predictedBy": "ensemble-2026-06-19",
      "predictionDate": "2026-06-19T00:00:00.000Z",
      "predictionStartDate": "2026-06-19T00:00:00.000Z",
      "predictionEndDate": "2026-06-22T00:00:00.000Z",
      "results": [
        { "date": "2026-06-19T00:00:00.000Z", "value": 0.2, "flag": 0 },
        { "date": "2026-06-19T01:00:00.000Z", "value": 0.0, "flag": 0 }
      ]
    }
  ]
}
```

### Contrato de ordenamiento (importante para charts)

- `predictions[]` ordenado ascendente por `(stationId, predictionTypeId)`.
- Cada `predictions[i].results[]` ordenado ascendente por `date`.

No hace falta que el frontend re-ordene.

## Estados "vacíos" que hay que renderizar

| Situación | Body |
|-----------|------|
| Simulación creada pero el modelo todavía no corrió | `simulation.status = "CREATED"` o `"MODEL_PROCESSING"` o `"IN_PROGRESS"`, `predictions = []` |
| El modelo falló | `simulation.status = "MODEL_FAILED"`, `predictions = []` |
| Simulación finalizada con resultados | `simulation.status = "FINALIZED"`, `predictions` no vacío |

## Errores

```jsonc
// 400 Bad Request — path no es UUID
{ "StatusCode": 400, "ErrorCode": "TR999", "ErrorDescription": "Invalid simulation id" }

// 404 Not Found — sim no existe, está soft-deleted, o su type no es MANUAL
{ "StatusCode": 404, "ErrorCode": "TR999", "ErrorDescription": "Manual simulation with id \"…\" not found" }

// 401 Unauthorized — Bearer token inválido o ausente (mismo comportamiento del gateway)
```

## Notas

- El payload puede ser grande si la simulación cubre varios días y muchas estaciones. Para MVP no hay paginación; si en producción vemos payloads > ~5 MB, sumamos filtros/paginación en un follow-up.
- Los timestamps siempre vienen en UTC (`…Z`).
- `simulationDate` es un string `YYYYMMDDHHMMSS` (formato legacy del pipeline manual), NO un ISO — usalo solo como identificador de "corrida", no como fecha para parsear directo. Si querés timeline de inicio/fin, mirá `predictionStartDate` / `predictionEndDate` en cada `predictions[i]`.
- Swagger UI vivo: `{GATEWAY_BASE_URL}/docs` → buscar el tag **Predictions** → **GET /simulations/manual/{id}/results**. La sección "Example Value" muestra el mismo JSON de arriba, listo para copiar.
