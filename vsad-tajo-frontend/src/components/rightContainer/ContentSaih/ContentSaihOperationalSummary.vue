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

          <div v-else class="observed-empty-state text-medium-emphasis">{{ emptyStateText }}</div>
        </v-card-text>
      </v-card>
    </v-card-text>
  </v-card>
</template>

<script lang="ts" setup>
  import { computed } from 'vue'
  import { formatDate, toTimestamp } from '@/utils/dates'
  import type { PredictionResult, StationPrediction } from '@/types/Predictions'

  type SummaryLevel = 'info' | 'yellow' | 'orange' | 'red'

  type SummaryItem = {
    id: string
    level: SummaryLevel
    text: string
  }

  type ThresholdLevel = 0 | 1 | 2 | 3

  type Segment = {
    level: Exclude<ThresholdLevel, 0>
    startDate: string
    endDate: string
    count: number
  }

  type SummarySource = {
    id: string
    label: string
    series: PredictionResult[]
  }

  type SummaryMode = 'observed' | 'predictions'

  const props = defineProps<{
    loading?: boolean
    mode?: SummaryMode
    caudalHistorical?: StationPrediction
    caudalForecastHarmonie?: StationPrediction
    caudalForecastEpstat?: StationPrediction
    caudalForecastEnsP10?: StationPrediction
    caudalForecastEnsP25?: StationPrediction
    caudalForecastEnsP75?: StationPrediction
    caudalForecastEnsP90?: StationPrediction
    thresholds?: Record<string, unknown>
    title: string
  }>()

  function readNumber(keys: string[], source?: Record<string, unknown>): number | null {
    if (!source) return null

    for (const key of keys) {
      const raw = source[key]
      if (raw == null) continue

      if (typeof raw === 'number' && Number.isFinite(raw)) return raw
      if (typeof raw === 'string') {
        const parsed = Number.parseFloat(raw.replace(',', '.'))
        if (Number.isFinite(parsed)) return parsed
      }
    }

    return null
  }

  const threshold1 = computed(() => readNumber(['umbral_caudal_1'], props.thresholds))

  const threshold2 = computed(() => readNumber(['umbral_caudal_2'], props.thresholds))

  const threshold3 = computed(() => readNumber(['umbral_caudal_3'], props.thresholds))

  function normalizeSeries(prediction?: StationPrediction): PredictionResult[] {
    return [...(prediction?.results ?? [])]
      .filter((item) => Number.isFinite(item.value) && Boolean(item.date))
      .sort((a, b) => toTimestamp(a.date) - toTimestamp(b.date))
  }

  function getExceededLevel(value: number): ThresholdLevel {
    if (threshold3.value != null && value >= threshold3.value) return 3
    if (threshold2.value != null && value >= threshold2.value) return 2
    if (threshold1.value != null && value >= threshold1.value) return 1
    return 0
  }

  function buildSegments(series: PredictionResult[]): Segment[] {
    const segments: Segment[] = []
    let current: Segment | null = null

    for (const point of series) {
      const exceeded = getExceededLevel(point.value)

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

  const sources = computed<SummarySource[]>(() => {
    if (props.mode === 'predictions') {
      return [
        {
          id: 'harmonie',
          label: 'Harmonie',
          series: normalizeSeries(props.caudalForecastHarmonie),
        },
        {
          id: 'eps-medio',
          label: 'EPS Medio',
          series: normalizeSeries(props.caudalForecastEpstat),
        },
        {
          id: 'eps-p10',
          label: 'EPS P10',
          series: normalizeSeries(props.caudalForecastEnsP10),
        },
        {
          id: 'eps-p25',
          label: 'EPS P25',
          series: normalizeSeries(props.caudalForecastEnsP25),
        },
        {
          id: 'eps-p75',
          label: 'EPS P75',
          series: normalizeSeries(props.caudalForecastEnsP75),
        },
        {
          id: 'eps-p90',
          label: 'EPS P90',
          series: normalizeSeries(props.caudalForecastEnsP90),
        },
      ]
    }

    return [
      {
        id: 'observed',
        label: 'Observado',
        series: normalizeSeries(props.caudalHistorical),
      },
    ]
  })

  const hasAnyData = computed(() => sources.value.some((source) => source.series.length > 0))

  const emptyStateText = computed(() =>
    props.mode === 'predictions'
      ? 'No se han encontrado datos de prediccion'
      : 'No se han encontrado datos observados'
  )

  const summaryItems = computed<SummaryItem[]>(() => {
    const items: SummaryItem[] = []

    const labels: Record<1 | 2 | 3, string> = {
      1: 'Nivel 1',
      2: 'Nivel 2',
      3: 'Nivel 3',
    }

    const levelColor: Record<1 | 2 | 3, SummaryLevel> = {
      1: 'yellow',
      2: 'orange',
      3: 'red',
    }

    for (const source of sources.value) {
      if (!source.series.length) continue

      const segments = buildSegments(source.series)
      if (!segments.length) continue

      for (const level of [3, 2, 1] as const) {
        const levelSegments = segments.filter((item) => item.level === level)
        if (!levelSegments.length) continue

        const latestSegment = levelSegments[levelSegments.length - 1]
        const intervalLabel =
          latestSegment.startDate === latestSegment.endDate
            ? formatDate(latestSegment.startDate)
            : `${formatDate(latestSegment.startDate)} - ${formatDate(latestSegment.endDate)}`

        items.push({
          id: `${source.id}-level-${level}`,
          level: levelColor[level],
          text: `${source.label}: ${labels[level]} superado en ${levelSegments.length} intervalo(s). Ultimo: ${intervalLabel}`,
        })
      }
    }

    if (!items.length && hasAnyData.value) {
      items.push({
        id: 'no-thresholds',
        level: 'info',
        text:
          props.mode === 'predictions'
            ? 'Sin superaciones de umbral en las predicciones disponibles'
            : 'Sin superaciones de umbral en el periodo observado',
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
