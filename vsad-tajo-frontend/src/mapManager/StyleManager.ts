import L from 'leaflet'
import { MAP_PANES } from '@/config/panes/mapPanes'
import type { LayerStyle } from '@/types/Layers'

export type LayerWithMap = L.Layer & {
  _map?: L.Map
}

export class StyleManager {
  private highlightLayer: L.GeoJSON | null = null
  private selectedLayer: L.GeoJSON | null = null
  private selectedFeatureId: string | null = null
  private layerId: string
  private style: LayerStyle | undefined
  private isSelectableLayer: boolean
  private onDblClick: ((feature: GeoJSON.Feature) => void) | null = null
  private lastClickTimestamp: number = 0
  private buildPopupContent: ((feature: GeoJSON.Feature) => string) | null = null

  private getTooltipAccentColor(): string {
    if (this.layerId === 'subcuencas') return '#8d5d26'
    if (this.layerId === 'sistemas10') return '#33a02c'
    if (this.layerId === 'zonasexpl') return '#1f78b4'
    if (this.layerId === 'comarcasagrarias') return '#aa3c3c'
    return '#ffffff'
  }

  private buildTooltipWrapper(content: string): string {
    const notchColor = this.getTooltipAccentColor()

    return `
      <div style="position:relative;display:inline-block;width:max-content;max-width:calc(100vw - 48px);padding-bottom:10px;font-family:Montserrat,sans-serif;white-space:normal;">
        <div style="border-radius:12px;overflow:hidden;box-shadow:0 8px 20px rgba(0,0,0,0.16)">
          ${content}
        </div>
        <div style="position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:0;height:0;border-left:9px solid transparent;border-right:9px solid transparent;border-top:10px solid ${notchColor};filter:drop-shadow(0 2px 2px rgba(0,0,0,0.12));"></div>
      </div>
    `
  }

  constructor(
    layerId: string,
    style: LayerStyle | undefined,
    isSelectable: boolean,
    onDblClick?: (feature: GeoJSON.Feature) => void,
    buildPopupContent?: (feature: GeoJSON.Feature) => string
  ) {
    this.layerId = layerId
    this.style = style
    this.isSelectableLayer = isSelectable
    this.onDblClick = onDblClick || null
    this.buildPopupContent = buildPopupContent || null
  }

  private listenersAttached: boolean = false

  /**
   * Attach all style listeners (hover, click) a un layer de GeoJSON
   */
  attachStyleListeners(geojsonLayer: L.GeoJSON, map: L.Map): void {
    // Evitar duplicar listeners si ya se adjuntaron
    if (this.listenersAttached) {
      return
    }
    this.listenersAttached = true

    geojsonLayer.eachLayer((layer: L.Layer) => {
      const isPath = layer instanceof L.Path
      const isMarker = layer instanceof L.Marker

      if (!isPath && !isMarker) return

      const feature = (layer as (L.Path | L.Marker) & { feature?: GeoJSON.Feature }).feature as
        | GeoJSON.Feature
        | undefined
      if (!feature) return

      const featureId = this.getFeatureId(feature)

      // Mouseover: mostrar highlight (solo para Path, markers ya tienen hover en geoserver.ts)
      if (isPath) {
        // Bind tooltip una sola vez durante setup para evitar flicker del popup sobre el poligono.
        if (this.buildPopupContent) {
          const popupContent = this.buildTooltipWrapper(this.buildPopupContent(feature))
          layer.bindTooltip(popupContent, {
            permanent: false,
            sticky: true,
            direction: 'top',
            className: 'feature-hover-tooltip',
            offset: L.point(0, -8),
            opacity: 1,
          })
        }

        layer.on('mouseover', () => {
          // Si quedó selectedFeatureId sin selectedLayer en mapa, resetear estado huérfano
          if (
            this.selectedFeatureId &&
            (!this.selectedLayer || !map.hasLayer(this.selectedLayer))
          ) {
            this.selectedFeatureId = null
            this.selectedLayer = null
          }

          // No mostrar highlight si es la feature seleccionada y sigue seleccionada en mapa
          if (
            featureId === this.selectedFeatureId &&
            this.selectedLayer &&
            map.hasLayer(this.selectedLayer)
          ) {
            return
          }

          this.clearHighlight()

          if (!this.style?.highlight) {
            return
          }

          this.highlightLayer = L.geoJSON(feature as GeoJSON.GeoJsonObject, {
            style: this.style.highlight,
            pane: MAP_PANES.HIGHLIGHT,
            interactive: false,
          })

          this.highlightLayer.addTo(map)

          // Abrir tooltip si está vinculado
          if (layer instanceof L.Path && layer.getTooltip()) {
            layer.openTooltip()
          }
        })

        // Mouseout: limpiar highlight y cerrar tooltip
        layer.on('mouseout', () => {
          this.clearHighlight()

          // Cerrar tooltip si está abierto
          if (layer instanceof L.Path && layer.getTooltip()) {
            layer.closeTooltip()
          }
        })
      }
      // Click: seleccionar feature (o navegar si no es seleccionable)
      layer.on('click', (e: L.LeafletMouseEvent) => {
        if (e.originalEvent) {
          e.originalEvent.preventDefault()
        }
        this.lastClickTimestamp = Date.now()

        if (!this.isSelectableLayer) {
          // Para capas no seleccionables (SAIH): click directo = navegar

          if (this.onDblClick) {
            this.onDblClick(feature)
          }
          return
        }

        // Para capas seleccionables: click = seleccionar visualmente
        this.selectFeature(feature, featureId, map)
      })

      // Dblclick: navegar a ruta (solo en capas seleccionables)
      if (this.isSelectableLayer && isPath) {
        layer.on('dblclick', (e: L.LeafletMouseEvent) => {
          L.DomEvent.stop(e)

          if (this.onDblClick) {
            this.onDblClick(feature)
          }
        })
      }
    })
  }

