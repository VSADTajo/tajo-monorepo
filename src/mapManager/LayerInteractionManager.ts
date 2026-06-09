import L from 'leaflet'
import router from '@/router'
import { useReportingPointStore } from '@/stores/reportingPointsStore'
import { buildFeatureInfoUrl } from '@/services/efasWmsService'
import { MAP_PANES } from '@/config/panes/mapPanes'
import { isSelectableLayerId, type SelectableLayerId } from './layerConstants'
import { boundaryStore } from '@/stores/boundaryStore'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'

type ManagedStyleLayer = {
  clearAll: () => void
  wasLastClickHandled: () => boolean
  selectFeatureById?: (
    featureId: string,
    geojsonLayer: L.GeoJSON,
    map: L.Map,
    options?: { focus?: boolean }
  ) => boolean
}

type LayerLookup = Record<string, L.Layer>

type LayerInteractionManagerOptions = {
  getActiveLayers: () => LayerLookup
  getGroupedLayers: () => LayerLookup
  onFeatureClick: (layerId: string, feature: GeoJSON.Feature) => void
}

export class LayerInteractionManager {
  private map: L.Map
  private mapClickDebounce: ReturnType<typeof setTimeout> | null = null
  private styleManagers: Record<string, ManagedStyleLayer> = {}
  private wmsClickHandlers: Record<string, (e: L.LeafletMouseEvent) => void> = {}
  private precipitacionClickHandlers: Record<string, (e: L.LeafletMouseEvent) => void> = {}
  private readonly getActiveLayers: () => LayerLookup
  private readonly getGroupedLayers: () => LayerLookup
  private readonly onFeatureClick: (layerId: string, feature: GeoJSON.Feature) => void

  constructor(map: L.Map, options: LayerInteractionManagerOptions) {
    this.map = map
    this.getActiveLayers = options.getActiveLayers
    this.getGroupedLayers = options.getGroupedLayers
    this.onFeatureClick = options.onFeatureClick

    // Click fuera de features seleccionables -> limpiar seleccion.
    this.map.on('click', () => {
      if (this.mapClickDebounce) {
        clearTimeout(this.mapClickDebounce)
      }

      this.mapClickDebounce = setTimeout(() => {
        let anyHandled = false

        for (const styleManager of Object.values(this.styleManagers)) {
          if (styleManager.wasLastClickHandled()) {
            anyHandled = true
          }
        }

        if (!anyHandled) {
          this.clearAllSelections()
        }
      }, 50)
    })
  }

  attachVectorClick(layerId: string, layer: L.Layer) {
    if (!(layer instanceof L.GeoJSON)) {
      return
    }

    const styleManager = this.getLayerStyleManager(layer)

    if (styleManager && typeof styleManager.attachStyleListeners === 'function') {
      styleManager.attachStyleListeners(layer, this.map)
      this.styleManagers[layerId] = styleManager
      return
    }

    const eventType = isSelectableLayerId(layerId) ? 'dblclick' : 'click'

    const handler = (e: L.LeafletMouseEvent) => {
      const geoJsonLayer = e.layer as unknown as L.GeoJSON
      const feature = geoJsonLayer.feature as GeoJSON.Feature | undefined

      if (!feature) {
        return
      }

      this.onFeatureClick(layerId, feature)
    }

    layer.on(eventType, handler)
  }

  attachStyleManagerFromSource(layerId: string, source: L.Layer, target: L.Layer): boolean {
    if (!(source instanceof L.GeoJSON) || !(target instanceof L.GeoJSON)) {
      return false
    }

    const sourceStyleManager = this.getLayerStyleManager(source)

    if (!sourceStyleManager || typeof sourceStyleManager.attachStyleListeners !== 'function') {
      return false
    }

    sourceStyleManager.attachStyleListeners(target, this.map)
    this.styleManagers[layerId] = sourceStyleManager
    return true
  }

  attachWMSClick(layerId: string, layer: L.Layer) {
    if (!(layer instanceof L.TileLayer.WMS)) {
      return
    }

    if (this.wmsClickHandlers[layerId]) {
      return
    }

    const handler = async (e: L.LeafletMouseEvent) => {
      if (!this.map.hasLayer(layer)) {
        return
      }

      const url = buildFeatureInfoUrl(this.map, layer, e.latlng)

      try {
        const res = await fetch(url)
        const data = await res.text()

        if (!data) {
          return
        }

        this.handleWMSClick(layerId, data)
      } catch (err) {
        console.error(err)
      }
    }

    this.wmsClickHandlers[layerId] = handler
    this.map.on('click', handler)
  }

  detachWMSClick(layerId: string) {
    const handler = this.wmsClickHandlers[layerId]

    if (!handler) {
      return
    }

    this.map.off('click', handler)
    delete this.wmsClickHandlers[layerId]
  }

