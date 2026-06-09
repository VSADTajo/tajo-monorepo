<template>
  <v-card class="bg-surface operational-summary-card" elevation="2">
    <v-card-title
      class="text-subtitle-1 font-weight-bold d-flex align-center ga-2"
      style="min-width: 0"
    >
      <span class="text-truncate" style="min-width: 0; flex: 1">{{ title }}</span>
    </v-card-title>
    <v-divider />

    <v-card-text class="pa-2 d-flex flex-column flex-grow-1 operational-summary-body">
      <v-card class="bg-surface w-100 h-100 operational-summary-inner" elevation="0">
        <v-card-text v-if="loading" class="pa-4">
          <v-skeleton-loader type="list-item-two-line" class="mb-2" />
          <v-skeleton-loader type="list-item-two-line" class="mb-2" />
          <v-skeleton-loader type="list-item-two-line" class="mb-2" />
          <v-skeleton-loader type="list-item-two-line" />
        </v-card-text>

        <v-card-text v-else class="pa-4 operational-summary-content d-flex flex-column">
          <template v-if="hasAnyData">
            <div
              v-for="item in summaryItems"
              :key="item.id"
              class="d-flex align-start ga-3 operational-summary-item"
            >
              <span class="summary-dot" :class="`summary-dot--${item.level}`" />
              <span class="text-body-2">{{ item.text }}</span>
            </div>
          </template>

          <div v-else class="observed-empty-state text-medium-emphasis">
            No se han encontrado datos de prediccion
          </div>
        </v-card-text>
      </v-card>
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

  type SummaryLevel = 'info' | 'yellow' | 'orange' | 'red'

  type SummaryItem = {
    id: string
    level: SummaryLevel
    text: string
  }

  type ForecastSource = {
    id: string
    label: string
    prediction?: StationPrediction
  }

  const props = withDefaults(
    defineProps<{
      loading?: boolean
      precipitationsForecastHarmonie?: StationPrediction
      precipitationsForecastEpstat?: StationPrediction
      precipitationsForecastEnsP10?: StationPrediction
      precipitationsForecastEnsP25?: StationPrediction
      precipitationsForecastEnsP75?: StationPrediction
      precipitationsForecastEnsP90?: StationPrediction
      thresholds?: Record<string, unknown>
      title?: string
    }>(),
    {
      loading: false,
      precipitationsForecastHarmonie: undefined,
      precipitationsForecastEpstat: undefined,
      precipitationsForecastEnsP10: undefined,
      precipitationsForecastEnsP25: undefined,
      precipitationsForecastEnsP75: undefined,
      precipitationsForecastEnsP90: undefined,
      thresholds: undefined,
      title: 'Resumen Operativo Predicciones',
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
  ): string[] {
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

  const sources = computed<ForecastSource[]>(() => [
    {
      id: 'harmonie',
      label: 'Harmonie',
      prediction: props.precipitationsForecastHarmonie,
    },
    {
      id: 'eps-medio',
      label: 'EPS Medio',
      prediction: props.precipitationsForecastEpstat,
    },
    {
      id: 'eps-p10',
      label: 'EPS P10',
      prediction: props.precipitationsForecastEnsP10,
    },
    {
      id: 'eps-p25',
      label: 'EPS P25',
      prediction: props.precipitationsForecastEnsP25,
    },
    {
      id: 'eps-p75',
      label: 'EPS P75',
      prediction: props.precipitationsForecastEnsP75,
    },
    {
      id: 'eps-p90',
      label: 'EPS P90',
      prediction: props.precipitationsForecastEnsP90,
    },
  ])

  const hasAnyData = computed(() =>
    sources.value.some((source) => Boolean(source.prediction?.results?.length))
  )

  const summaryItems = computed<SummaryItem[]>(() => {
    const items: SummaryItem[] = []
    const horizons = [...PRECIP_HORIZON_META]
      .filter((h) => h.hours > 0)
      .sort((a, b) => a.hours - b.hours)

    for (const source of sources.value) {
      if (!source.prediction?.results?.length) continue

      const accum = extractAccumulatedHorizonValues(source.prediction)

      for (const horizon of horizons) {
        const value = accum[horizon.key]
        if (value == null) continue

        const grave = thresholdsGrave.value[horizon.key]
        if (grave != null && value >= grave) {
          items.push({
            id: `${source.id}-${horizon.key}-grave`,
            level: 'red',
            text: `${source.label} ${horizon.hours}h: ROJO (${value.toFixed(1)} mm, umbral ${grave.toFixed(1)} mm)`,
          })
          continue
        }

        const medio = thresholdsMedio.value[horizon.key]
        if (medio != null && value >= medio) {
          items.push({
            id: `${source.id}-${horizon.key}-medio`,
            level: 'orange',
            text: `${source.label} ${horizon.hours}h: NARANJA (${value.toFixed(1)} mm, umbral ${medio.toFixed(1)} mm)`,
          })
          continue
        }

        const leve = thresholdsLeve.value[horizon.key]
        if (leve != null && value >= leve) {
          items.push({
            id: `${source.id}-${horizon.key}-leve`,
            level: 'yellow',
            text: `${source.label} ${horizon.hours}h: AMARILLO (${value.toFixed(1)} mm, umbral ${leve.toFixed(1)} mm)`,
          })
        }
      }
    }

    if (!items.length && hasAnyData.value) {
      items.push({
        id: 'no-thresholds',
        level: 'info',
        text: 'Sin superaciones de umbral en las predicciones acumuladas disponibles',
      })
    }

    return items
  })
</script>

<style scoped>
  .operational-summary-card {
    height: 100%;
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .operational-summary-body,
  .operational-summary-inner {
    min-height: 0;
  }

  .operational-summary-content {
    flex: 1;
    height: 100%;
    min-height: 0;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    gap: 10px;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: thin;
    scrollbar-color: rgba(110, 118, 129, 0.7) transparent;
  }

  .operational-summary-content::-webkit-scrollbar {
    width: 6px;
  }

  .operational-summary-content::-webkit-scrollbar-track {
    background: transparent;
  }

  .operational-summary-content::-webkit-scrollbar-thumb {
    background: rgba(110, 118, 129, 0.7);
    border-radius: 999px;
  }

  .observed-empty-state {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    font-weight: 500;
  }

  .operational-summary-item {
    line-height: 1.35;
  }

  .summary-dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    margin-top: 6px;
    flex: 0 0 auto;
  }

  .summary-dot--info {
    background: #1e88e5;
  }

  .summary-dot--yellow {
    background: #fde68a;
  }

  .summary-dot--orange {
    background: #fdba74;
  }

  .summary-dot--red {
    background: #fca5a5;
  }
</style>
