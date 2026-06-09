import { api } from './api'
import type { ResguardosStationResponse } from '@/types/Resguardos'

export async function getResguardosByStationService(
  stationCode: string
): Promise<ResguardosStationResponse> {
  return api
    .get(`resguardos/${encodeURIComponent(stationCode)}`, {
      headers: {
        Accept: 'application/json',
      },
    })
    .json<ResguardosStationResponse>()
}
