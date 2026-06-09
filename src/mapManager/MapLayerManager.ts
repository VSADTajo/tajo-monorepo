// MapLayerManager.ts
import L from 'leaflet'
import { dynamicLayersConfig } from '@/config/layers.config'
import { createLayer } from '@/services/geoserver'
import type {
  LayerConfig,
  LayerState,
  MeteoAccumulatedImageLayerConfig,
  WMSLayerConfig,
} from '@/types/Layers'
import router from '@/router'
import { getLayerLegendUrl } from '@/services/efasWmsService'
import { getGeoServerLegendUrl } from '@/services/geoserverWmsService'
import { LegendManager } from './LegendManager'
import { MAP_PANES } from '@/config/panes/mapPanes'
import { isSelectableLayerId, type SelectableLayerId } from './layerConstants'
import { TemporalLayerManager } from './TemporalLayerManager'
import { LayerInteractionManager } from './LayerInteractionManager'
import { getCustomLegendInfo } from '@/config/styles/customLegends'
import { ensureSaihAlertsLoaded } from '@/utils/saihAlerts'
import { isPrecipitacionLayerId } from './layerConstants'
import { useLayersStore } from '@/stores/layersStore'

export class MapLayerManager {
  private map: L.Map
  private legendManager: LegendManager
  private temporalLayerManager: TemporalLayerManager
  private interactionManager: LayerInteractionManager
  private activeLayers: Record<string, L.Layer> = {}
  private cache: Record<string, L.Layer> = {}
  private configMap = new Map(dynamicLayersConfig.map((c) => [c.id, c]))

  // ==============================
  // Estado capas agrupadas / temporales
  // ==============================

  private groupedLayers: Record<string, L.Layer> = {}
  private temporalLayers: Record<string, Array<L.TileLayer.WMS | L.ImageOverlay>> = {}
  private layerGeneration: Record<string, number> = {}
  private cachedGroupCQLFilters: Record<string, string> = {}
  private layersStore = useLayersStore()

  constructor(map: L.Map) {
    this.map = map
    this.legendManager = new LegendManager(map)
    this.interactionManager = new LayerInteractionManager(map, {
      getActiveLayers: () => this.activeLayers,
      getGroupedLayers: () => this.groupedLayers,
      onFeatureClick: (layerId, feature) => {
        this.handleFeatureClick(layerId, feature)
      },
    })

    this.temporalLayerManager = new TemporalLayerManager(
      map,
      this.configMap,
      this.activeLayers,
      this.temporalLayers,
      this.layerGeneration,
      this.interactionManager
    )
  }

  async sync(layersState: Record<string, LayerState>) {
    await this.handleGroupedLayers(layersState)
    await this.handleStandardLayers(layersState)

    this.normalizePaneOrder()
  }

  private async handleGroupedLayers(layersState: Record<string, LayerState>) {
    for (const config of this.configMap.values()) {
      if (!config.groupBy) continue

      const { field, parentLayer } = config.groupBy

      const activeChildren = Object.values(layersState)
        .filter((l) => l.parentLayer === parentLayer && l.visible)
        .map((l) => l.id)

      // Si no hay hijos activos → limpiar capa
      if (!activeChildren.length) {
        const existing = this.groupedLayers[config.id]
        if (existing) {
          this.interactionManager.clearStyleManager(config.id)
          this.map.removeLayer(existing)
          delete this.groupedLayers[config.id]
          delete this.cachedGroupCQLFilters[config.id]
        }
        continue
      }

      const cql = `${field} IN (${activeChildren.map((v) => `'${v}'`).join(',')})`

      // Skip if CQL hasn't changed (e.g., slider movement shouldn't trigger reload)
      if (this.cachedGroupCQLFilters[config.id] === cql && this.groupedLayers[config.id]) {
        continue
      }

      if (config.id === 'saih') {
        await ensureSaihAlertsLoaded()
      }

      // Crear callback para capas agrupadas
      const callback = (feature: GeoJSON.Feature) => {
        this.handleFeatureClick(config.id, feature)
      }

      const newLayer = await createLayer(config, { CQL_FILTER: cql }, callback)

      if (!newLayer) {
        continue
      }

      const existing = this.groupedLayers[config.id]

      if (!existing) {
        newLayer.addTo(this.map)
        this.interactionManager.attachVectorClick(config.id, newLayer)
        this.groupedLayers[config.id] = newLayer
        this.cachedGroupCQLFilters[config.id] = cql
      } else {
        // Si es GeoJSON podemos actualizar datos
        if (existing instanceof L.GeoJSON && newLayer instanceof L.GeoJSON) {
          existing.clearLayers()
          existing.addData(newLayer.toGeoJSON())
          const styleCopied = this.interactionManager.attachStyleManagerFromSource(
            config.id,
            newLayer,
            existing
          )

          if (!styleCopied) {
            this.interactionManager.attachVectorClick(config.id, existing)
          }
          this.cachedGroupCQLFilters[config.id] = cql
        } else {
          // Para otros tipos, recreamos
          this.map.removeLayer(existing)
          newLayer.addTo(this.map)
          this.interactionManager.attachVectorClick(config.id, newLayer)
          this.groupedLayers[config.id] = newLayer
          this.cachedGroupCQLFilters[config.id] = cql
        }
      }
    }
  }

