import type {
  PredictionTypeName,
  DatesAvailableResponse,
  StationPrediction,
} from '@/types/Predictions'
import { getPredictionsService } from '@/services/predictions'

type MutablePredictionRef = { value: StationPrediction | undefined }

export type ForecastRequestDef<K extends string = string> = {
  key: K
  predictionType: PredictionTypeName
  simulationDate?: string
  percentile?: string
}

export function clearForecasts<K extends string>(target: Record<K, MutablePredictionRef>): void {
  for (const key in target) {
    target[key].value = undefined
  }
}

export function pickDefaultDate(current: string, options: string[]): string {
  if (current && options.includes(current)) return current
  return options[0] ?? ''
}

export function applyForecastData<K extends string>(
  target: Record<K, MutablePredictionRef>,
  payload: Partial<Record<K, StationPrediction | undefined>>
): void {
  for (const key in target) {
    target[key as K].value = payload[key as K]
  }
}

export async function fetchPredictionBatch<K extends string>(
  stationId: string,
  requests: ForecastRequestDef<K>[]
): Promise<Partial<Record<K, StationPrediction | undefined>>> {
  const entries = await Promise.all(
    requests.map(async (request) => {
      if (!request.simulationDate) return [request.key, undefined] as const

      const prediction = await getPredictionsService(
        stationId,
        request.predictionType,
        request.simulationDate,
        request.percentile
      )

      return [request.key, prediction] as const
    })
  )

  const result: Partial<Record<K, StationPrediction | undefined>> = {}
  for (const [key, prediction] of entries) {
    result[key] = prediction
  }

  return result
}

export function toDateList(response: DatesAvailableResponse): string[] {
  const fromSimulationDates = (response.simulationDates ?? [])
    .map((item) => item.simulationDate)
    .filter((value): value is string => Boolean(value))

  const fromDates = (response.dates ?? []).filter((value): value is string => Boolean(value))

  return Array.from(new Set([...fromSimulationDates, ...fromDates])).sort((a, b) =>
    b.localeCompare(a)
  )
}
