import type { SearchResponse, SearchResult } from '@/types/Search'
import type { StationData, StationsApiResponse } from '@/utils/stationsToGeoJSON'
import { api } from './api'

export type StationsSearchParams =
  | { sistemaName: string }
  | { subBasinName: string }
  | { comarcaName: string }
  | { zonaExplOgcFid: string }

export type StationByCodeResponse = {
  id: string
  name: string
  stationCode: string
  stationType: string
  tipoCod?: string | null
  latitude: number | null
  longitude: number | null
  threshold?: {
    umbralNivel1?: number | null
    umbralNivel2?: number | null
    umbralNivel3?: number | null
    umbralCaudal1?: number | null
    umbralCaudal2?: number | null
    umbralCaudal3?: number | null
    [key: string]: unknown
  } | null
  [key: string]: unknown
}

export async function getStationsByAreaService(
  params: StationsSearchParams
): Promise<StationData[]> {
  const response = await api
    .get('stations', { searchParams: params as Record<string, string> })
    .json<StationsApiResponse>()
  return Array.isArray(response.items) ? response.items : []
}

export async function getStationByCodeService(code: string): Promise<StationByCodeResponse> {
  return api.get(`stations/by-code/${encodeURIComponent(code)}`).json<StationByCodeResponse>()
}

export async function searchService(query: string): Promise<SearchResult[]> {
  const result = await api
    .get(`search`, {
      searchParams: { q: query },
      headers: {
        Accept: 'application/json',
      },
    })
    .json<SearchResponse>()

  return result.results
}
