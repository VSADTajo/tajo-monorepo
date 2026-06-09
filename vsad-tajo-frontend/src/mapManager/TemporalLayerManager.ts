import L from 'leaflet'
import { subHours, isAfter, parseISO, addHours } from 'date-fns'
import { createLayer } from '@/services/geoserver'
import { useLayersStore } from '@/stores/layersStore'
import { getLayerTimeDimension } from '@/services/efasWmsService'
import { getGeoServerLayerTimeDimension } from '@/services/geoserverWmsService'
import { getMeteoLayerTimeDimension } from '@/services/meteoService'
import { efas_url } from '@/config/efasConfig'
import type {
  LayerConfig,
  LayerState,
  MeteoAccumulatedImageLayerConfig,
  WMSLayerConfig,
} from '@/types/Layers'
import { LayerInteractionManager } from './LayerInteractionManager'
import { isPrecipitacionLayerId } from './layerConstants'

type LayerById = Record<string, L.Layer>
type TemporalLayerById = Record<string, Array<L.TileLayer.WMS | L.ImageOverlay>>
type GenerationById = Record<string, number>
type TemporalMapLayer = (L.TileLayer.WMS | L.ImageOverlay) & {
  __temporalReady?: boolean
  __temporalSignature?: string
}
type OpacityLayer = L.Layer & {
  setOpacity: (opacity: number) => L.Layer
  options?: { opacity?: number }
}
const DEBUG_TEMPORAL_WMS = true

