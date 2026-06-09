<template>
  <v-card class="bg-surface" elevation="2">
    <v-card-title class="text-subtitle-1 font-weight-bold">Resumen datos observados</v-card-title>
    <v-divider />
    <v-card-text v-if="loading" class="pa-4">
      <v-skeleton-loader type="heading" height="22" class="mb-2" />
      <v-skeleton-loader type="text" height="18" class="mb-2" />
      <v-skeleton-loader type="list-item-two-line" class="mb-2" />
      <v-skeleton-loader type="list-item-two-line" class="mb-2" />
      <v-skeleton-loader type="list-item-two-line" />
    </v-card-text>

    <v-card-text v-else class="observed-content">
      <template v-if="hasObservedData && activeTab === 'caudal'">
        <v-btn-toggle
          v-if="isEmbalse"
          v-model="embalseObservedMode"
          mandatory
          density="compact"
          divided
          color="primary"
          variant="outlined"
          class="mb-3 observed-mode-toggle"
        >
          <v-btn value="entrada" size="small" class="observed-mode-btn">Entrada</v-btn>
          <v-btn value="salida" size="small" class="observed-mode-btn">Salida</v-btn>
          <v-btn value="volumen" size="small" class="observed-mode-btn">Volumen</v-btn>
        </v-btn-toggle>

        <div class="text-caption text-medium-emphasis font-weight-bold mb-1">
          {{ observedSectionTitle }}
        </div>
        <v-row class="mt-2">
          <v-col cols="6" class="text-caption text-medium-emphasis align-center">
            Último observado
          </v-col>
          <v-col cols="6" class="text-right font-weight-medium pr-2 align-center">
            <v-chip :color="currentLastValueColor" size="small" variant="flat">
              {{ currentSummary.lastValueLabel }}
            </v-chip>
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="5" class="text-caption text-medium-emphasis align-center">
            Fecha último
          </v-col>
          <v-col cols="7" class="text-right font-weight-medium align-center">
            {{ currentSummary.lastDateLabel }}
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="6" class="text-caption text-medium-emphasis align-center">
            Máximo observado
          </v-col>
          <v-col cols="6" class="text-right font-weight-medium pr-2 align-center">
            <v-chip :color="currentMaxValueColor" size="small" variant="flat">
              {{ currentSummary.maxValueLabel }}
            </v-chip>
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="5" class="text-caption text-medium-emphasis align-center">
            Fecha máximo
          </v-col>
          <v-col cols="7" class="text-right font-weight-medium align-center">
            {{ currentSummary.maxDateLabel }}
          </v-col>
        </v-row>
      </template>

      <template v-else-if="hasObservedData">
        <v-row>
          <v-col cols="6" class="text-caption text-medium-emphasis align-center">
            Último observado
          </v-col>
          <v-col cols="6" class="text-right font-weight-medium pr-2 align-center">
            <v-chip size="small" variant="flat">
              {{ lastObservedValueLabel }}
            </v-chip>
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="5" class="text-caption text-medium-emphasis align-center">
            Fecha último
          </v-col>
          <v-col cols="7" class="text-right font-weight-medium align-center">
            {{ lastObservedDateLabel }}
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="6" class="text-caption text-medium-emphasis align-center">
            Máximo observado
          </v-col>
          <v-col cols="6" class="text-right font-weight-medium pr-2 align-center">
            <v-chip size="small" variant="flat">
              {{ maxObservedValueLabel }}
            </v-chip>
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="5" class="text-caption text-medium-emphasis align-center">
            Fecha máximo
          </v-col>
          <v-col cols="7" class="text-right font-weight-medium align-center">
            {{ maxObservedDateLabel }}
          </v-col>
        </v-row>
      </template>

      <div v-else class="observed-empty-state text-medium-emphasis">
        No se han encontrado datos observados
      </div>
    </v-card-text>
  </v-card>
</template>