  /**
   * Selecciona una feature y aplica estilo
   */
  private selectFeature(
    feature: GeoJSON.Feature,
    featureId: string,
    map: L.Map,
    options?: { focus?: boolean }
  ): void {
    // Si quedó estado huérfano por una limpieza externa, reiniciarlo antes de seleccionar
    if (!this.selectedLayer && this.selectedFeatureId) {
      this.selectedFeatureId = null
    }

    // Limpiar selección anterior
    this.clearSelection()

    // Crear nueva selección
    this.selectedLayer = L.geoJSON(feature as GeoJSON.GeoJsonObject, {
      style: this.style?.selected || this.style?.highlight,
      pane: MAP_PANES.SELECTION,
      interactive: false,
    })

    this.selectedLayer.addTo(map)
    this.selectedFeatureId = featureId

    // FlyTo
    const bounds = this.selectedLayer.getBounds()
    if (options?.focus !== false && bounds && bounds.isValid()) {
      map.flyTo(bounds.getCenter(), 10, { animate: true, duration: 0.8 })
    }
  }

  /**
   * Limpia el highlight (hover)
   */
  private clearHighlight(): void {
    if (this.highlightLayer) {
      this.highlightLayer.remove()
      this.highlightLayer = null
    }
  }

  /**
   * Limpia la selección
   */
  private clearSelection(): void {
    if (this.selectedLayer) {
      this.selectedLayer.remove()
      this.selectedLayer = null
    }

    // Resetear siempre el ID seleccionado aunque no exista layer referenciado
    this.selectedFeatureId = null
  }

  clearAll(): void {
    this.clearHighlight()
    this.clearSelection()
  }

  /**
   * Obtiene ID único de una feature
   */
  private getFeatureId(feature: GeoJSON.Feature): string {
    const props = feature.properties ?? {}
    let id: unknown

    if (this.layerId === 'subcuencas') {
      id = props['code'] ?? props['codigo'] ?? props['id'] ?? feature.id
    } else if (this.layerId === 'sistemas10') {
      id = props['sistema'] ?? props['fid'] ?? props['id'] ?? feature.id
    } else if (this.layerId === 'zonasexpl') {
      id = props['ogc_fid'] ?? props['id'] ?? feature.id
    } else if (this.layerId === 'comarcasagrarias') {
      id = props['ogc_fid'] ?? props['co_comarca'] ?? props['fid'] ?? props['id'] ?? feature.id
    } else {
      id =
        props['code'] ??
        props['codigo'] ??
        props['ogc_fid'] ??
        props['fid'] ??
        props['id'] ??
        feature.id ??
        props['sistema'] ??
        props['ds_comarca'] ??
        props['comarca'] ??
        props['nombre'] ??
        props['name']
    }

    if (id != null && String(id).trim() !== '') {
      return String(id)
    }

    return JSON.stringify(feature.geometry ?? 'unknown')
  }

  /**
   * Obtiene ID de la feature seleccionada
   */
  getSelectedFeatureId(): string | null {
    return this.selectedFeatureId
  }

  selectFeatureById(
    featureId: string,
    geojsonLayer: L.GeoJSON,
    map: L.Map,
    options?: { focus?: boolean }
  ): boolean {
    let found = false

    geojsonLayer.eachLayer((layer: L.Layer) => {
      const feature = (layer as (L.Path | L.Marker) & { feature?: GeoJSON.Feature }).feature as
        | GeoJSON.Feature
        | undefined

      if (!feature || found) return

      const currentFeatureId = this.getFeatureId(feature)
      if (currentFeatureId !== featureId) return

      this.selectFeature(feature, featureId, map, options)
      found = true
    })

    return found
  }

  /**
   * Verifica si el último click fue manejado por este StyleManager (dentro de los últimos 100ms)
   */
  wasLastClickHandled(): boolean {
    return Date.now() - this.lastClickTimestamp < 100
  }
}
