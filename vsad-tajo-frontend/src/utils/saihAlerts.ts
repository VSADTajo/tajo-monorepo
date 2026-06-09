import type { Feature } from 'geojson'
import { getMaxAndLatestValuesService } from '@/services/predictions'
import type { StationMaxLatestValue } from '@/types/Predictions'

const ALERT_YELLOW = '#fde68a'
const ALERT_ORANGE = '#fdba74'
const ALERT_RED = '#fca5a5'
const ALERT_CACHE_TTL_MS = 5 * 60 * 1000
const ALERT_FAILURE_COOLDOWN_MS = 60 * 1000

const bestQByStation = new Map<string, StationMaxLatestValue>()
const bestIByStation = new Map<string, StationMaxLatestValue>()
const bestPByStation = new Map<string, StationMaxLatestValue>()
let alertsLastLoadedAt = 0
let alertsLastFailedAt = 0
let alertsInFlight: Promise<void> | null = null

function normalizeStationKey(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toUpperCase()
}

function readNumber(props: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const raw = props[key]
    if (raw == null) continue

    if (typeof raw === 'number' && Number.isFinite(raw)) return raw

    if (typeof raw === 'string') {
      const parsed = Number.parseFloat(raw.replace(',', '.').trim())
      if (Number.isFinite(parsed)) return parsed
    }
  }

  return null
}

function getThresholds(props: Record<string, unknown>) {
  return {
    yellow: readNumber(props, ['umbral_caudal_1', 'umbral_cauda_1', 'umbral_amarillo']),
    orange: readNumber(props, ['umbral_caudal_2', 'umbral_cauda_2', 'umbral_naranja']),
    red: readNumber(props, ['umbral_caudal_3', 'umbral_cauda_3', 'umbral_rojo']),
  }
}

function getStationCode(feature: Feature): string {
  const props = (feature.properties ?? {}) as Record<string, unknown>
  return normalizeStationKey(
    props.stationCode ?? props.codigo ?? props.stationId ?? props.code ?? feature.id
  )
}

function getCaudalType(feature: Feature): 'Q.NAM.harmonie' | 'I.NAM.harmonie' {
  const props = (feature.properties ?? {}) as Record<string, unknown>
  const tipo = normalizeStationKey(props.tipoCod ?? props.tipo_cod)
  return tipo === 'E' ? 'I.NAM.harmonie' : 'Q.NAM.harmonie'
}

function pickBestEntry(current: StationMaxLatestValue | undefined, next: StationMaxLatestValue) {
  if (!current) return next
  if (next.maxValue > current.maxValue) return next
  if (next.maxValue < current.maxValue) return current
  return next.maxDate > current.maxDate ? next : current
}

function setBestByStation(
  targetMap: Map<string, StationMaxLatestValue>,
  values: StationMaxLatestValue[]
) {
  targetMap.clear()

  for (const item of values) {
    const stationKey = normalizeStationKey(item.stationId)
    if (!stationKey || !Number.isFinite(item.maxValue)) continue

    const previous = targetMap.get(stationKey)
    targetMap.set(stationKey, pickBestEntry(previous, item))
  }
}

export async function ensureSaihAlertsLoaded(force = false): Promise<void> {
  const cacheIsFresh = Date.now() - alertsLastLoadedAt < ALERT_CACHE_TTL_MS
  const inFailureCooldown = Date.now() - alertsLastFailedAt < ALERT_FAILURE_COOLDOWN_MS

  if (!force && cacheIsFresh && (bestQByStation.size > 0 || bestIByStation.size > 0)) {
    return
  }

  if (!force && inFailureCooldown) {
    return
  }

  if (alertsInFlight) {
    await alertsInFlight
    return
  }

  alertsInFlight = (async () => {
    try {
      const [qValues, iValues, pValues] = await Promise.all([
        getMaxAndLatestValuesService('Q.NAM.harmonie'),
        getMaxAndLatestValuesService('I.NAM.harmonie'),
        getMaxAndLatestValuesService('P.harmonie.forecast'),
      ])

      setBestByStation(bestQByStation, qValues)
      setBestByStation(bestIByStation, iValues)
      setBestByStation(bestPByStation, pValues)
      alertsLastLoadedAt = Date.now()
      alertsLastFailedAt = 0
    } catch (error) {
      alertsLastFailedAt = Date.now()
      console.warn('SAIH alert values unavailable. Retrying in 60s.', error)
    } finally {
      alertsInFlight = null
    }
  })()

  await alertsInFlight
}

export function getSaihAlertInfo(feature: Feature): {
  maxValue: number | null
  latestValue: number | null
  latestDate: string | null
  maxDate: string | null
  backgroundColor: string | null
} {
  const stationCode = getStationCode(feature)
  if (!stationCode) {
    return {
      maxValue: null,
      latestValue: null,
      latestDate: null,
      maxDate: null,
      backgroundColor: null,
    }
  }

  const sourceMap = getCaudalType(feature) === 'I.NAM.harmonie' ? bestIByStation : bestQByStation
  const bestEntry = sourceMap.get(stationCode)

  if (!bestEntry) {
    return {
      maxValue: null,
      latestValue: null,
      latestDate: null,
      maxDate: null,
      backgroundColor: null,
    }
  }

  const props = (feature.properties ?? {}) as Record<string, unknown>
  const thresholds = getThresholds(props)

  let backgroundColor: string | null = null
  if (thresholds.red != null && bestEntry.maxValue >= thresholds.red) backgroundColor = ALERT_RED
  else if (thresholds.orange != null && bestEntry.maxValue >= thresholds.orange) {
    backgroundColor = ALERT_ORANGE
  } else if (thresholds.yellow != null && bestEntry.maxValue >= thresholds.yellow) {
    backgroundColor = ALERT_YELLOW
  }

  return {
    maxValue: bestEntry.maxValue,
    latestValue: bestEntry.latestValue,
    latestDate: bestEntry.latestDate,
    maxDate: bestEntry.maxDate,
    backgroundColor,
  }
}

export function getSaihPrecipMaxInfo(feature: Feature): {
  maxValue: number | null
  maxDate: string | null
} {
  const stationCode = getStationCode(feature)
  if (!stationCode) return { maxValue: null, maxDate: null }

  const bestEntry = bestPByStation.get(stationCode)
  if (!bestEntry) return { maxValue: null, maxDate: null }

  return {
    maxValue: bestEntry.maxValue,
    maxDate: bestEntry.maxDate,
  }
}
