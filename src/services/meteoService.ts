import { api } from './api'
import type { MeteoAccumulatedImageLayerConfig } from '@/types/Layers'

type MeteoInfoBBox = {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

type MeteoInfoPayload = {
  provider: string
  variable: string
  layerName?: string
  info?: {
    nombre?: string
    fechaInicio?: string
    fechaFin?: string
    pasoDeTiempo?: number
    unidad?: string
    ncols?: number
    nrows?: number
    bbox?: MeteoInfoBBox
  }
}

export type MeteoLayerTimeDimension = {
  start: string
  end: string
  stepHours: number
  bbox: MeteoInfoBBox
  width: number
  height: number
}

const meteoDimensionCache = new Map<string, MeteoLayerTimeDimension>()

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function createCacheKey(provider: string, variable: string): string {
  return `${provider.trim().toUpperCase()}|${variable.trim()}`
}

function normalizeProvider(value: string): string {
  return value.trim().toUpperCase()
}

function normalizeVariable(value: string): string {
  return value.trim().toLowerCase()
}

function resolveBaseUrl(url: string): string {
  const normalized = url.trim()
  if (!normalized) {
    return typeof window !== 'undefined' ? window.location.origin : 'http://localhost/'
  }

  try {
    return new URL(normalized).toString()
  } catch {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
    return new URL(normalized.replace(/^\/+/, ''), `${origin}/`).toString()
  }
}

function toMeteoDimension(payload: MeteoInfoPayload): MeteoLayerTimeDimension | null {
  const info = payload.info
  if (!info) return null

  const start = info.fechaInicio
  const end = info.fechaFin
  const stepMinutes = info.pasoDeTiempo
  const bbox = info.bbox

  if (!start || !end || !isFiniteNumber(stepMinutes) || !bbox) {
    return null
  }

  const width = isFiniteNumber(info.ncols) ? Math.max(1, Math.round(info.ncols)) : 768
  const height = isFiniteNumber(info.nrows) ? Math.max(1, Math.round(info.nrows)) : 330
  const stepHours = stepMinutes > 0 ? stepMinutes / 60 : 1

  return {
    start,
    end,
    stepHours,
    bbox,
    width,
    height,
  }
}

export async function getMeteoLayerTimeDimension(
  config: Pick<MeteoAccumulatedImageLayerConfig, 'provider' | 'variable' | 'infoPath'>
): Promise<MeteoLayerTimeDimension | null> {
  const cacheKey = createCacheKey(config.provider, config.variable)
  const cached = meteoDimensionCache.get(cacheKey)
  if (cached) return cached

  const infoPath = config.infoPath ?? 'meteo/info'

  const response = await api
    .get(infoPath, {
      searchParams: {
        variable: config.variable,
        provider: config.provider,
      },
      headers: {
        Accept: 'application/json',
      },
    })
    .json<MeteoInfoPayload[]>()

  const normalizedProvider = normalizeProvider(config.provider)
  const normalizedVariable = normalizeVariable(config.variable)

  const matched =
    response.find((entry) => {
      const entryProvider = normalizeProvider(entry.provider ?? '')
      const entryVariable = normalizeVariable(entry.variable ?? '')

      return entryProvider === normalizedProvider && entryVariable === normalizedVariable
    }) ?? (response.length === 1 ? response[0] : null)

  if (!matched) {
    console.warn('[meteoService] Unable to match meteo info payload entry', {
      provider: config.provider,
      variable: config.variable,
      responseEntries: response.length,
    })
    return null
  }

  const dimension = toMeteoDimension(matched)
  if (!dimension) return null

  meteoDimensionCache.set(cacheKey, dimension)
  return dimension
}

export function buildMeteoAccumulatedMapUrl(
  config: Pick<
    MeteoAccumulatedImageLayerConfig,
    'url' | 'provider' | 'variable' | 'mapPath' | 'imageFormat'
  >,
  dimension: Pick<MeteoLayerTimeDimension, 'bbox' | 'width' | 'height'>,
  range: { from: string; to: string }
): string {
  const mapPath = config.mapPath ?? 'meteo/accumulate/map'
  const resolvedBaseUrl = resolveBaseUrl(config.url)
  const baseUrl = new URL(mapPath, `${resolvedBaseUrl.replace(/\/+$/, '')}/`)

  const params = new URLSearchParams({
    FORMAT: config.imageFormat ?? 'image/jpeg',
    HEIGHT: String(dimension.height),
    WIDTH: String(dimension.width),
    BBOX: `${dimension.bbox.minX},${dimension.bbox.minY},${dimension.bbox.maxX},${dimension.bbox.maxY}`,
    from: range.from,
    to: range.to,
    variable: config.variable,
    provider: config.provider,
  })

  baseUrl.search = params.toString()
  return baseUrl.toString()
}
