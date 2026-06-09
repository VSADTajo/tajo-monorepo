import type { WMSLayerConfig } from '@/types/Layers'

export type CustomLegendInfo = {
  minLabel: string
  maxLabel: string
  units?: string
}

const STYLE_LEGEND_INFO: Record<string, CustomLegendInfo> = {
  'raster-temperatura': {
    minLabel: 'Frio',
    maxLabel: 'Calido',
    units: 'ºC',
  },

  'raster-precipitaciones': {
    minLabel: 'Baja',
    maxLabel: 'Alta',
    units: 'mm',
  },
  'raster-cobertura-nieve': {
    minLabel: 'Baja',
    maxLabel: 'Alta',
    units: 'mm',
  },
  'raster-nubosidad': {
    minLabel: 'Despejado',
    maxLabel: 'Cubierto',
    units: '%',
  },
  'raster-descargas-electricas': {
    minLabel: 'Pocos',
    maxLabel: 'Muchos',
    units: 'rayos/km²/h',
  },
  'raster-velocidad-viento': {
    minLabel: 'Suave',
    maxLabel: 'Fuerte',
    units: 'm/s',
  },
}

export function getCustomLegendInfo(config: WMSLayerConfig): CustomLegendInfo | null {
  const styleName = config.styles

  if (!styleName) {
    return null
  }

  return STYLE_LEGEND_INFO[styleName] ?? STYLE_LEGEND_INFO[styleName.replace(/_/g, '-')] ?? null
}
