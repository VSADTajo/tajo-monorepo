import ky from 'ky'
import { addHours } from 'date-fns'

export interface WmsLayerTime {
  layerName: string
  start: string
  end: string
  stepHours: number
}

const cachedCapabilitiesByUrl = new Map<string, Document>()

function getDirectChildText(parent: Element, tagName: string): string | null {
  for (const child of Array.from(parent.children)) {
    if (child.localName === tagName) {
      return child.textContent?.trim() ?? null
    }
  }

  return null
}

function getTimeDimensionText(layer: Element): string | null {
  for (const child of Array.from(layer.children)) {
    const tagName = child.localName
    const dimensionName = child.getAttribute('name')?.toLowerCase()

    if ((tagName === 'Dimension' || tagName === 'Extent') && dimensionName === 'time') {
      return child.textContent?.trim() ?? null
    }
  }

  return null
}

function getInheritedTimeDimensionText(layer: Element): string | null {
  let current: Element | null = layer

  while (current) {
    const timeDimension = getTimeDimensionText(current)

    if (timeDimension) {
      return timeDimension
    }

    const parentLayer: Element | null = current.parentElement
    current = parentLayer?.localName === 'Layer' ? parentLayer : null
  }

  return null
}

function normalizeLayerName(layerName: string): string {
  return layerName.includes(':') ? (layerName.split(':').pop() ?? layerName) : layerName
}

function parseDurationHours(step: string): number | null {
  const match = step.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/i)

  if (!match) {
    return null
  }

  const days = Number(match[1] ?? 0)
  const hours = Number(match[2] ?? 0)
  const minutes = Number(match[3] ?? 0)
  const totalHours = days * 24 + hours + minutes / 60

  return totalHours > 0 ? totalHours : null
}

function inferStepHours(values: string[]): number {
  if (values.length < 2) {
    return 1
  }

  const first = Date.parse(values[0])
  const second = Date.parse(values[1])

  if (Number.isNaN(first) || Number.isNaN(second) || second <= first) {
    return 1
  }

  return (second - first) / (1000 * 60 * 60)
}

function parseTimeDimension(layerName: string, rawValue: string): WmsLayerTime | null {
  const value = rawValue.trim()

  if (!value) {
    return null
  }

  if (value.includes('/')) {
    const [start, end, step] = value.split('/')

    if (!start || !end) {
      return null
    }

    return {
      layerName,
      start,
      end,
      stepHours: step ? (parseDurationHours(step) ?? 1) : 1,
    }
  }

  const values = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)

  if (!values.length) {
    return null
  }

  return {
    layerName,
    start: values[0],
    end: values[values.length - 1],
    stepHours: inferStepHours(values),
  }
}

async function getWmsCapabilities(url: string): Promise<Document> {
  if (cachedCapabilitiesByUrl.has(url)) {
    return cachedCapabilitiesByUrl.get(url) as Document
  }

  const xmlText = await ky
    .get(url, {
      searchParams: {
        service: 'WMS',
        request: 'GetCapabilities',
      },
    })
    .text()

  const parser = new DOMParser()
  const xml = parser.parseFromString(xmlText, 'text/xml')

  cachedCapabilitiesByUrl.set(url, xml)

  return xml
}

export async function getGeoServerLayerTimeDimension(options: {
  url: string
  layerName: string
}): Promise<WmsLayerTime | null> {
  const xml = await getWmsCapabilities(options.url)

  const layers = xml.getElementsByTagNameNS('*', 'Layer')
  const requestedLayerName = normalizeLayerName(options.layerName)

  for (const layer of layers) {
    const name = getDirectChildText(layer, 'Name')

    if (name && normalizeLayerName(name) === requestedLayerName) {
      const timeDimension = getInheritedTimeDimensionText(layer)

      console.debug('[geoserverWmsService] timeDimension raw', {
        matchedLayerName: name,
        raw: timeDimension,
      })

      if (!timeDimension) {
        return null
      }

      return parseTimeDimension(options.layerName, timeDimension)
    }
  }

  return null
}

