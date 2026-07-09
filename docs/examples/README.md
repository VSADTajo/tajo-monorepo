# Provider output — reference examples

Este directorio contiene ejemplos del contrato de archivos que el **proveedor externo del modelo hidrológico** (HARMONIE + EPS) tiene que depositar en el SFTP para que el flujo de simulación manual complete su ciclo.

## Archivos

- [`simulation-output-example.json`](./simulation-output-example.json) — resultado sintético para una simulación de 24 horas sobre 2 embalses (E_08, E_09), con las 8 series requeridas por embalse.

## Contexto del flujo (dónde encaja este archivo)

```
1. Usuario del backoffice → POST /simulations/manual
2. ms-predictions-api      → sube 2 JSONs de input a SFTP:
                             tajo/SIMULATIONS/{simulationId}/input/tagus_harmonie_Q_*.json
                             tajo/SIMULATIONS/{simulationId}/input/tagus_eps_Q_*.json
3. [Proveedor externo]     → SE CONECTA POR SFTP, LEE input/, corre modelo hidrológico
4. [Proveedor externo]     → DEPOSITA el resultado en:
                             tajo/SIMULATIONS/{simulationId}/output/<lo-que-sea>.json   ← ESTE ARCHIVO
5. ms-model-api            → detecta el archivo, lo publica al calculator
6. ms-calculator-api       → computa v.balance para cada embalse
7. ms-predictions-api      → persiste + auto-finaliza la simulación
```

**El único step que el proveedor tiene que implementar es el 4**: depositar un JSON válido en el output folder.

## Credenciales de acceso SFTP para el proveedor

| Item | Valor |
|---|---|
| Host | `65.21.97.113` |
| Puerto | `8212` |
| Usuario | `tajosftp` |
| Password / SSH key | (coordinar con el equipo de infraestructura de VSAD Tajo) |
| Root directory tras login | `tajo/` |
| Ruta de trabajo | `tajo/SIMULATIONS/{simulationId}/` |

El proveedor puede polear el directorio `tajo/SIMULATIONS/` para detectar nuevas simulaciones a procesar (cada subfolder cuyo `output/` esté vacío).

## Cómo listar y descargar inputs (ejemplo)

```bash
# Con OpenSSH sftp CLI
sftp -P 8212 tajosftp@65.21.97.113

sftp> ls SIMULATIONS/                           # ver todas las simulaciones
sftp> ls SIMULATIONS/<simulationId>/input/     # ver los 2 JSONs de input
sftp> get SIMULATIONS/<simulationId>/input/tagus_harmonie_Q_*.json
sftp> get SIMULATIONS/<simulationId>/input/tagus_eps_Q_*.json
```

## Cómo depositar el resultado

```bash
# Cuando el modelo terminó de correr:
sftp> put result.json SIMULATIONS/<simulationId>/output/result.json
```

**Nombre del archivo**: cualquiera con extensión `.json`. `ms-model-api` toma el primer archivo `.json` que encuentra en `output/`.

**Después del procesamiento exitoso**, `ms-model-api` mueve el archivo a `SIMULATIONS/{simulationId}/output/historial/`. Si el archivo es malformado, va a `.../output/corrupted/`.

## Contrato del JSON

Ver [`simulation-output-example.json`](./simulation-output-example.json) — es un ejemplo real, con todas las series necesarias para 2 embalses.

### Estructura general

```json
{
  "version": "1.34",
  "timeZone": "0.0",
  "timeSeries": [ /* array de series, una por (embalse × parameterId) */ ]
}
```

### Cada entry del array `timeSeries`

```json
{
  "header": {
    "locationId": "E_08",                    // ID del embalse (E_01..E_09)
    "parameterId": "VICT01.Validado",        // ID del parámetro — ver tabla abajo
    "moduleInstanceId": "provider_model",    // Libre — identifica el modelo del proveedor
    "stationName": "E_08",                   // Human-readable
    "missVal": "-999.0",                     // Valor centinela para faltantes
    "units": "hm3",                          // o "m3/s" según el parámetro
    "timeStep": { "unit": "hour", "multiplier": "1" },
    "forecastDate": { "date": "2026-07-09", "time": "06:00:00" },
    "startDate":    { "date": "2026-07-09", "time": "06:00:00" },
    "endDate":      { "date": "2026-07-10", "time": "05:00:00" },
    "lat": "39.5", "lon": "-5.0",            // opcionales
    "x": "0", "y": "0", "z": "0"             // opcionales
  },
  "events": [
    { "date": "2026-07-09", "time": "06:00:00", "value": "22.552", "flag": "2" },
    { "date": "2026-07-09", "time": "07:00:00", "value": "22.553", "flag": "2" }
    /* ...un event por punto temporal... */
  ]
}
```

