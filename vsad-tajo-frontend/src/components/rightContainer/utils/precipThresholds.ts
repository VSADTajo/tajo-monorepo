import type { PrecipHorizonKey } from './precipAccumulation'

export type PrecipThresholdLevel = 'leve' | 'medio' | 'grave'
export type PrecipThresholdMap = Record<PrecipHorizonKey, number | null>

const BASE_H0 = 0

export const DEFAULT_PRECIP_THRESHOLDS_LEVE: PrecipThresholdMap = {
  h0: BASE_H0,
  h1: 15,
  h2: 17,
  h4: 22,
  h8: 31,
  h12: 40,
  h24: 67,
}

export const DEFAULT_PRECIP_THRESHOLDS_MEDIO: PrecipThresholdMap = {
  h0: BASE_H0,
  h1: 30,
  h2: 35,
  h4: 44,
  h8: 62,
  h12: 80,
  h24: 135,
}

export const DEFAULT_PRECIP_THRESHOLDS_GRAVE: PrecipThresholdMap = {
  h0: BASE_H0,
  h1: 60,
  h2: 65,
  h4: 76,
  h8: 98,
  h12: 120,
  h24: 185,
}
