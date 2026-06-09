/**
 * Converts station data from REST API to GeoJSON format
 */

export interface StationData {
  id: string
  name: string
  stationCode: string
  stationType: string
  latitude: number | null
  longitude: number | null
  threshold?: {
    umbralNivel1?: number | null
    umbralNivel2?: number | null
    umbralNivel3?: number | null
    umbralCaudal1?: number | null
    umbralCaudal2?: number | null
    umbralCaudal3?: number | null
    [key: string]: unknown
  } | null
  subBasinName?: string
  tipoCod?: string | null
  municipio?: string | null
  provincia?: string | null
  ccaa?: string | null
  [key: string]: unknown
}

export interface StationsApiResponse {
  items: StationData[]
}

function hasValidCoordinates(
  station: StationData
): station is StationData & { latitude: number; longitude: number } {
  return (
    station.latitude != null &&
    station.longitude != null &&
    Number.isFinite(station.latitude) &&
    Number.isFinite(station.longitude)
  )
}

function getThresholdValue(
  threshold: StationData['threshold'],
  keys: Array<
    | 'umbralNivel1'
    | 'umbralNivel2'
    | 'umbralNivel3'
    | 'umbralCaudal1'
    | 'umbralCaudal2'
    | 'umbralCaudal3'
  >
): number | null {
  if (!threshold) return null

  for (const key of keys) {
    const raw = threshold[key]
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  }

  return null
}

export function stationsToGeoJSON(stations: StationData[]): GeoJSON.FeatureCollection {
  const validStations = stations.filter(hasValidCoordinates)

  const features: GeoJSON.Feature[] = validStations.map((station) => ({
    type: 'Feature' as const,
    id: station.id,
    geometry: {
      type: 'Point' as const,
      coordinates: [station.longitude, station.latitude] as [number, number],
    },
    properties: {
      id: station.id,
      name: station.name,
      stationCode: station.stationCode,
      stationType: station.stationType,
      tipo_cod: station.tipoCod ?? null,
      tipoCod: station.tipoCod ?? null,
      subBasinName: station.subBasinName,
      municipio: station.municipio,
      provincia: station.provincia,
      ccaa: station.ccaa,
      threshold: station.threshold ?? null,
      umbral_caudal_1: getThresholdValue(station.threshold, ['umbralCaudal1', 'umbralNivel1']),
      umbral_caudal_2: getThresholdValue(station.threshold, ['umbralCaudal2', 'umbralNivel2']),
      umbral_caudal_3: getThresholdValue(station.threshold, ['umbralCaudal3', 'umbralNivel3']),
      umbral_cauda_1: getThresholdValue(station.threshold, ['umbralCaudal1', 'umbralNivel1']),
      umbral_cauda_2: getThresholdValue(station.threshold, ['umbralCaudal2', 'umbralNivel2']),
      umbral_cauda_3: getThresholdValue(station.threshold, ['umbralCaudal3', 'umbralNivel3']),
      umbral_amarillo: getThresholdValue(station.threshold, ['umbralCaudal1', 'umbralNivel1']),
      umbral_naranja: getThresholdValue(station.threshold, ['umbralCaudal2', 'umbralNivel2']),
      umbral_rojo: getThresholdValue(station.threshold, ['umbralCaudal3', 'umbralNivel3']),
    },
  }))

  return {
    type: 'FeatureCollection' as const,
    features,
  }
}
