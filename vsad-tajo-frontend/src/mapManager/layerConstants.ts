export const SELECTABLE_LAYER_IDS = [
  'subcuencas',
  'sistemas10',
  'zonasexpl',
  'comarcasagrarias',
] as const

export type SelectableLayerId = (typeof SELECTABLE_LAYER_IDS)[number]

export function isSelectableLayerId(layerId: string): layerId is SelectableLayerId {
  return SELECTABLE_LAYER_IDS.includes(layerId as SelectableLayerId)
}

export const PRECIPITACION_LAYER_IDS = new Set([
  'eps_precipitacion_25',
  'eps_precipitacion_75',
  'eps_precipitacion_media',
  'eps_precipitacion_media_acumulada',
  'harmonie_precipitacion',
  'harmonie_precipitacion_acumulada',
])

export function isPrecipitacionLayerId(layerId: string): boolean {
  return PRECIPITACION_LAYER_IDS.has(layerId)
}
