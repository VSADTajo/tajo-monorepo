import L from 'leaflet'
import type { Feature } from 'geojson'
import type { LayerStyle } from '@/types/Layers'
import { getSaihTypeColor } from '@/utils/saihStations'
import { MAP_PANES } from '@/config/panes/mapPanes'
import { getSaihAlertInfo } from '@/utils/saihAlerts'

function getFeatureKey(feature: Feature): string {
  const props = feature.properties ?? {}
  const keyFromProps =
    props.codigo ?? props.code ?? props.id ?? props.ogc_fid ?? props.nombre ?? props.name

  if (keyFromProps != null) return String(keyFromProps)

  if (feature.id != null) return String(feature.id)

  return JSON.stringify(feature.geometry)
}

function getAlertBackground(feature: Feature): string | null {
  const featureKey = getFeatureKey(feature)
  if (!featureKey) return null

  return getSaihAlertInfo(feature).backgroundColor
}

export const saihPointStyle = (feature: Feature, latlng: L.LatLng) => {
  const props = (feature.properties ?? {}) as Record<string, unknown>
  const tipo = String(props.tipoCod ?? props.tipo_cod ?? '').toUpperCase()
  const color = getSaihTypeColor(tipo)
  const alertBackground = getAlertBackground(feature)

  const safeTipo = tipo.replace(/[^A-Z0-9]/g, '') || 'NA'
  const bgStyle = alertBackground ? `;--saih-bg:${alertBackground}` : ''

  const marker = L.marker(latlng, {
    icon: L.divIcon({
      className: 'saih-marker-wrapper',
      html: `<div class="saih-marker" style="--saih-color:${color}${bgStyle}">${safeTipo}</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    }),
    pane: MAP_PANES.SAIH,
    riseOnHover: true,
  })

  return marker
}

export const contornoStyle: LayerStyle = {
  normal: {
    color: '#203d1c',
    weight: 2,
    fillColor: '#203d1c85',
    fillOpacity: 0.38,
  },
  highlight: {
    color: '#203d1c',
    weight: 2,
    fillColor: '#203d1c',
    fillOpacity: 0.38,
  },
}

export const subcuencasStyle: LayerStyle = {
  normal: {
    color: '#8d5d26',
    weight: 2,
    fillColor: '#ec9c41',
    fillOpacity: 0.5,
  },
  highlight: {
    color: '#5c3a10',
    weight: 3,
    fillColor: '#ec9c41',
    fillOpacity: 0.55,
  },
  selected: {
    color: '#1f7a1f',
    weight: 3,
    fillColor: '#49b24a',
    fillOpacity: 0.5,
  },
}

export const sistemas10Style: LayerStyle = {
  normal: {
    color: '#33a02c',
    weight: 2,
    fillColor: '#b2df8a',
    fillOpacity: 0.2,
  },
  highlight: {
    color: '#1a5c16',
    weight: 3,
    fillColor: '#b2df8a',
    fillOpacity: 0.55,
  },
  selected: {
    color: '#1f7a1f',
    weight: 3,
    fillColor: '#49b24a',
    fillOpacity: 0.5,
  },
}

export const zonasexplStyle: LayerStyle = {
  normal: {
    color: '#1f78b4',
    weight: 2,
    fillColor: '#a0c8e2',
    fillOpacity: 0.2,
  },
  highlight: {
    color: '#0d4a75',
    weight: 3,
    fillColor: '#a0c8e2',
    fillOpacity: 0.55,
  },
  selected: {
    color: '#1f7a1f',
    weight: 3,
    fillColor: '#49b24a',
    fillOpacity: 0.5,
  },
}

export const comarcasagrariasStyle: LayerStyle = {
  normal: {
    color: '#aa3c3c',
    weight: 2,
    fillColor: '#976363',
    fillOpacity: 0.2,
  },
  highlight: {
    color: '#6f2629',
    weight: 3,
    fillColor: '#b97878',
    fillOpacity: 0.48,
  },
  selected: {
    color: '#1f7a1f',
    weight: 3,
    fillColor: '#49b24a',
    fillOpacity: 0.5,
  },
}