export function getGeoServerLegendUrl(options: {
  url: string
  layerName: string
  styleName?: string
  format?: string
}): string {
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.3.0',
    REQUEST: 'GetLegendGraphic',
    LAYER: options.layerName,
    FORMAT: options.format ?? 'image/png',
    TRANSPARENT: 'true',
  })

  if (options.styleName) {
    params.set('STYLE', options.styleName)
  }

  return `${options.url}?${params.toString()}`
}

export interface WmsPointTimeValue {
  time: string
  value: number | null
}

function extractNumericValueFromFeatureInfo(data: unknown): number | null {
  if (!data || typeof data !== 'object') {
    return null
  }

  const featureCollection = data as {
    features?: Array<{
      properties?: Record<string, unknown>
    }>
  }

  const properties = featureCollection.features?.[0]?.properties
  if (!properties) {
    return null
  }

  for (const rawValue of Object.values(properties)) {
    const numericValue = Number(rawValue)
    if (Number.isFinite(numericValue)) {
      return numericValue
    }
  }

  return null
}

function buildTimeline(startIso: string, endIso: string, stepHours: number): string[] {
  const start = new Date(startIso)
  const end = new Date(endIso)

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return []
  }

  const safeStepHours = stepHours > 0 ? stepHours : 1
  const result: string[] = []

  let cursor = new Date(start)
  while (cursor <= end) {
    result.push(cursor.toISOString())
    cursor = addHours(cursor, safeStepHours)
  }

  return result
}

async function fetchGeoServerPointValueAtTime(options: {
  url: string
  layerName: string
  lat: number
  lng: number
  time: string
}): Promise<number | null> {
  const delta = 0.001
  const minX = options.lng - delta
  const minY = options.lat - delta
  const maxX = options.lng + delta
  const maxY = options.lat + delta

  const params = {
    service: 'WMS',
    request: 'GetFeatureInfo',
    version: '1.1.1',
    srs: 'EPSG:4326',
    layers: options.layerName,
    query_layers: options.layerName,
    info_format: 'application/json',
    feature_count: '1',
    x: '50',
    y: '50',
    width: '101',
    height: '101',
    bbox: `${minX},${minY},${maxX},${maxY}`,
    format: 'image/png',
    transparent: 'true',
    time: options.time,
  }

  try {
    const response = await ky.get(options.url, { searchParams: params })
    const contentType = response.headers.get('content-type') ?? ''

    if (!contentType.includes('application/json')) {
      console.warn('[geoserverWmsService] Non-JSON response, skipping point', {
        layerName: options.layerName,
        time: options.time,
      })
      return null
    }

    const data = await response.json<unknown>()
    const extracted = extractNumericValueFromFeatureInfo(data)

    return extracted
  } catch (err) {
    console.error('[geoserverWmsService] GetFeatureInfo failed', {
      layerName: options.layerName,
      time: options.time,
      error: err,
    })
    return null
  }
}

export async function fetchGeoServerLayerPointTimeSeries(options: {
  url: string
  layerName: string
  lat: number
  lng: number
  startIso: string
  endIso: string
  stepHours: number
}): Promise<WmsPointTimeValue[]> {
  const timeline = buildTimeline(options.startIso, options.endIso, options.stepHours)

  if (!timeline.length) {
    console.warn('[geoserverWmsService] Empty timeline for series request', options)
    return []
  }

  const sampledTimeline = timeline

  const chunkSize = 8
  const result: WmsPointTimeValue[] = []

  for (let index = 0; index < sampledTimeline.length; index += chunkSize) {
    const chunk = sampledTimeline.slice(index, index + chunkSize)

    const values = await Promise.all(
      chunk.map(async (time) => {
        const value = await fetchGeoServerPointValueAtTime({
          url: options.url,
          layerName: options.layerName,
          lat: options.lat,
          lng: options.lng,
          time,
        })

        return {
          time,
          value,
        }
      })
    )

    result.push(...values)
  }

  return result
}
