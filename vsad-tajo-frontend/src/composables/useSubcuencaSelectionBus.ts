import { useEventBus } from '@vueuse/core'
import type { DataStationPrediction } from '@/types/Predictions'

export type SubcuencaSeriesMode = 'caudal' | 'precipitacion'

export type SubcuencaSelectedStation = {
  codigo: string
  nombre: string
}

export type SubcuencaSelectionPayload = {
  series: SubcuencaSeriesMode
  station: SubcuencaSelectedStation | null
  data: DataStationPrediction | null
}

const SUBCUENCA_SELECTION_BUS_KEY = 'subcuenca:station-selection'

export function useSubcuencaSelectionBus() {
  return useEventBus<SubcuencaSelectionPayload>(SUBCUENCA_SELECTION_BUS_KEY)
}
