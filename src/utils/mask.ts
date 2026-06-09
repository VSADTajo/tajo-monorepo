import { boundaryStore, onBoundaryReady } from '@/stores/boundaryStore'
import L from 'leaflet'

export type LayerWithMap = L.Layer & {
  _map?: L.Map
}

export function ringArea(ring: number[][]): number {
  let area = 0
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i]
    const [x2, y2] = ring[(i + 1) % ring.length]
    area += x1 * y2 - x2 * y1
  }
  return Math.abs(area / 2)
}

export function extractLargestOuterRing(
  featureCollection: GeoJSON.FeatureCollection
): L.LatLngExpression[] | null {
  let largestRing: number[][] | null = null
  let largestArea = 0

  for (const feature of featureCollection.features) {
    if (!feature.geometry) continue

    if (feature.geometry.type === 'Polygon') {
      const ring = feature.geometry.coordinates[0]
      if (!ring?.length) continue

      const area = ringArea(ring)
      if (area > largestArea) {
        largestArea = area
        largestRing = ring
      }
    }

    if (feature.geometry.type === 'MultiPolygon') {
      for (const polygon of feature.geometry.coordinates) {
        const ring = polygon[0]
        if (!ring?.length) continue

        const area = ringArea(ring)
        if (area > largestArea) {
          largestArea = area
          largestRing = ring
        }
      }
    }
  }

  if (!largestRing) return null

  return largestRing.map(([lng, lat]) => [lat, lng])
}

export function applyPolygonMaskToWMS(layer: L.TileLayer.WMS, maskId: string) {
  let stopBoundaryWatch = () => {}
  let stopMapWatch = () => {}

  const clearMask = () => {
    const container = layer.getContainer()
    if (!container) return

    container.style.removeProperty('clip-path')
    container.style.removeProperty('-webkit-clip-path')
  }

  const bindMask = (featureCollection: GeoJSON.FeatureCollection) => {
    const polygon = extractLargestOuterRing(featureCollection)
    if (!polygon?.length) return

    stopMapWatch()

    const updateMask = () => {
      const map = (layer as unknown as LayerWithMap)._map
      const container = layer.getContainer()

      if (!map || !container) return

      const mapContainer = map.getContainer()
      const mapRect = mapContainer.getBoundingClientRect()
      const layerRect = container.getBoundingClientRect()

      // clip-path uses the layer container local coordinates, not map container coordinates
      const offsetX = layerRect.left - mapRect.left
      const offsetY = layerRect.top - mapRect.top

      const points = polygon.map((latLng) => {
        const p = map.latLngToContainerPoint(latLng as L.LatLngExpression)
        return L.point(p.x - offsetX, p.y - offsetY)
      })

      const clipPath = `polygon(${points.map((p) => `${p.x}px ${p.y}px`).join(',')})`

      container.style.setProperty('clip-path', clipPath)
      container.style.setProperty('-webkit-clip-path', clipPath)
    }

    const map = (layer as unknown as LayerWithMap)._map
    if (map) {
      const boundUpdate = () => updateMask()
      map.on('move zoom resize', boundUpdate)
      layer.on('load', boundUpdate)

      stopMapWatch = () => {
        map.off('move zoom resize', boundUpdate)
        layer.off('load', boundUpdate)
      }

      updateMask()
    }
  }

  layer.on('add', () => {
    const boundary = boundaryStore[maskId]
    if (boundary) {
      bindMask(boundary.geojson)
      return
    }

    stopBoundaryWatch = onBoundaryReady(maskId, (data) => {
      bindMask(data.geojson)
    })
  })

  layer.on('remove', () => {
    stopBoundaryWatch()
    stopMapWatch()
    clearMask()
  })
}
