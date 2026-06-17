# Resguardos — API Contract

Gestión de resguardos por estación (volumen de resguardo, cota de resguardo, volumen mínimo) para estaciones tipo `EMBALSE_SAIH`.

Cada resguardo tiene dos juegos de valores:

- **Originales** (inmutables, provienen del import XLS): `originalReserveVolume`, `originalReserveLevel`, `originalMinimumVolume`.
- **Editables** (correcciones manuales, nullables): `reserveVolume`, `reserveLevel`, `minimumVolume`.

**Valor vigente (resolved)** por campo: `editado ?? original`.

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/resguardos/import` | Importa resguardos desde un archivo XLS/XLSX (multi-sheet o simple). Query opcional `?baseYear=YYYY`. |
| `GET` | `/resguardos/:stationCode` | Serie por fecha de los valores **resueltos**. Filtros opcionales `?from&to&year`. |
| `GET` | `/resguardos/:stationCode/:date` | Resguardo de una fecha, con **original + edited + resolved** por separado. |
| `PUT` | `/resguardos/:stationCode/:date` | Edita los campos editables. Enviar `null` en un campo aplica el original. |

### `GET /resguardos/:stationCode/:date` — respuesta

```json
{
  "stationCode": "E_01",
  "stationName": "ENTREPEÑAS",
  "date": "2025-10-01",
  "original": { "reserveVolume": 802.563, "reserveLevel": 718, "minimumVolume": 51.15 },
  "edited":   { "reserveVolume": null,    "reserveLevel": null, "minimumVolume": null },
  "resolved": { "reserveVolume": 802.563, "reserveLevel": 718,  "minimumVolume": 51.15 }
}
```

- `original`: valores inmutables del import (solo lectura).
- `edited`: correcciones manuales (pueden ser `null`).
- `resolved`: `edited.<campo> ?? original.<campo>` por cada campo.

404 si la estación o la fecha no existen.

## Cache

- Queries cacheadas en Redis (`resguardo:*`), TTL 600s.
- `PUT` y `POST /import` invalidan el patrón `resguardo:*` (cubre la serie por estación y el detalle por fecha).

## Notas

- El alta de resguardos es **exclusivamente** por importación XLS (no hay creación manual).
- No existe estado activo/inactivo ni borrado de resguardos.
