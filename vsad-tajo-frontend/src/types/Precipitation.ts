export interface Precipitation {
  'Ubicación de la estación': string
  'Nombre de la estación': string
  'Número de la estación': string
  LocalX: string
  LocalY: string
  Dato: string
  'Nombre del parámetro': string
  'Tipo de parámetro': string
  'Nombre del tipo de parámetro': string
  'Nombre de la serie temporal': string
  'Unidad de la serie temporal': string
  GlobalX: string
  GlobalY: string
  Longitud: string
  Latitud: string
  Telemetry: TelemetryRecord[]
}

export type TelemetryRecord = [string, string, string]
