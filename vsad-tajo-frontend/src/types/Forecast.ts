export interface ForecastNAM {
  version: string
  timeZone: string
  timeSeries: TimeSeries[]
}

export interface TimeSeries {
  header: TimeSeriesHeader
  events: ForecastEvent[]
}

export interface TimeSeriesHeader {
  type: string
  moduleInstanceId: string
  locationId: string
  parameterId: string
  timeStep: {
    unit: string
    multiplier: string
  }
  startDate: ForecastDateTime
  endDate: ForecastDateTime
  forecastDate: ForecastDateTime
  missVal: string
  stationName: string
  lat: string
  lon: string
  x: string
  y: string
  z: string
  units: string
  creationDate: string
  creationTime: string
  approvedDate: ForecastDateTime
}

export interface ForecastDateTime {
  date: string
  time: string
}

export interface ForecastEvent {
  date: string
  time: string
  value: string
  flag: string
}

export type TimeseriePoint = {
  x: number | string | Date
  y: number | [number, number]
}

export type ForecastSeries =
  | {
      name: string
      type: 'line' | 'bar'
      data: TimeseriePoint[]
    }
  | {
      name: string
      type: 'rangeArea'
      data: TimeseriePoint[]
    }

export type AforoKey =
  | 'Q.NAM.ens.Med'
  | 'Q.NAM.ens.90'
  | 'Q.NAM.ens.75'
  | 'Q.NAM.ens.25'
  | 'Q.NAM.ens.10'

export type PluviometroKey =
  | 'P.ens.forecast.Med'
  | 'P.ens.forecast.90'
  | 'P.ens.forecast.75'
  | 'P.ens.forecast.25'
  | 'P.ens.forecast.10'

export type ApexTooltipContext = {
  seriesIndex: number
  dataPointIndex: number
  w: {
    globals: {
      seriesX: number[][]
    }
    config: {
      series: {
        name: string
        data: TimeseriePoint[]
      }[]
    }
  }
}
