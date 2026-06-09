export type ResguardoEntry = {
  minimumVolume: number | null
  reserveVolume: number | null
  reserveLevel: number | null
}

export type ResguardoEntriesByDate = Record<string, ResguardoEntry>

export type ResguardosStationResponse = {
  stationCode: string
  stationName: string
  entries: ResguardoEntriesByDate
}