function toIsoWithoutMilliseconds(value: Date): string {
  return value.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

function getTemporalParamSignature(layer: L.TileLayer.WMS): string | undefined {
  const params = (layer.wmsParams as unknown as Record<string, unknown>) ?? {}
  const time = params.time
  if (typeof time === 'string' && time.length) {
    return time
  }

  const from = params.from
  const to = params.to
  if (typeof from === 'string' && typeof to === 'string' && from.length && to.length) {
    return `${from}/${to}`
  }

  return undefined
}

function getTemporalLayerSignature(layer: L.Layer): string | undefined {
  if (layer instanceof L.TileLayer.WMS) {
    return getTemporalParamSignature(layer)
  }

  if (layer instanceof L.ImageOverlay) {
    const temporalSignature = (layer as TemporalMapLayer).__temporalSignature
    return typeof temporalSignature === 'string' && temporalSignature.length
      ? temporalSignature
      : undefined
  }

  return undefined
}

function isOpacityLayer(layer: L.Layer): layer is OpacityLayer {
  return typeof (layer as OpacityLayer).setOpacity === 'function'
}

export class TemporalLayerManager {
  private map: L.Map
  private configMap: Map<string, LayerConfig>
  private activeLayers: LayerById
  private temporalLayers: TemporalLayerById
  private layerGeneration: GenerationById
  private interactionManager: LayerInteractionManager
  private layersStore = useLayersStore()
  private fadingOutLayers: Record<string, L.Layer[]> = {}

  private debugLog(message: string, payload?: unknown): void {
    if (!DEBUG_TEMPORAL_WMS) return
    void message
    if (payload === undefined) {
      return
    }
  }

  constructor(
    map: L.Map,
    configMap: Map<string, LayerConfig>,
    activeLayers: LayerById,
    temporalLayers: TemporalLayerById,
    layerGeneration: GenerationById,
    interactionManager: LayerInteractionManager
  ) {
    this.map = map
    this.configMap = configMap
    this.activeLayers = activeLayers
    this.temporalLayers = temporalLayers
    this.layerGeneration = layerGeneration
    this.interactionManager = interactionManager
  }

  invalidateLayerGeneration(layerId: string): void {
    this.layerGeneration[layerId] = (this.layerGeneration[layerId] ?? 0) + 1
  }

  registerInitialTemporalLayer(layerId: string, layer: L.Layer): void {
    if (layer instanceof L.TileLayer.WMS || layer instanceof L.ImageOverlay) {
      this.registerTemporalLayer(layerId, layer as TemporalMapLayer)
    }
  }

  removeTemporalLayers(layerId: string): void {
    const fadingOut = this.fadingOutLayers[layerId]
    if (fadingOut?.length) {
      for (const fadingLayer of fadingOut) {
        this.map.removeLayer(fadingLayer)
      }
      delete this.fadingOutLayers[layerId]
    }

    const temporalList = this.temporalLayers[layerId]

    if (!temporalList?.length) {
      return
    }

    for (const layer of temporalList) {
      this.map.removeLayer(layer)
    }

    delete this.temporalLayers[layerId]
  }

  syncLayerOpacity(layerId: string, opacity: number): void {
    const targetOpacity = Math.max(0, Math.min(1, opacity))
    const touched = new Set<L.Layer>()

    const active = this.activeLayers[layerId]
    if (active && isOpacityLayer(active)) {
      active.setOpacity(targetOpacity)
      touched.add(active)
    }

    const temporalList = this.temporalLayers[layerId] ?? []
    for (const layer of temporalList) {
      if (!touched.has(layer) && isOpacityLayer(layer)) {
        layer.setOpacity(targetOpacity)
        touched.add(layer)
      }
    }

    const fadingList = this.fadingOutLayers[layerId] ?? []
    for (const layer of fadingList) {
      if (!touched.has(layer) && isOpacityLayer(layer)) {
        layer.setOpacity(targetOpacity)
        touched.add(layer)
      }
    }
  }

  async updateTimeState(layerState: LayerState): Promise<void> {
    if (!layerState.visible) {
      return
    }

    const current = this.activeLayers[layerState.id]

    if (!(current instanceof L.TileLayer.WMS) && !(current instanceof L.ImageOverlay)) {
      return
    }

    const config = this.configMap.get(layerState.id)
    if (!config) {
      return
    }

    const isRangeTemporal = config.temporalControlMode === 'range'
    const newTime = isRangeTemporal
      ? layerState.params?.from && layerState.params?.to
        ? `${layerState.params.from}/${layerState.params.to}`
        : undefined
      : layerState.params?.time

    if (!newTime) {
      return
    }

    const currentTime = getTemporalLayerSignature(current)

    this.debugLog('updateTimeState candidate', {
      layerId: layerState.id,
      currentTime,
      newTime,
      visible: layerState.visible,
    })

    if (currentTime === newTime) {
      return
    }

    const loadState = this.layersStore.layers[layerState.id]?.temporalLoadState
    if (loadState?.loading && loadState.requestedTime === newTime) {
      this.debugLog('skip updateTimeState (already loading same time)', {
        layerId: layerState.id,
        requestedTime: loadState.requestedTime,
      })
      return
    }

    this.layersStore.setTemporalLoadState(layerState.id, {
      requestedTime: newTime,
      loadedTime: undefined,
      loading: true,
    })

    this.debugLog('setTemporalLoadState loading=true', {
      layerId: layerState.id,
      requestedTime: newTime,
    })

    const layerParams = layerState.params ?? {}
    const targetOpacity = Math.max(0, Math.min(1, layerState.opacity ?? 1))

    const createdLayer =
      this.findTemporalLayer(layerState.id, newTime) ??
      (await createLayer(
        config,
        isRangeTemporal
          ? { from: layerParams.from ?? '', to: layerParams.to ?? '' }
          : { time: newTime }
      ))

    if (!(createdLayer instanceof L.TileLayer.WMS) && !(createdLayer instanceof L.ImageOverlay)) {
      this.layersStore.setTemporalLoadState(layerState.id, {
        loading: false,
      })
      this.debugLog('createLayer failed or non-WMS', {
        layerId: layerState.id,
        requestedTime: newTime,
      })
      return
    }

    const newLayer = createdLayer as TemporalMapLayer
    newLayer.__temporalSignature = newTime

    newLayer.setOpacity(0)
    if (!this.map.hasLayer(newLayer)) {
      newLayer.addTo(this.map)
    }

    this.registerTemporalLayer(layerState.id, newLayer)

    const generation = this.nextGeneration(layerState.id)

    const activateLayer = () => {
      if (this.layerGeneration[layerState.id] !== generation) {
        this.debugLog('skip activateLayer due generation mismatch', {
          layerId: layerState.id,
          generation,
          currentGeneration: this.layerGeneration[layerState.id],
          requestedTime: newTime,
        })
        return
      }

      if (!layerState.visible) {
        this.map.removeLayer(newLayer)
        return
      }

      this.fadeLayer(newLayer, targetOpacity)
      if (!this.fadingOutLayers[layerState.id]) {
        this.fadingOutLayers[layerState.id] = []
      }
      if (!this.fadingOutLayers[layerState.id].includes(current)) {
        this.fadingOutLayers[layerState.id].push(current)
      }
      this.fadeLayer(current, 0, () => {
        this.map.removeLayer(current)
        const fadingList = this.fadingOutLayers[layerState.id]
        if (!fadingList?.length) {
          return
        }

        this.fadingOutLayers[layerState.id] = fadingList.filter((item) => item !== current)
        if (!this.fadingOutLayers[layerState.id].length) {
          delete this.fadingOutLayers[layerState.id]
        }
      })

      this.activeLayers[layerState.id] = newLayer
      this.interactionManager.detachWMSClick(layerState.id)
      this.interactionManager.attachWMSClick(layerState.id, newLayer)

      this.layersStore.setTemporalLoadState(layerState.id, {
        requestedTime: newTime,
        loadedTime: newTime,
        loading: false,
      })

      this.debugLog('activateLayer completed', {
        layerId: layerState.id,
        loadedTime: newTime,
      })

      if (isPrecipitacionLayerId(layerState.id)) {
        this.interactionManager.detachPrecipitacionClick(layerState.id)
        this.interactionManager.attachPrecipitacionClick(layerState.id, newLayer)
      }

      if (newLayer instanceof L.TileLayer.WMS) {
        void this.prefetchNextTemporalLayer(layerState, config, newTime)
      }
    }

    if (newLayer.__temporalReady) {
      activateLayer()
      return
    }

    newLayer.once('load', () => {
      newLayer.__temporalReady = true
      activateLayer()
    })
  }

  async loadTemporalDimension(config: LayerConfig): Promise<void> {
    if (config.type !== 'WMS' && config.type !== 'METEO_ACCUMULATED_IMAGE') {
      return
    }

    const layer = this.layersStore.layers[config.id]

    if (!layer) {
      return
    }

    if (layer.temporal && (layer.params?.time || (layer.params?.from && layer.params?.to))) {
      return
    }

    try {
      if (layer.temporal && !layer.params?.time && !(layer.params?.from && layer.params?.to)) {
        const existingTemporal = layer.temporal
        const existingStart = parseISO(existingTemporal.start)
        const existingEnd = parseISO(existingTemporal.end)
        const isRangeTemporal = config.temporalControlMode === 'range'

        if (isRangeTemporal) {
          layer.params = {
            ...layer.params,
            from: toIsoWithoutMilliseconds(existingStart),
            to: toIsoWithoutMilliseconds(existingEnd),
          }
        } else {
          layer.params = {
            ...layer.params,
            time: toIsoWithoutMilliseconds(existingStart),
          }
        }

        layer.temporalLoadState = {
          requestedTime: layer.params.time ?? `${layer.params.from}/${layer.params.to}`,
          loadedTime: undefined,
          loading: false,
        }

        this.debugLog(
          'loadTemporalDimension restored missing temporal params from existing state',
          {
            layerId: config.id,
            initialParamTime: layer.params.time,
            initialFrom: layer.params.from,
            initialTo: layer.params.to,
          }
        )

        return
      }

      let timeDimension: { start: string; end: string; stepHours: number } | null = null

      if (config.type === 'METEO_ACCUMULATED_IMAGE') {
        timeDimension = await getMeteoLayerTimeDimension(config as MeteoAccumulatedImageLayerConfig)
      } else {
        const wmsConfig = config as WMSLayerConfig
        timeDimension =
          wmsConfig.url === efas_url
            ? await getLayerTimeDimension(wmsConfig.layers)
            : await getGeoServerLayerTimeDimension({
                url: wmsConfig.url,
                layerName: wmsConfig.layers,
              })
      }

      if (!timeDimension) {
        return
      }

      const startDate = config.start ? parseISO(config.start) : parseISO(timeDimension.start)
      const endDate = parseISO(timeDimension.end)
      const safeStart = isAfter(startDate, endDate)
        ? subHours(endDate, 10 * timeDimension.stepHours)
        : startDate

      const isRangeTemporal = config.temporalControlMode === 'range'
      const hasRealRange = isAfter(endDate, safeStart)
      const rangeEnd = hasRealRange ? endDate : safeStart
      const instantEnd = subHours(endDate, timeDimension.stepHours)

      if (isRangeTemporal && !hasRealRange) {
        console.warn(
          '[TemporalLayerManager] Capa range con una unica fecha publicada por backend (from=to)',
          {
            layerId: config.id,
            layerName: config.type === 'WMS' ? (config as WMSLayerConfig).layers : config.id,
            backendStart: timeDimension.start,
            backendEnd: timeDimension.end,
            backendStepHours: timeDimension.stepHours,
            appliedFrom: toIsoWithoutMilliseconds(safeStart),
            appliedTo: toIsoWithoutMilliseconds(rangeEnd),
          }
        )
      }

      layer.temporal = {
        start: toIsoWithoutMilliseconds(safeStart),
        end: toIsoWithoutMilliseconds(isRangeTemporal ? rangeEnd : instantEnd),
        stepHours: timeDimension.stepHours,
      }

      if (isRangeTemporal) {
        layer.params = {
          ...layer.params,
          from: toIsoWithoutMilliseconds(safeStart),
          to: toIsoWithoutMilliseconds(rangeEnd),
        }
      } else {
        layer.params = {
          ...layer.params,
          time: toIsoWithoutMilliseconds(safeStart),
        }
      }

      layer.temporalLoadState = {
        requestedTime: layer.params.time ?? `${layer.params.from}/${layer.params.to}`,
        loadedTime: undefined,
        loading: false,
      }

      this.debugLog('loadTemporalDimension initialized', {
        layerId: config.id,
        timeDimension,
        safeStartIso: toIsoWithoutMilliseconds(safeStart),
        safeEndIso: toIsoWithoutMilliseconds(isRangeTemporal ? rangeEnd : instantEnd),
        initialParamTime: layer.params.time,
        initialFrom: layer.params.from,
        initialTo: layer.params.to,
      })
    } catch (err) {
      console.error('Error loading temporal dimension', err)
    }
  }

  private nextGeneration(layerId: string): number {
    const nextValue = (this.layerGeneration[layerId] ?? 0) + 1
    this.layerGeneration[layerId] = nextValue
    return nextValue
  }

  private findTemporalLayer(layerId: string, time: string): TemporalMapLayer | undefined {
    const temporalList = this.temporalLayers[layerId]

    return temporalList?.find((layer) => {
      const currentTime = getTemporalLayerSignature(layer)
      return currentTime === time
    }) as TemporalMapLayer | undefined
  }

  private registerTemporalLayer(layerId: string, layer: TemporalMapLayer): void {
    if (!this.temporalLayers[layerId]) {
      this.temporalLayers[layerId] = []
    }

    const temporalList = this.temporalLayers[layerId]
    const activeLayer = this.activeLayers[layerId]

    if (!temporalList.includes(layer)) {
      temporalList.push(layer)
    }

    // Mantener solo 2 capas temporales sin expulsar la capa visible actual.
    while (temporalList.length > 2) {
      let removableIndex = temporalList.findIndex(
        (candidate) => candidate !== activeLayer && candidate !== layer
      )

      if (removableIndex === -1) {
        removableIndex = temporalList.findIndex((candidate) => candidate !== activeLayer)
      }

      if (removableIndex === -1) {
        this.debugLog('skip temporal eviction to avoid removing active layer', {
          layerId,
          temporalCount: temporalList.length,
        })
        break
      }

      const [removable] = temporalList.splice(removableIndex, 1)
      if (removable) {
        this.debugLog('evict temporal cached layer', {
          layerId,
          activeTime: getTemporalLayerSignature(activeLayer as L.Layer),
          evictedTime: getTemporalLayerSignature(removable),
        })
        this.map.removeLayer(removable)
      }
    }
  }

  private async prefetchNextTemporalLayer(
    layerState: LayerState,
    config: LayerConfig,
    currentTime: string
  ): Promise<void> {
    if (config.temporalControlMode === 'range') {
      return
    }

    if (!layerState.temporal || currentTime.includes('/')) {
      return
    }

    const currentDate = parseISO(currentTime)
    const nextDate = addHours(currentDate, layerState.temporal.stepHours)
    const endDate = parseISO(layerState.temporal.end)

    if (isAfter(nextDate, endDate)) {
      return
    }

    const nextTime = nextDate.toISOString()

    this.debugLog('prefetch next temporal layer', {
      layerId: layerState.id,
      fromTime: currentTime,
      nextTime,
    })

    if (this.findTemporalLayer(layerState.id, nextTime)) {
      return
    }

    const prefetchedLayer = await createLayer(config, { time: nextTime })

    if (!(prefetchedLayer instanceof L.TileLayer.WMS)) {
      return
    }

    const temporalLayer = prefetchedLayer as TemporalMapLayer
    temporalLayer.__temporalReady = false
    temporalLayer.__temporalSignature = nextTime
    temporalLayer.setOpacity(0)
    temporalLayer.addTo(this.map)

    this.registerTemporalLayer(layerState.id, temporalLayer)

    temporalLayer.once('load', () => {
      temporalLayer.__temporalReady = true
    })
  }

  private fadeLayer(layer: L.Layer, targetOpacity: number, onEnd?: () => void): void {
    if (!isOpacityLayer(layer)) {
      onEnd?.()
      return
    }

    let opacity = layer.options.opacity ?? 1
    const step = targetOpacity > opacity ? 0.1 : -0.1

    const interval = setInterval(() => {
      opacity += step

      if ((step > 0 && opacity >= targetOpacity) || (step < 0 && opacity <= targetOpacity)) {
        layer.setOpacity(targetOpacity)
        clearInterval(interval)
        onEnd?.()
        return
      }

      layer.setOpacity(Math.max(0, Math.min(1, opacity)))
    }, 50)
  }
}