  // ==============================
  // 🟩 Capas normales
  // ==============================

  private async handleStandardLayers(layersState: Record<string, LayerState>) {
    const groupedParents = new Set(
      Array.from(this.configMap.values())
        .filter((config) => Boolean(config.groupBy))
        .map((config) => config.id)
    )

    for (const layerState of Object.values(layersState)) {
      const isGroupedChild = Boolean(
        layerState.parentLayer && groupedParents.has(layerState.parentLayer)
      )

      if (isGroupedChild) continue

      const config = this.configMap.get(layerState.id)
      if (!config) continue

      const existing = this.activeLayers[layerState.id]

      // Activar
      if (layerState.visible && !existing) {
        console.debug('[MapLayerManager] Activando capa', {
          layerId: layerState.id,
          layerType: config.type,
          temporal: Boolean(config.temporal),
        })

        // Limpiar selecciones al cambiar entre capas seleccionables
        if (isSelectableLayerId(layerState.id)) {
          this.interactionManager.clearAllSelections()
        }

        if (config.temporal) {
          await this.temporalLayerManager.loadTemporalDimension(config)
        }

        const layerStateObj = this.layersStore.layers[layerState.id] ?? layersState[layerState.id]

        const temporalParams = layerStateObj?.params
        const isRangeTemporal = config.temporalControlMode === 'range'
        const hasTemporalParams = isRangeTemporal
          ? Boolean(temporalParams?.from && temporalParams?.to)
          : Boolean(temporalParams?.time)

        // Si sigue sin parámetros temporales válidos → NO crear capa
        if (config.temporal && !hasTemporalParams) {
          console.debug('[MapLayerManager] Capa temporal sin time, no se crea capa todavía', {
            layerId: layerState.id,
          })
          continue
        }

        const canUseCache = !config.temporal

        const extraTemporalParams: Record<string, string> = {}

        if (isRangeTemporal) {
          if (temporalParams?.from) extraTemporalParams.from = temporalParams.from
          if (temporalParams?.to) extraTemporalParams.to = temporalParams.to
        } else if (temporalParams?.time) {
          extraTemporalParams.time = temporalParams.time
        }

        // Crear capa con callback de dblclick
        const layer =
          (canUseCache ? this.cache[layerState.id] : undefined) ??
          (await this.createLayerWithCallback(
            config,
            hasTemporalParams ? extraTemporalParams : {},
            layerState.id
          ))

        if (!layer) continue

        layer.addTo(this.map)

        this.interactionManager.attachVectorClick(layerState.id, layer)
        this.interactionManager.attachWMSClick(layerState.id, layer)

        if (isPrecipitacionLayerId(layerState.id)) {
          this.interactionManager.attachPrecipitacionClick(layerState.id, layer)
        }

        this.activeLayers[layerState.id] = layer
        if (config.temporal) {
          this.temporalLayerManager.registerInitialTemporalLayer(layerState.id, layer)
        }
        if (canUseCache) {
          this.cache[layerState.id] = layer
        }

        if (isSelectableLayerId(layerState.id)) {
          const pane = this.map.getPane(MAP_PANES.CONTORNO)
          if (pane) {
            pane.style.display = 'none'
          }
        }

        if (config.type === 'WMS') {
          const wmsConfig = config as WMSLayerConfig

          if (config.legend === 'efas') {
            const legendUrl = getLayerLegendUrl(wmsConfig.layers)

            this.legendManager.addLegend(config.id, legendUrl)
          } else {
            const customLegend = getCustomLegendInfo(wmsConfig)

            if (customLegend) {
              const legendUrl = getGeoServerLegendUrl({
                url: wmsConfig.url,
                layerName: wmsConfig.layers,
                styleName: wmsConfig.styles,
                format: wmsConfig.format,
              })

              await this.legendManager.addGradientLegend(config.id, {
                title: wmsConfig.name,
                legendUrl,
                units: customLegend.units,
              })
            } else {
              console.warn(
                '[MapLayerManager] WMS sin metadata para leyenda custom (no se añade leyenda)',
                {
                  layerId: wmsConfig.id,
                  styleName: wmsConfig.styles,
                }
              )
            }
          }
        }

        if (config.type === 'METEO_ACCUMULATED_IMAGE') {
          const meteoConfig = config as MeteoAccumulatedImageLayerConfig
          if (meteoConfig.legendUrl) {
            await this.legendManager.addGradientLegend(config.id, {
              title: config.name,
              legendUrl: meteoConfig.legendUrl,
              units: 'mm',
            })
          }
        }
      }

      // Desactivar
      if (!layerState.visible && existing) {
        // Si se apaga una capa seleccionable, limpiar cualquier seleccion residual
        if (isSelectableLayerId(layerState.id)) {
          this.interactionManager.clearAllSelections()
        } else {
          this.interactionManager.clearStyleManager(layerState.id)
        }

        this.interactionManager.detachWMSClick(layerState.id)

        if (isPrecipitacionLayerId(layerState.id)) {
          this.interactionManager.detachPrecipitacionClick(layerState.id)
        }

        this.temporalLayerManager.invalidateLayerGeneration(layerState.id)

        this.map.removeLayer(existing)
        delete this.activeLayers[layerState.id]

        this.temporalLayerManager.removeTemporalLayers(layerState.id)

        if (layerState.temporal) {
          layerState.temporal = undefined
        }

        if (layerState.temporalLoadState) {
          layerState.temporalLoadState = undefined
        }

        if (layerState.params?.time) {
          delete layerState.params.time
        }

        if (layerState.params?.from) {
          delete layerState.params.from
        }

        if (layerState.params?.to) {
          delete layerState.params.to
        }

        this.legendManager.removeLegend(layerState.id)

        if (isSelectableLayerId(layerState.id)) {
          // Solo restaurar CONTORNO si NO queda activo ninguno del grupo
          const anyGroupActive = Object.values(layersState).some(
            (l) => l.visible && isSelectableLayerId(l.id)
          )

          if (!anyGroupActive) {
            const pane = this.map.getPane(MAP_PANES.CONTORNO)
            if (pane) {
              pane.style.display = ''
            }
          }
        }
      }

      this.updateOpacityState(layerState)
      await this.temporalLayerManager.updateTimeState(layerState)
    }
  }

