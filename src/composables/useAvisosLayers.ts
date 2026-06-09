import { watch } from 'vue'
import L from 'leaflet'
import { useAvisosStore } from '@/stores/avisosStore'
import type { AvisoFeature } from '@/stores/avisosStore'
import { MAP_PANES } from '@/config/panes/mapPanes'
import router from '@/router'

export function useAvisosLayers(map: L.Map) {
  const avisosStore = useAvisosStore()

  let avisosLayer: L.FeatureGroup | null = null
  let lastFeatureInteractionAt = 0

  const AVISO_WEIGHT = 2
  const SELECTED_AVISO_WEIGHT = 3

  function escapeHtml(value: unknown): string {
    return String(value ?? '-')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;')
  }

  function getLevelBadge(level: string): string {
    const normalizedLevel = level.toLowerCase()

    if (normalizedLevel === 'rojo') {
      return '<span style="display:inline-flex;align-items:center;padding:2px 8px;border-radius:999px;background:#ef4444;color:#fff;font-weight:700">Rojo</span>'
    }

    if (normalizedLevel === 'naranja') {
      return '<span style="display:inline-flex;align-items:center;padding:2px 8px;border-radius:999px;background:#f97316;color:#fff;font-weight:700">Naranja</span>'
    }

    if (normalizedLevel === 'amarillo') {
      return '<span style="display:inline-flex;align-items:center;padding:2px 8px;border-radius:999px;background:#fde047;color:#1f2937;font-weight:700">Amarillo</span>'
    }

    if (normalizedLevel === 'verde') {
      return '<span style="display:inline-flex;align-items:center;padding:2px 8px;border-radius:999px;background:#4ade80;color:#14532d;font-weight:700">Verde</span>'
    }

    return `<span style="display:inline-flex;align-items:center;padding:2px 8px;border-radius:999px;background:#e5e7eb;color:#374151;font-weight:700">${escapeHtml(level || 'N/A')}</span>`
  }

  function buildAvisoTooltipContent(props: Record<string, unknown>): string {
    const areaDesc = escapeHtml(props.areaDesc ?? '-')
    const level = String(props.level ?? 'N/A')
    const severity = escapeHtml(props.severity ?? '-')
    const effective = String(props.effective ?? '')
    const expires = String(props.expires ?? '')

    const effectiveDate = effective ? new Date(effective).toLocaleString('es-ES') : '-'
    const expiresDate = expires ? new Date(expires).toLocaleString('es-ES') : '-'
    const levelBadge = getLevelBadge(level)

    return `
      <div style="position:relative;display:inline-block;width:max-content;max-width:calc(100vw - 48px);padding-bottom:10px;font-family:Montserrat,sans-serif;white-space:normal;">
        <div style="border-radius:12px;overflow:hidden;box-shadow:0 8px 20px rgba(0,0,0,0.16)">
          <div style="padding:10px 12px;background:linear-gradient(135deg, #0f4c81 0%, #0b365c 100%);color:#fff">
            <div style="font-size:14px;font-weight:700;line-height:1.25">${areaDesc}</div>
          </div>
          <div style="padding:10px 12px;background:#fff;color:#1f2937;font-size:12px;line-height:1.45">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px">
              <strong>Nivel</strong>
              ${levelBadge}
            </div>
            <div style="margin-bottom:4px"><strong>Severidad:</strong> ${severity}</div>
            <div style="margin-bottom:4px"><strong>Desde:</strong> ${escapeHtml(effectiveDate)}</div>
            <div><strong>Hasta:</strong> ${escapeHtml(expiresDate)}</div>
          </div>
        </div>
        <div style="position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:0;height:0;border-left:9px solid transparent;border-right:9px solid transparent;border-top:10px solid #ffffff;filter:drop-shadow(0 2px 2px rgba(0,0,0,0.12));">
        </div>
      </div>
    `
  }

  const createGeoJSONStyle = (properties: Record<string, unknown>, isSelected: boolean) => {
    const levelColor = getLevelColor(String(properties.level ?? ''))

    return {
      color: isSelected ? '#FF0000' : levelColor,
      weight: isSelected ? SELECTED_AVISO_WEIGHT : AVISO_WEIGHT,
      opacity: 0.8,
      fillOpacity: 0.2,
      fillColor: isSelected ? '#FF0000' : levelColor,
    }
  }

  const getLevelColor = (level: string): string => {
    const colorMap: Record<string, string> = {
      verde: '#00AA00',
      amarillo: '#FFFF00',
      naranja: '#FFA500',
      rojo: '#FF0000',
    }
    return colorMap[level?.toLowerCase()] || '#FFA500'
  }

  const getAvisoFeatureId = (properties: Record<string, unknown>): string | null => {
    const areaDesc = String(properties.areaDesc ?? '').trim()
    return areaDesc || null
  }

  const isAvisoInInterval = (aviso: AvisoFeature): boolean => {
    try {
      // Si faltan fechas de vigencia, no se muestra
      if (!aviso.properties?.effective || !aviso.properties?.expires) {
        return false
      }

      const intervalStart = new Date(avisosStore.selectedIntervalStart).getTime()
      const intervalEnd = intervalStart + 6 * 60 * 60 * 1000 // 6 horas después

      const avisoEffective = new Date(String(aviso.properties.effective ?? '')).getTime()
      const avisoExpires = new Date(String(aviso.properties.expires ?? '')).getTime()

      if (!Number.isFinite(avisoEffective) || !Number.isFinite(avisoExpires)) {
        return false
      }

      // Solape estricto entre vigencia del aviso y el intervalo seleccionado
      return avisoEffective < intervalEnd && avisoExpires > intervalStart
    } catch (error) {
      console.warn('[useAvisosLayers] Error checking aviso interval:', error)
      return false
    }
  }

  const clearAvisoLayer = () => {
    if (avisosLayer) {
      map.removeLayer(avisosLayer)
      avisosLayer = null
    }
  }

  const addAvisoLayers = () => {
    clearAvisoLayer()

    if (!avisosStore.avisos || avisosStore.avisos.length === 0 || !avisosStore.selectedTipo) {
      console.log('[useAvisosLayers] No avisos to display', {
        hasAvisos: !!avisosStore.avisos,
        length: avisosStore.avisos?.length,
        selectedTipo: avisosStore.selectedTipo,
      })
      return
    }

    // Filtrar avisos que están en el intervalo de fecha seleccionado
    const avisosInInterval = avisosStore.avisos.filter((f) => {
      const isFeature = f.type === 'Feature'
      const isInInterval = isAvisoInInterval(f)

      if (!isFeature) {
        console.warn('[useAvisosLayers] Aviso is not a Feature:', f)
      }

      return isFeature && isInInterval
    })

    console.log('[useAvisosLayers] Filtered avisos:', {
      total: avisosStore.avisos.length,
      filtered: avisosInInterval.length,
      selectedTipo: avisosStore.selectedTipo,
      selectedInterval: avisosStore.selectedIntervalStart,
      avisosList: avisosInInterval.map((a) => ({
        identifier: a.properties?.identifier,
        headline: a.properties?.headline,
        effective: a.properties?.effective,
        expires: a.properties?.expires,
      })),
    })

    if (avisosInInterval.length === 0) {
      console.warn('[useAvisosLayers] No avisos passed the interval filter')
      return
    }

    // Crear GeoJSON FeatureCollection con todos los avisos
    const featureCollection = {
      type: 'FeatureCollection' as const,
      features: avisosInInterval,
    }

    // Crear una sola capa GeoJSON con todos los avisos
    avisosLayer = L.geoJSON(featureCollection, {
      pane: MAP_PANES.AVISOS,
      style: (feature) => {
        const properties = (feature?.properties || {}) as Record<string, unknown>
        const featureId = getAvisoFeatureId(properties)
        const isSelected = featureId !== null && featureId === avisosStore.selectedAvisoId
        return createGeoJSONStyle(properties, isSelected)
      },
      onEachFeature: (feature, layer) => {
        const props = (feature.properties || {}) as Record<string, unknown>
        const featureId = getAvisoFeatureId(props)
        const isSelected = featureId !== null && featureId === avisosStore.selectedAvisoId
        const baseStyle = createGeoJSONStyle(props, isSelected)
        const hoverStyle = {
          ...baseStyle,
          weight: baseStyle.weight + 1,
          fillOpacity: Math.min(baseStyle.fillOpacity + 0.12, 0.6),
          opacity: 1,
        }

        const tooltipContent = buildAvisoTooltipContent(props)

        if (layer instanceof L.Path) {
          layer.bindTooltip(tooltipContent, {
            permanent: false,
            sticky: true,
            direction: 'top',
            className: 'feature-hover-tooltip',
            offset: L.point(0, -8),
            opacity: 1,
          })
        }

        if (layer instanceof L.Path) {
          layer.on('mouseover', () => {
            layer.setStyle(hoverStyle)
            if (layer.getTooltip()) {
              layer.openTooltip()
            }
          })

          layer.on('mouseout', () => {
            layer.setStyle(baseStyle)
            if (layer.getTooltip()) {
              layer.closeTooltip()
            }
          })
        }

        layer.on('click', () => {
          lastFeatureInteractionAt = Date.now()
          console.log('[useAvisosLayers] Aviso clicked:', featureId)
          if (!featureId) return
          avisosStore.selectAvisoFeature(featureId)

          if (layer instanceof L.Polygon || layer instanceof L.Polyline) {
            const bounds = layer.getBounds()
            if (bounds.isValid()) {
              map.fitBounds(bounds, {
                padding: [40, 40],
                animate: true,
                duration: 0.8,
              })
            }
          }
        })

        if (layer instanceof L.Path) {
          layer.on('dblclick', (e: L.LeafletMouseEvent) => {
            lastFeatureInteractionAt = Date.now()
            L.DomEvent.stop(e)
            if (!featureId) return

            const queryObj = {
              ...router.currentRoute.value.query,
              aviso: featureId,
            }

            router.replace({ query: queryObj })
          })
        }
      },
    })

    console.log('[useAvisosLayers] Adding layer to map with', avisosInInterval.length, 'avisos')
    avisosLayer.addTo(map)
    console.log('[useAvisosLayers] Layer added successfully')
  }

  map.on('click', () => {
    // Ignorar el click de mapa que burbujea justo después de clicar una feature
    if (Date.now() - lastFeatureInteractionAt < 120) {
      return
    }

    if (avisosStore.selectedAvisoId) {
      avisosStore.clearSelectedAvisoFeature()
    }

    if (router.currentRoute.value.query.aviso) {
      const queryObj = { ...router.currentRoute.value.query }
      delete queryObj.aviso
      router.replace({ query: queryObj })
    }
  })

  // Watch de avisos, selectedAvisoId e intervalo de fecha
  watch(
    () => [avisosStore.avisos, avisosStore.selectedAvisoId, avisosStore.selectedIntervalStart],
    () => {
      console.log('[useAvisosLayers] Watch triggered')
      addAvisoLayers()
    },
    { deep: true }
  )

  // Limpiar al desmontar o cuando se vacían los avisos
  watch(
    () => avisosStore.selectedTipo,
    (newTipo) => {
      if (!newTipo) {
        console.log('[useAvisosLayers] Clearing avisos layer')
        clearAvisoLayer()
      }
    }
  )

  return {
    clearAvisoLayer,
    addAvisoLayers,
  }
}
