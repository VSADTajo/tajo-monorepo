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
            No se han encontrado datos observados
          </div>
        </v-card-text>
      </v-card>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { formatDate } from '@/utils/dates'
  import type { StationPrediction } from '@/types/Predictions'
  import { PRECIP_HORIZON_META, type PrecipHorizonKey } from '../utils/precipAccumulation'
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

  type HorizonExceededLevel = 0 | 1 | 2 | 3

  type Segment = {
    level: Exclude<HorizonExceededLevel, 0>
    startDate: string
    endDate: string
    count: number
  }

  const props = withDefaults(
    defineProps<{
      loading?: boolean
      precipitationsHistorical?: StationPrediction
      thresholds?: Record<string, unknown>
      title?: string
    }>(),
    {
      loading: false,
      precipitationsHistorical: undefined,
      thresholds: undefined,
      title: 'Resumen Operativo Observado',
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

  const observedSeries = computed<Array<{ date: string; timestamp: number; value: number }>>(() => {
    const raw = props.precipitationsHistorical?.results ?? []

    return raw
      .map((entry) => ({
        date: entry.date,
        timestamp: new Date(entry.date).getTime(),
        value: Number(entry.value),
      }))
      .filter(
        (entry) =>
          Boolean(entry.date) && Number.isFinite(entry.timestamp) && Number.isFinite(entry.value)
      )
      .sort((a, b) => a.timestamp - b.timestamp)
  })

  const hasAnyData = computed(() => observedSeries.value.length > 0)

  function getExceededLevel(
    value: number,
    leve: number | null,
    medio: number | null,
    grave: number | null
  ): HorizonExceededLevel {
    if (grave != null && value >= grave) return 3
    if (medio != null && value >= medio) return 2
    if (leve != null && value >= leve) return 1
    return 0
  }

  function buildRollingSegments(horizonHours: number, thresholdKey: PrecipHorizonKey): Segment[] {
    const points = observedSeries.value
    if (!points.length) return []

    const nowTs = Date.now()
    const last24hStart = nowTs - 24 * 60 * 60 * 1000
    const windowMs = horizonHours * 60 * 60 * 1000

    const leve = thresholdsLeve.value[thresholdKey]
    const medio = thresholdsMedio.value[thresholdKey]
    const grave = thresholdsGrave.value[thresholdKey]

    let left = 0
    let running = 0
    let current: Segment | null = null
    const segments: Segment[] = []

    for (let right = 0; right < points.length; right++) {
      const point = points[right]
      running += point.value

      while (left <= right && points[left].timestamp <= point.timestamp - windowMs) {
        running -= points[left].value
        left += 1
      }

      if (point.timestamp < last24hStart || point.timestamp > nowTs) {
        current = null
        continue
      }

      const exceeded = getExceededLevel(running, leve, medio, grave)

      if (!exceeded) {
        current = null
        continue
      }

      if (current && current.level === exceeded) {
        current.endDate = point.date
        current.count += 1
        continue
      }

      current = {
        level: exceeded,
        startDate: point.date,
        endDate: point.date,
        count: 1,
      }
      segments.push(current)
    }

    return segments
  }

  const summaryItems = computed<SummaryItem[]>(() => {
    const items: SummaryItem[] = []

    const levelColor: Record<Exclude<HorizonExceededLevel, 0>, SummaryLevel> = {
      1: 'yellow',
      2: 'orange',
      3: 'red',
    }

    const levelLabel: Record<Exclude<HorizonExceededLevel, 0>, string> = {
      1: 'AMARILLO',
      2: 'NARANJA',
      3: 'ROJO',
    }

    const horizons = [...PRECIP_HORIZON_META]
      .filter((h) => h.hours > 0)
      .sort((a, b) => b.hours - a.hours)

    for (const horizon of horizons) {
      const segments = buildRollingSegments(horizon.hours, horizon.key)
      if (!segments.length) continue

      for (const level of [3, 2, 1] as const) {
        const levelSegments = segments.filter((segment) => segment.level === level)
        if (!levelSegments.length) continue

        const latestSegment = levelSegments[levelSegments.length - 1]
        const intervalLabel =
          latestSegment.startDate === latestSegment.endDate
            ? formatDate(latestSegment.startDate)
            : `${formatDate(latestSegment.startDate)} - ${formatDate(latestSegment.endDate)}`

        items.push({
          id: `${horizon.key}-${level}`,
          level: levelColor[level],
          text: `Ventana ${horizon.hours}h: ${levelLabel[level]} superado en ${levelSegments.length} intervalo(s). Ultimo: ${intervalLabel}`,
        })
      }
    }

    if (!items.length && hasAnyData.value) {
      items.push({
        id: 'no-thresholds',
        level: 'info',
        text: 'Sin superaciones de umbral en las ultimas 24 horas observadas',
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