  // ==============================
  // 🎨 Actualizar opacidad
  // ==============================

  private updateOpacityState(layerState: LayerState) {
    const layer = this.activeLayers[layerState.id]
    const config = this.configMap.get(layerState.id)

    if (!layer) return

    if (config?.temporal) {
      this.temporalLayerManager.syncLayerOpacity(layerState.id, layerState.opacity)
    }

    if (layer instanceof L.GeoJSON) {
      const baseOpacity = config?.type === 'WFS' ? (config.style?.normal.opacity ?? 1) : 1
      const baseFillOpacity = config?.type === 'WFS' ? (config.style?.normal.fillOpacity ?? 1) : 1

      layer.setStyle({
        opacity: baseOpacity * layerState.opacity,
        fillOpacity: baseFillOpacity * layerState.opacity,
      })
    }

    if (layer instanceof L.TileLayer) {
      layer.setOpacity(layerState.opacity)
    }

    if (layer instanceof L.ImageOverlay) {
      layer.setOpacity(layerState.opacity)
    }
  }

  private handleFeatureClick(layerId: string, feature: GeoJSON.Feature) {
    switch (layerId) {
      case 'saih': {
        const props = (feature.properties ?? {}) as Record<string, unknown>
        const stationCode = String(props.stationCode ?? props.codigo ?? feature.id ?? '')
        const query = {
          ...router.currentRoute.value.query,
          station: stationCode,
        } as Record<string, string>

        router.replace({ query })
        break
      }

      case 'subcuencas': {
        const code = feature.properties?.code

        router.replace({
          query: {
            ...router.currentRoute.value.query,
            subcuenca: code,
          },
        })
        break
      }

      case 'sistemas10': {
        const sistema = feature.properties?.sistema

        router.replace({
          query: {
            ...router.currentRoute.value.query,
            sistema,
          },
        })
        break
      }

      case 'zonasexpl': {
        const zona = feature.properties?.ogc_fid

        console.log('zona', feature.properties)

        router.replace({
          query: {
            ...router.currentRoute.value.query,
            zona,
          },
        })
        break
      }

      case 'comarcasagrarias': {
        const comarca = feature.properties?.ds_comarca

        router.replace({
          query: {
            ...router.currentRoute.value.query,
            comarca,
          },
        })
        break
      }

      default:
    }
  }

  selectFeature(
    layerId: SelectableLayerId,
    featureId: string,
    options?: { focus?: boolean }
  ): boolean {
    return this.interactionManager.selectFeature(layerId, featureId, options)
  }

  /**
   * Envoltorio para createLayer que pasa el callback de dblclick
   */
  private async createLayerWithCallback(
    config: LayerConfig,
    extraParams: Record<string, string>,
    layerId: string
  ): Promise<L.Layer | null> {
    const callback = (feature: GeoJSON.Feature) => {
      this.handleFeatureClick(layerId, feature)
    }

    // Para capas WFS, pasamos el callback
    if (config.type === 'WFS') {
      return await createLayer(config, extraParams, callback)
    }

    // Para otras capas, creamos normal
    return await createLayer(config, extraParams)
  }

  private normalizePaneOrder() {
    Object.values(this.activeLayers).forEach((layer) => {
      if (layer instanceof L.GeoJSON) {
        layer.bringToBack()
      }
    })
  }
}