  attachPrecipitacionClick(layerId: string, layer: L.Layer) {
    if (this.precipitacionClickHandlers[layerId]) {
      return
    }

    const handler = (e: L.LeafletMouseEvent) => {
      if (!this.map.hasLayer(layer)) {
        return
      }

      const { lat, lng } = e.latlng

      // Verificar si el punto está dentro del contorno
      const boundary = boundaryStore['contorno']
      if (!boundary) {
        return
      }

      const point: GeoJSON.Point = {
        type: 'Point',
        coordinates: [lng, lat],
      }

      const isInside = boundary.geojson.features.some((feature) => {
        if (feature.geometry.type !== 'Polygon' && feature.geometry.type !== 'MultiPolygon') {
          return false
        }
        const polygonFeature = feature as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>
        return booleanPointInPolygon(point, polygonFeature)
      })

      if (!isInside) {
        return
      }

      router.replace({
        query: {
          ...router.currentRoute.value.query,
          precipitacion: `${lat.toFixed(5)},${lng.toFixed(5)}`,
          precipitacionLayer: layerId,
        },
      })
    }

    this.precipitacionClickHandlers[layerId] = handler
    this.map.on('click', handler)
  }

  detachPrecipitacionClick(layerId: string) {
    const handler = this.precipitacionClickHandlers[layerId]

    if (!handler) {
      return
    }

    this.map.off('click', handler)
    delete this.precipitacionClickHandlers[layerId]
  }

  clearStyleManager(layerId: string): void {
    const styleManager = this.styleManagers[layerId]

    if (styleManager && typeof styleManager.clearAll === 'function') {
      styleManager.clearAll()
    }
  }

  clearAllSelections(): void {
    for (const styleManager of Object.values(this.styleManagers)) {
      if (styleManager && typeof styleManager.clearAll === 'function') {
        styleManager.clearAll()
      }
    }

    const allLayers = { ...this.getActiveLayers(), ...this.getGroupedLayers() }

    for (const layer of Object.values(allLayers)) {
      if (!(layer instanceof L.GeoJSON)) {
        continue
      }

      const styleManager = this.getLayerStyleManager(layer)

      if (styleManager && typeof styleManager.clearAll === 'function') {
        styleManager.clearAll()
      }
    }

    const orphanOverlayLayers: L.Layer[] = []

    this.map.eachLayer((layer) => {
      if (!(layer instanceof L.GeoJSON)) {
        return
      }

      const pane = (layer.options as L.PathOptions & { pane?: string })?.pane
      if (pane === MAP_PANES.HIGHLIGHT || pane === MAP_PANES.SELECTION) {
        orphanOverlayLayers.push(layer)
      }
    })

    for (const layer of orphanOverlayLayers) {
      this.map.removeLayer(layer)
    }
  }

  clearOtherStyleManagers(layerId: string): void {
    for (const selectableLayerId of [
      'subcuencas',
      'sistemas10',
      'zonasexpl',
      'comarcasagrarias',
    ] as SelectableLayerId[]) {
      if (selectableLayerId === layerId) {
        continue
      }

      this.clearStyleManager(selectableLayerId)
    }
  }

  selectFeature(
    layerId: SelectableLayerId,
    featureId: string,
    options?: { focus?: boolean }
  ): boolean {
    const layer = this.getActiveLayers()[layerId]

    if (!(layer instanceof L.GeoJSON)) {
      return false
    }

    const styleManager = this.styleManagers[layerId]
    if (!styleManager?.selectFeatureById) {
      return false
    }

    this.clearAllSelections()
    return styleManager.selectFeatureById(featureId, layer, this.map, options)
  }

  private extractStationId(html: string): string | null {
    const doc = new DOMParser().parseFromString(html, 'text/html')

    const cell = doc.querySelector('#point-information tbody tr td')

    return cell?.textContent?.trim() ?? null
  }

  private handleWMSClick(layerId: string, data: string) {
    const stationId = this.extractStationId(data)

    if (!stationId) {
      return
    }

    switch (layerId) {
      case 'reportingpoints': {
        const reportingPointStore = useReportingPointStore()

        reportingPointStore.setReportingPoint({
          stationId,
          html: data,
        })

        router.replace({
          query: {
            ...router.currentRoute.value.query,
            reportingPoint: stationId,
          },
        })
        break
      }

      default:
    }
  }

  private getLayerStyleManager(layer: L.GeoJSON):
    | (ManagedStyleLayer & {
        attachStyleListeners?: (targetLayer: L.GeoJSON, map: L.Map) => void
      })
    | undefined {
    return Object.getOwnPropertyDescriptor(layer, '_styleManager')?.value as
      | (ManagedStyleLayer & {
          attachStyleListeners?: (targetLayer: L.GeoJSON, map: L.Map) => void
        })
      | undefined
  }
}
