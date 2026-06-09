import { efas_token, efas_url } from '@/config/efasConfig'
import ky from 'ky'
import L from 'leaflet'

export interface WmsLayerTime {
  layerName: string
  start: string
  end: string
  stepHours: number
}

let cachedCapabilities: Document | null = null

async function getEFASCapabilities(): Promise<Document> {
  if (cachedCapabilities) return cachedCapabilities

  const xmlText = await ky
    .get(efas_url, {
      searchParams: {
        service: 'WMS',
        request: 'GetCapabilities',
      },
    })
    .text()

  const parser = new DOMParser()

  cachedCapabilities = parser.parseFromString(xmlText, 'text/xml')

  return cachedCapabilities
}

export async function getLayerTimeDimension(layerName: string): Promise<WmsLayerTime | null> {
  const xml = await getEFASCapabilities()

  const layers = xml.querySelectorAll('Layer')

  for (const layer of layers) {
    const name = layer.querySelector('Name')?.textContent

    if (name === layerName) {
      const dim = layer.querySelector('Dimension[name="time"]')

      if (!dim) return null

      const text = dim.textContent ?? ''

      const [start, end, step] = text.split('/')

      const stepHours = Number(step.replace('PT', '').replace('H', ''))

      return {
        layerName,
        start,
        end,
        stepHours,
      }
    }
  }

  return null
}

export function getLayerLegendUrl(layerName: string): string {
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.3.0',
    REQUEST: 'GetLegendGraphic',
    LAYER: layerName,
    TOKEN: efas_token,
    FORMAT: 'image/png',
  })

  return `${efas_url}?${params.toString()}`
}

// Helper para construir la URL GetFeatureInfo
export function buildFeatureInfoUrl(map: L.Map, layer: L.TileLayer.WMS, latlng: L.LatLng): string {
  const point = map.latLngToContainerPoint(latlng)
  const size = map.getSize()

  const bounds = map.getBounds()

  const bbox = [
    bounds.getSouthWest().lat,
    bounds.getSouthWest().lng,
    bounds.getNorthEast().lat,
    bounds.getNorthEast().lng,
  ].join(',')

  const params = {
    request: 'GetFeatureInfo',
    service: 'WMS',
    version: '1.3.0',
    crs: 'EPSG:4326',
    layers: 'mapserver:ReportingPoints',
    query_layers: 'mapserver:ReportingPoints',
    info_format: 'text/html',
    i: String(Math.floor(point.x)),
    j: String(Math.floor(point.y)),
    width: String(size.x),
    height: String(size.y),
    bbox,
    styles: '',
    format: 'image/png',
    token: efas_token,
  }

  return efas_url + '?' + new URLSearchParams(params)
}
