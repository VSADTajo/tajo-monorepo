import type {
  ForecastEvent,
  ForecastNAM,
  ForecastSeries,
  TimeseriePoint,
  TimeSeries,
} from '@/types/Forecast'
import type { TelemetryRecord } from '@/types/Precipitation'

function parseSeries(ts: TimeSeries) {
  const missVal = Number(ts.header.missVal)

  return ts.events
    .filter((e: ForecastEvent) => Number(e.value) !== missVal)
    .map((e: ForecastEvent) => {
      const timestamp = new Date(`${e.date}T${e.time}`).getTime()
      return {
        x: timestamp,
        y: Number(e.value),
      }
    })
}

function buildBand(upper: TimeseriePoint[], lower: TimeseriePoint[]) {
  return upper.map((p, i) => ({
    x: p.x,
    y: [lower[i].y, p.y] as [number, number],
  }))
}

function parseTelemetry(telemetry: TelemetryRecord[]) {
  return telemetry.map((t) => {
    const [date, time, value] = t

    const [day, month, year] = date.split('/')
    const timestamp = new Date(`${year}-${month}-${day}T${time}`).getTime()

    return {
      x: timestamp,
      y: Number(value),
    }
  })
}

export function buildForecastSeries({
  forecastDet,
  forecastEns,
  observed,
  chartType,
  percentileKeys,
  labels,
}: {
  forecastDet: ForecastNAM
  forecastEns: ForecastNAM
  observed?: TelemetryRecord[]
  chartType: 'line' | 'bar'
  percentileKeys: {
    median: string
    p90: string
    p75: string
    p25: string
    p10: string
  }
  labels: {
    observed: string
    p1090: string
    p2575: string
    eps: string
    harmonie: string
  }
}) {
  const series: ForecastSeries[] = []

  if (observed) {
    series.push({
      name: labels.observed,
      type: chartType,
      data: parseTelemetry(observed),
    })
  }

  const seriesMap: Record<string, TimeseriePoint[]> = {}

  for (const ts of forecastEns.timeSeries) {
    seriesMap[ts.header.parameterId] = parseSeries(ts)
  }

  const median = seriesMap[percentileKeys.median]
  const p90 = seriesMap[percentileKeys.p90]
  const p75 = seriesMap[percentileKeys.p75]
  const p25 = seriesMap[percentileKeys.p25]
  const p10 = seriesMap[percentileKeys.p10]

  series.push(
    {
      name: labels.p1090,
      type: 'rangeArea',
      data: buildBand(p90, p10),
    },
    {
      name: labels.p2575,
      type: 'rangeArea',
      data: buildBand(p75, p25),
    },
    {
      name: labels.eps,
      type: chartType,
      data: median,
    }
  )

  const ts = forecastDet.timeSeries[0]

  series.push({
    name: labels.harmonie,
    type: chartType,
    data: parseSeries(ts),
  })

  return series
}