### Series **obligatorias** por embalse

Para que la calculadora pueda computar el balance de volumen (`v.balance`), el proveedor debe emitir **estas 8 series por cada embalse**:

| Family | `parameterId` esperado (según `reservoir_parameters.json`) | Units | Uso |
|---|---|---|---|
| **`v.obs`** — Volumen observado inicial (en t0) | `VICT01.Validado` | `hm3` | Punto de partida del balance |
| **`q.out.for`** — Caudal de salida previsto | `Q.salida.forecast` | `m3/s` | Se integra a hm³ acumulado |
| **`q.in.for.harmonie`** — Caudal de entrada modelo determinista | `I.mk11.forecast` | `m3/s` | Se integra a hm³ acumulado |
| **`q.in.for.eps.10`** — Percentil EPS 10 | `I.mk11.EPS10forecast` | `m3/s` | Percentil probabilístico |
| **`q.in.for.eps.25`** | `I.mk11.EPS25forecast` | `m3/s` | Percentil probabilístico |
| **`q.in.for.eps.50`** — Mediana | `I.mk11.EPSforecast` | `m3/s` | Percentil probabilístico |
| **`q.in.for.eps.75`** | `I.mk11.EPS75forecast` | `m3/s` | Percentil probabilístico |
| **`q.in.for.eps.90`** | `I.mk11.EPS90forecast` | `m3/s` | Percentil probabilístico |

**Total = 8 series × N embalses**. En el ejemplo, N=2 → 16 series.

Los `parameterId` deben coincidir exactamente con los definidos en [`ms-calculator-api/src/config/reservoir_parameters.json`](../../ms-calculator-api/src/config/reservoir_parameters.json). Actualmente **todos los embalses usan el mismo mapping** (por ej. `v.obs = "VICT01.Validado"` para E_01, E_02, ..., E_09). Si el proveedor tiene otros IDs, coordinar con el equipo de calculator para actualizar el config.

### Formato de valores

- **`value`**: número decimal como **string**. Ejemplo `"22.552"` o `"0.1500"`.
- **`flag`**: `"2"` = valor válido, `"8"` = faltante. Si un valor es faltante, ponés `value` igual a `missVal` (ej. `"-999.0"`) y `flag: "8"`.
- **`date` / `time`**: strings `YYYY-MM-DD` y `HH:MM:SS`. **Todo en UTC**. Cuidado: `24:00:00` no es válido — usar `00:00:00` del día siguiente.

### Fórmula que aplica la calculadora al recibir tu archivo

```
Para cada embalse y cada instante t del forecast:

  v.balance(t) = max( 0,
                       v.obs.t0
                     + q.in.accumulated(t)     // integrado desde t0
                     - q.out.accumulated(t)    // integrado desde t0
                    )
```

Con eso genera 6 series `v.balance.*` por embalse (1 harmonie + 5 EPS) que persiste en la DB de predictions.

## Testing manual (para el proveedor)

Antes de conectar automáticamente, el proveedor puede probar subiendo este archivo directamente a una simulación existente:

```bash
# 1. Preguntar a VSAD por un simulationId de test
export SIM_ID=<uuid>

# 2. Adaptar el JSON: reemplazar 2026-07-09 y 2026-07-10 por fechas actuales
#    y verificar que el simulationId tiene una simulation real en la DB

# 3. Subir por SFTP
sftp -P 8212 tajosftp@65.21.97.113
sftp> put simulation-output-example.json SIMULATIONS/$SIM_ID/output/result.json
sftp> exit

# 4. Esperar max 5 min (el poller de ms-model-api corre cada 5 min)

# 5. Verificar que la simulación quedó FINALIZED en el backoffice
#    y que aparecen las predictions v.balance.* asociadas
```

## Referencias

- Diagrama del flujo completo: [`../../README.md`](../../README.md) sección "Simulation flows"
- Calculator readme: [`../../ms-calculator-api/README.md`](../../ms-calculator-api/README.md)
- Reservoir mappings: [`../../ms-calculator-api/src/config/reservoir_parameters.json`](../../ms-calculator-api/src/config/reservoir_parameters.json)
- Runbook operacional: [`../runbooks/manual-simulation-runbook.md`](../runbooks/manual-simulation-runbook.md)
