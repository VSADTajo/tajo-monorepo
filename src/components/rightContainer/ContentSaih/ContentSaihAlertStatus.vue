<template>
  <v-card class="bg-surface h-100" elevation="2">
    <v-card-title class="text-subtitle-1 font-weight-bold">{{ cardTitle }}</v-card-title>
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

  type AlertLevel = 'NORMAL' | 'LEVE' | 'MODERADO' | 'GRAVE'

  const props = withDefaults(
    defineProps<{
      activeTab?: 'caudal' | 'precipitaciones'
      caudalHistorical?: StationPrediction
      precipitationsHistorical?: StationPrediction
      caudalForecastHarmonie?: StationPrediction
      caudalForecastEpsat?: StationPrediction
      mode?: 'observed' | 'predictions'
      thresholds?: Record<string, unknown>
      loading?: boolean
    }>(),
    {
      activeTab: 'caudal',
      caudalHistorical: undefined,
      precipitationsHistorical: undefined,
      caudalForecastHarmonie: undefined,
      caudalForecastEpsat: undefined,
      mode: 'observed',
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
        const parsed = Number.parseFloat(raw.replace(',', '.'))
        if (Number.isFinite(parsed)) return parsed
      }
    }
    return null
  }

  function maxResultValue(prediction?: StationPrediction): number | null {
    if (!prediction?.results?.length) return null
    const maxItem = prediction.results.reduce((acc, item) =>
      Number(item.value) > Number(acc.value) ? item : acc
    )
    const num = Number(maxItem.value)
    return Number.isFinite(num) ? num : null
  }

  const maxPredictionValue = computed<number | null>(() => {
    const harmonieMax = maxResultValue(props.caudalForecastHarmonie)
    const epsMax = maxResultValue(props.caudalForecastEpsat)

    if (harmonieMax == null && epsMax == null) return null
    if (harmonieMax == null) return epsMax
    if (epsMax == null) return harmonieMax
    return Math.max(harmonieMax, epsMax)
  })

  const maxObservedValue = computed<number | null>(() => {
    if (props.activeTab === 'caudal') return maxResultValue(props.caudalHistorical)
    return maxResultValue(props.precipitationsHistorical)
  })

  const referenceValue = computed<number | null>(() => {
    if (props.mode === 'predictions') return maxPredictionValue.value
    return maxObservedValue.value
  })

  const cardTitle = computed(() =>
    props.mode === 'predictions' ? 'Estado Según Predicciones' : 'Estado Máximo Observado'
  )

  const threshold1 = computed<number | null>(() => {
    if (props.activeTab === 'caudal') {
      return readNumber(['umbral_caudal_1', 'umbral_amarillo'], props.thresholds)
    }
    return readNumber(['umbral_precip_1', 'umbral_caudal_1'], props.thresholds)
  })

  const threshold2 = computed<number | null>(() => {
    if (props.activeTab === 'caudal') {
      return readNumber(['umbral_caudal_2', 'umbral_naranja'], props.thresholds)
    }
    return readNumber(['umbral_precip_2', 'umbral_caudal_2'], props.thresholds)
  })

  const threshold3 = computed<number | null>(() => {
    if (props.activeTab === 'caudal') {
      return readNumber(['umbral_caudal_3', 'umbral_rojo'], props.thresholds)
    }
    return readNumber(['umbral_precip_3', 'umbral_caudal_3'], props.thresholds)
  })

  const alertLevel = computed<AlertLevel>(() => {
    const v = referenceValue.value
    if (v == null) return 'NORMAL'
    if (threshold3.value != null && v >= threshold3.value) return 'GRAVE'
    if (threshold2.value != null && v >= threshold2.value) return 'MODERADO'
    if (threshold1.value != null && v >= threshold1.value) return 'LEVE'
    return 'NORMAL'
  })

  const statusLabel = computed<string>(() => alertLevel.value)

  const statusChipColor = computed<string>(() => {
    switch (alertLevel.value) {
      case 'GRAVE':
        return 'red-lighten-3'
      case 'MODERADO':
        return 'orange-lighten-3'
      case 'LEVE':
        return 'amber-lighten-3'
      default:
        return ''
    }
  })
</script>

<style scoped>
  .alert-chip-container {
    min-height: 92px;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

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