<script lang="ts" setup>
  import { computed, ref } from 'vue'
  import { formatDate, toTimestamp } from '@/utils/dates'
  import type { StationPrediction } from '@/types/Predictions'

  type EmbalseObservedMode = 'entrada' | 'salida' | 'volumen'

  const props = withDefaults(
    defineProps<{
      activeTab?: 'caudal' | 'precipitaciones'
      loading?: boolean
      isEmbalse?: boolean
      caudalHistorical?: StationPrediction
      caudalOutflowHistorical?: StationPrediction
      embalseVolumeHistorical?: StationPrediction
      precipitationsHistorical?: StationPrediction
      thresholds?: Record<string, unknown>
    }>(),
    {
      activeTab: 'caudal',
    }
  )

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

  function formatValue(value: number | undefined, unit: string): string {
    if (value == null || !Number.isFinite(value)) return '--'
    return `${value.toFixed(2)} ${unit}`
  }

  type PredictionSummary = {
    lastValue: number | undefined
    lastValueLabel: string
    lastDateLabel: string
    maxValue: number | undefined
    maxValueLabel: string
    maxDateLabel: string
  }

  function summarizePrediction(
    prediction: StationPrediction | undefined,
    unit: 'm3/s' | 'mm' | 'hm3'
  ): PredictionSummary {
    const orderedResults = [...(prediction?.results ?? [])].sort(
      (a, b) => toTimestamp(a.date) - toTimestamp(b.date)
    )
    const last = orderedResults.length ? orderedResults[orderedResults.length - 1] : undefined
    const max = orderedResults.length
      ? orderedResults.reduce(
          (acc, item) => (item.value > acc.value ? item : acc),
          orderedResults[0]
        )
      : undefined

    return {
      lastValue: last?.value,
      lastValueLabel: formatValue(last?.value, unit),
      lastDateLabel: formatDate(last?.date),
      maxValue: max?.value,
      maxValueLabel: formatValue(max?.value, unit),
      maxDateLabel: formatDate(max?.date),
    }
  }

  const baseSummary = computed(() =>
    props.activeTab === 'caudal'
      ? summarizePrediction(props.caudalHistorical, 'm3/s')
      : summarizePrediction(props.precipitationsHistorical, 'mm')
  )

  const outflowSummary = computed(() => summarizePrediction(props.caudalOutflowHistorical, 'm3/s'))
  const volumeSummary = computed(() => summarizePrediction(props.embalseVolumeHistorical, 'hm3'))

  const embalseObservedMode = ref<EmbalseObservedMode>('entrada')

  const observedSectionTitle = computed(() => {
    if (props.activeTab !== 'caudal') return 'Precipitacion observada'
    if (!props.isEmbalse) return 'Caudal observado'

    if (embalseObservedMode.value === 'salida') return 'Caudal de salida'
    if (embalseObservedMode.value === 'volumen') return 'Volumen'
    return 'Caudal de entrada'
  })

  const currentSummary = computed(() => {
    if (props.activeTab !== 'caudal') return baseSummary.value
    if (!props.isEmbalse) return baseSummary.value

    if (embalseObservedMode.value === 'salida') return outflowSummary.value
    if (embalseObservedMode.value === 'volumen') return volumeSummary.value
    return baseSummary.value
  })

  function hasResults(prediction: StationPrediction | undefined): boolean {
    return Boolean(prediction?.results?.length)
  }

  const hasObservedData = computed(() => {
    if (props.activeTab !== 'caudal') {
      return hasResults(props.precipitationsHistorical)
    }

    if (!props.isEmbalse) {
      return hasResults(props.caudalHistorical)
    }

    if (embalseObservedMode.value === 'salida') {
      return hasResults(props.caudalOutflowHistorical)
    }

    if (embalseObservedMode.value === 'volumen') {
      return hasResults(props.embalseVolumeHistorical)
    }

    return hasResults(props.caudalHistorical)
  })

  const lastObservedValueLabel = computed(() => baseSummary.value.lastValueLabel)
  const maxObservedValueLabel = computed(() => baseSummary.value.maxValueLabel)
  const lastObservedDateLabel = computed(() => baseSummary.value.lastDateLabel)
  const maxObservedDateLabel = computed(() => baseSummary.value.maxDateLabel)

  const yellowThreshold = computed(() => readNumber(['umbral_caudal_1'], props.thresholds))

  const orangeThreshold = computed(() => readNumber(['umbral_caudal_2'], props.thresholds))

  const redThreshold = computed(() => readNumber(['umbral_caudal_3'], props.thresholds))

  const volumeThreshold1 = computed(() => readNumber(['umbral_1_volumen'], props.thresholds))

  const volumeThreshold2 = computed(() => readNumber(['umbral_2_volumen'], props.thresholds))

  const volumeThreshold3 = computed(() => readNumber(['umbral_3_volumen'], props.thresholds))

  function getThresholdColor(value: number | undefined): string {
    if (props.activeTab !== 'caudal' || value == null || !Number.isFinite(value)) return ''

    if (redThreshold.value != null && value >= redThreshold.value) return 'red-lighten-3'
    if (orangeThreshold.value != null && value >= orangeThreshold.value) return 'orange-lighten-3'
    if (yellowThreshold.value != null && value >= yellowThreshold.value) return 'amber-lighten-3'

    return ''
  }

  function getVolumeThresholdColor(value: number | undefined): string {
    if (props.activeTab !== 'caudal' || value == null || !Number.isFinite(value)) return ''

    if (volumeThreshold3.value != null && value >= volumeThreshold3.value) return 'red-lighten-3'
    if (volumeThreshold2.value != null && value >= volumeThreshold2.value) return 'orange-lighten-3'
    if (volumeThreshold1.value != null && value >= volumeThreshold1.value) return 'amber-lighten-3'

    return ''
  }

  const lastValueColor = computed(() => getThresholdColor(baseSummary.value.lastValue))
  const maxValueColor = computed(() => getThresholdColor(baseSummary.value.maxValue))
  const volumeLastValueColor = computed(() =>
    getVolumeThresholdColor(volumeSummary.value.lastValue)
  )
  const volumeMaxValueColor = computed(() => getVolumeThresholdColor(volumeSummary.value.maxValue))

  const currentLastValueColor = computed(() => {
    if (props.activeTab !== 'caudal') return ''
    if (!props.isEmbalse) return lastValueColor.value

    if (embalseObservedMode.value === 'volumen') return volumeLastValueColor.value
    return getThresholdColor(currentSummary.value.lastValue)
  })

  const currentMaxValueColor = computed(() => {
    if (props.activeTab !== 'caudal') return ''
    if (!props.isEmbalse) return maxValueColor.value

    if (embalseObservedMode.value === 'volumen') return volumeMaxValueColor.value
    return getThresholdColor(currentSummary.value.maxValue)
  })
</script>

<style scoped>
  .observed-content {
    min-height: 220px;
  }

  .observed-empty-state {
    min-height: inherit;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    font-weight: 500;
  }

  .observed-mode-toggle {
    width: 100%;
    display: flex;
    height: 38px !important;
  }

  .observed-mode-btn {
    flex: 1;
    min-height: 38px !important;
  }
</style>
