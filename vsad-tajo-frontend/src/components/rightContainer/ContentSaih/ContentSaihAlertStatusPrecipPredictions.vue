<template>
  <v-card class="bg-surface h-100" elevation="2">
    <v-card-title class="text-subtitle-1 font-weight-bold">Estado Segun Predicciones</v-card-title>
    <v-divider />

    <v-card-text v-if="loading" class="justify-center d-flex align-center">
      <v-skeleton-loader type="chip" class="alert-chip-skeleton" />
    </v-card-text>

    <v-card-text v-else class="justify-center d-flex align-center">
      <v-chip :color="statusChipColor" variant="flat" size="large" label class="alert-chip">
        {{ statusLabel }}
      </v-chip>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import type { StationPrediction } from '@/types/Predictions'
  import {
    extractAccumulatedHorizonValues,
    PRECIP_HORIZON_META,
    type PrecipHorizonKey,
  } from '../utils/precipAccumulation'
  import {
    DEFAULT_PRECIP_THRESHOLDS_GRAVE,
    DEFAULT_PRECIP_THRESHOLDS_LEVE,
    DEFAULT_PRECIP_THRESHOLDS_MEDIO,
    type PrecipThresholdLevel,
    type PrecipThresholdMap,
  } from '../utils/precipThresholds'

  type AlertLevel = 'NORMAL' | 'LEVE' | 'MEDIO' | 'GRAVE'
  type TriggeredState = {
    level: AlertLevel
    horizonLabel: string | null
  }

  const props = withDefaults(
    defineProps<{
      precipitationsForecastHarmonie?: StationPrediction
      precipitationsForecastEpstat?: StationPrediction
      precipitationsForecastEnsP10?: StationPrediction
      precipitationsForecastEnsP25?: StationPrediction
      precipitationsForecastEnsP75?: StationPrediction
      precipitationsForecastEnsP90?: StationPrediction
      thresholds?: Record<string, unknown>
      loading?: boolean
    }>(),
    {
      precipitationsForecastHarmonie: undefined,
      precipitationsForecastEpstat: undefined,
      precipitationsForecastEnsP10: undefined,
      precipitationsForecastEnsP25: undefined,
      precipitationsForecastEnsP75: undefined,
      precipitationsForecastEnsP90: undefined,
      thresholds: undefined,
      loading: false,
    }
  )

  function readNumber(keys: string[], source?: Record<string, unknown>): number | null {
    if (!source) return null

    for (const key of keys) {
      const raw = source[key]
      if (raw == null) continue

      if (typeof raw === 'number' && Number.isFinite(raw)) return raw
      if (typeof raw === 'string') {
        const normalized = raw.trim().replace(',', '.')
        const parsed = Number.parseFloat(normalized)
        if (Number.isFinite(parsed)) return parsed
      }
    }

    return null
  }

  function readThresholdMapFromNested(
    source: Record<string, unknown> | undefined,
    keys: string[]
  ): Partial<PrecipThresholdMap> {
    if (!source) return {}

    for (const key of keys) {
      const nested = source[key]
      if (!nested || typeof nested !== 'object') continue

      const asRecord = nested as Record<string, unknown>
      const out: Partial<PrecipThresholdMap> = {}

      for (const { key: horizonKey } of PRECIP_HORIZON_META) {
        const value = readNumber([horizonKey], asRecord)
        if (value != null) out[horizonKey] = value
      }

      if (Object.keys(out).length > 0) return out
    }

    return {}
  }

  function thresholdKeysFor(
    horizon: { key: PrecipHorizonKey; hours: number },
    level: PrecipThresholdLevel
  ) {
    const suffixByLevel: Record<PrecipThresholdLevel, string[]> = {
      leve: ['leve', 'amarillo', '1'],
      medio: ['medio', 'naranja', '2'],
      grave: ['grave', 'rojo', '3', '2'],
    }

    const suffix = suffixByLevel[level]

    return [
      `umbral_precip_${horizon.key}_${suffix[0]}`,
      `umbral_precip_${horizon.key}_${suffix[1]}`,
      `umbral_precip_${horizon.hours}h_${suffix[0]}`,
      `umbral_precip_${horizon.hours}h_${suffix[1]}`,
      `umbral_lluvia_${horizon.hours}h_${suffix[0]}`,
      `umbral_lluvia_${horizon.hours}h_${suffix[1]}`,
      `precip_${horizon.key}_${suffix[0]}`,
      `precip_${horizon.key}_${suffix[1]}`,
      `${horizon.key}_${suffix[0]}`,
      `${horizon.key}_${suffix[1]}`,
      ...suffix
        .slice(2)
        .flatMap((legacy) => [
          `umbral_precip_${horizon.hours}h_${legacy}`,
          `umbral_lluvia_${horizon.hours}h_${legacy}`,
          `${horizon.key}_${legacy}`,
        ]),
    ]
  }

  const thresholdsLeve = computed<PrecipThresholdMap>(() => {
    const nested = readThresholdMapFromNested(props.thresholds, [
      'thresholdsLeve',
      'thresholds_leve',
      'umbralesLeve',
      'umbralLeve',
    ])

    const result: PrecipThresholdMap = { ...DEFAULT_PRECIP_THRESHOLDS_LEVE, ...nested }

    for (const horizon of PRECIP_HORIZON_META) {
      if (horizon.hours === 0) continue
      const value = readNumber(thresholdKeysFor(horizon, 'leve'), props.thresholds)
      if (value != null) result[horizon.key] = value
    }

    return result
  })

  const thresholdsMedio = computed<PrecipThresholdMap>(() => {
    const nested = readThresholdMapFromNested(props.thresholds, [
      'thresholdsMedio',
      'thresholds_medio',
      'umbralesMedio',
      'umbralMedio',
    ])

    const result: PrecipThresholdMap = { ...DEFAULT_PRECIP_THRESHOLDS_MEDIO, ...nested }

    for (const horizon of PRECIP_HORIZON_META) {
      if (horizon.hours === 0) continue
      const value = readNumber(thresholdKeysFor(horizon, 'medio'), props.thresholds)
      if (value != null) result[horizon.key] = value
    }

    return result
  })

  const thresholdsGrave = computed<PrecipThresholdMap>(() => {
    const nested = readThresholdMapFromNested(props.thresholds, [
      'thresholdsGrave',
      'thresholds_grave',
      'umbralesGrave',
      'umbralGrave',
    ])

    const result: PrecipThresholdMap = { ...DEFAULT_PRECIP_THRESHOLDS_GRAVE, ...nested }

    for (const horizon of PRECIP_HORIZON_META) {
      if (horizon.hours === 0) continue
      const value = readNumber(thresholdKeysFor(horizon, 'grave'), props.thresholds)
      if (value != null) result[horizon.key] = value
    }

    return result
  })

  const predictionCandidates = computed<StationPrediction[]>(() => {
    const candidates = [
      props.precipitationsForecastHarmonie,
      props.precipitationsForecastEpstat,
      props.precipitationsForecastEnsP10,
      props.precipitationsForecastEnsP25,
      props.precipitationsForecastEnsP75,
      props.precipitationsForecastEnsP90,
    ]

    return candidates.filter((item): item is StationPrediction => Boolean(item?.results?.length))
  })

  const maxAccumulations = computed<PrecipThresholdMap>(() => {
    const result: PrecipThresholdMap = {
      h0: 0,
      h1: null,
      h2: null,
      h4: null,
      h8: null,
      h12: null,
      h24: null,
    }

    for (const prediction of predictionCandidates.value) {
      const horizonValues = extractAccumulatedHorizonValues(prediction)
      for (const horizon of PRECIP_HORIZON_META) {
        const value = horizonValues[horizon.key]
        if (value == null) continue
        const previous = result[horizon.key]
        if (previous == null || value > previous) {
          result[horizon.key] = value
        }
      }
    }

    return result
  })

  const triggeredState = computed<TriggeredState>(() => {
    let bestLeve: { exceedance: number; horizonLabel: string } | null = null
    let bestMedio: { exceedance: number; horizonLabel: string } | null = null
    let bestGrave: { exceedance: number; horizonLabel: string } | null = null

    for (const horizon of PRECIP_HORIZON_META) {
      if (horizon.hours === 0) continue

      const value = maxAccumulations.value[horizon.key]
      if (value == null) continue

      const grave = thresholdsGrave.value[horizon.key]
      if (grave != null && value >= grave) {
        const exceedance = value - grave
        if (!bestGrave || exceedance > bestGrave.exceedance) {
          bestGrave = { exceedance, horizonLabel: `${horizon.hours}h` }
        }
      }

      const leve = thresholdsLeve.value[horizon.key]
      if (leve != null && value >= leve) {
        const exceedance = value - leve
        if (!bestLeve || exceedance > bestLeve.exceedance) {
          bestLeve = { exceedance, horizonLabel: `${horizon.hours}h` }
        }
      }

      const medio = thresholdsMedio.value[horizon.key]
      if (medio != null && value >= medio) {
        const exceedance = value - medio
        if (!bestMedio || exceedance > bestMedio.exceedance) {
          bestMedio = { exceedance, horizonLabel: `${horizon.hours}h` }
        }
      }
    }

    if (bestGrave) return { level: 'GRAVE', horizonLabel: bestGrave.horizonLabel }
    if (bestMedio) return { level: 'MEDIO', horizonLabel: bestMedio.horizonLabel }
    if (bestLeve) return { level: 'LEVE', horizonLabel: bestLeve.horizonLabel }
    return { level: 'NORMAL', horizonLabel: null }
  })

  const alertLevel = computed<AlertLevel>(() => triggeredState.value.level)

  const statusLabel = computed<string>(() => {
    if (!triggeredState.value.horizonLabel) return alertLevel.value
    return `${alertLevel.value} (${triggeredState.value.horizonLabel})`
  })

  const statusChipColor = computed<string>(() => {
    switch (alertLevel.value) {
      case 'GRAVE':
        return 'red-lighten-3'
      case 'MEDIO':
        return 'orange-lighten-3'
      case 'LEVE':
        return 'amber-lighten-3'
      default:
        return ''
    }
  })
</script>

<style scoped>
  .alert-chip {
    min-width: 128px;
    justify-content: center;
    font-weight: 700;
    letter-spacing: 0.02em;
  }

  .alert-chip-skeleton {
    width: 128px;
    max-width: 128px;
  }
</style>
