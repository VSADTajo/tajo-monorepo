<template>
  <v-card class="bg-surface" elevation="2">
    <v-card-title class="text-subtitle-1 font-weight-bold">Resumen Datos Predicciones</v-card-title>
    <v-divider />
    <v-card-text v-if="loading" class="pa-4">
      <v-skeleton-loader type="heading" height="22" class="mb-2" />
      <v-skeleton-loader type="text" height="18" class="mb-2" />
      <v-skeleton-loader type="list-item-two-line" class="mb-2" />
      <v-skeleton-loader type="list-item-two-line" class="mb-2" />
      <v-skeleton-loader type="list-item-two-line" />
    </v-card-text>

    <v-card-text v-else class="pa-2">
      <div class="mb-3 d-flex justify-center">
        <v-btn-toggle
          v-model="selectedModel"
          mandatory
          density="compact"
          divided
          variant="outlined"
        >
          <v-btn value="harmonie" size="x-small">Harmonie</v-btn>
          <v-btn value="eps" size="x-small">EPS Medio</v-btn>
        </v-btn-toggle>
      </div>

      <div v-if="selectedModel === 'harmonie'">
        <div class="text-caption font-weight-bold text-primary mb-1 mt-2 pl-2">Harmonie</div>

        <v-row>
          <v-col cols="12" class="text-caption text-medium-emphasis pl-4">Fecha simulacion</v-col>
          <v-col cols="12" class="text-right font-weight-medium rounded px-4 pt-0">
            <v-select
              :model-value="harmonieSelectedDate"
              :items="harmonieDateOptions"
              item-title="title"
              item-value="value"
              variant="outlined"
              density="compact"
              hide-details
              color="primary"
              @update:model-value="setHarmonieDate"
            />
          </v-col>
        </v-row>

        <template v-if="loadingHarmonie">
          <v-row>
            <v-col cols="12" class="px-4 py-1">
              <v-skeleton-loader type="list-item-two-line" />
              <v-skeleton-loader type="list-item-two-line" />
            </v-col>
          </v-row>
        </template>
        <template v-else>
          <v-row>
            <v-col cols="6" class="text-caption text-medium-emphasis pl-4">Ultimo previsto</v-col>
            <v-col cols="6" class="text-right font-weight-medium pr-4">
              <v-chip
                :color="getThresholdClass(harmonieData.lastValue)"
                size="small"
                variant="flat"
                style="max-width: 100%"
              >
                {{ harmonieData.lastValueLabel }}
              </v-chip>
            </v-col>
          </v-row>
          <v-row>
            <v-col cols="5" class="text-caption text-medium-emphasis pl-4">Fecha ultimo</v-col>
            <v-col cols="7" class="text-right font-weight-medium rounded pr-4">
              {{ harmonieData.lastDateLabel }}
            </v-col>
          </v-row>
          <v-row>
            <v-col cols="6" class="text-caption text-medium-emphasis pl-4">Maximo previsto</v-col>
            <v-col cols="6" class="text-right font-weight-medium pr-4">
              <v-chip
                :color="getThresholdClass(harmonieData.maxValue)"
                size="small"
                variant="flat"
                style="max-width: 100%"
              >
                {{ harmonieData.maxValueLabel }}
              </v-chip>
            </v-col>
          </v-row>
          <v-row>
            <v-col cols="5" class="text-caption text-medium-emphasis pl-4">Fecha maximo</v-col>
            <v-col cols="7" class="text-right font-weight-medium rounded pr-4">
              {{ harmonieData.maxDateLabel }}
            </v-col>
          </v-row>
        </template>
      </div>

      <div v-else>
        <div class="text-caption font-weight-bold text-primary mb-1 mt-2 pl-2">EPS Medio</div>

        <v-row>
          <v-col cols="12" class="text-caption text-medium-emphasis pl-4">Fecha simulacion</v-col>
          <v-col cols="12" class="text-right font-weight-medium rounded px-4 pt-0">
            <v-select
              :model-value="epsSelectedDate"
              :items="epsDateOptions"
              item-title="title"
              item-value="value"
              variant="outlined"
              density="compact"
              hide-details
              color="primary"
              @update:model-value="setEpsDate"
            />
          </v-col>
        </v-row>

        <template v-if="loadingEps">
          <v-row>
            <v-col cols="12" class="px-4 py-1">
              <v-skeleton-loader type="list-item-two-line" />
              <v-skeleton-loader type="list-item-two-line" />
            </v-col>
          </v-row>
        </template>
        <template v-else>
          <v-row>
            <v-col cols="6" class="text-caption text-medium-emphasis pl-4">Ultimo previsto</v-col>
            <v-col cols="6" class="text-right font-weight-medium pr-4">
              <v-chip
                :color="getThresholdClass(epstatData.lastValue)"
                size="small"
                variant="flat"
                style="max-width: 100%"
              >
                {{ epstatData.lastValueLabel }}
              </v-chip>
            </v-col>
          </v-row>
          <v-row>
            <v-col cols="5" class="text-caption text-medium-emphasis pl-4">Fecha ultimo</v-col>
            <v-col cols="7" class="text-right font-weight-medium rounded pr-4">
              {{ epstatData.lastDateLabel }}
            </v-col>
          </v-row>
          <v-row>
            <v-col cols="6" class="text-caption text-medium-emphasis pl-4">Maximo previsto</v-col>
            <v-col cols="6" class="text-right font-weight-medium pr-4">
              <v-chip
                :color="getThresholdClass(epstatData.maxValue)"
                size="small"
                variant="flat"
                style="max-width: 100%"
              >
                {{ epstatData.maxValueLabel }}
              </v-chip>
            </v-col>
          </v-row>
          <v-row>
            <v-col cols="5" class="text-caption text-medium-emphasis pl-4">Fecha maximo</v-col>
            <v-col cols="7" class="text-right font-weight-medium rounded pr-4">
              {{ epstatData.maxDateLabel }}
            </v-col>
          </v-row>
        </template>
      </div>
    </v-card-text>
  </v-card>
</template>

<script lang="ts" setup>
  import { computed, ref } from 'vue'
  import { useVModel } from '@vueuse/core'
  import { formatDate, formatSimulationDate, parseDate } from '@/utils/dates'
  import type { StationPrediction } from '@/types/Predictions'

  const props = defineProps<{
    activeTab?: 'caudal' | 'precipitaciones'
    loading?: boolean
    loadingHarmonie?: boolean
    loadingEps?: boolean
    caudalForecastHarmonie?: StationPrediction
    caudalForecastEpstat?: StationPrediction
    precipitationsForecastHarmonie?: StationPrediction
    precipitationsForecastEpstat?: StationPrediction
    selectedHarmonieCaudalDate?: string
    selectedHarmoniePrecipDate?: string
    selectedEpsCaudalDate?: string
    selectedEpsPrecipDate?: string
    harmonieCaudalDates?: string[]
    harmoniePrecipDates?: string[]
    epsCaudalDates?: string[]
    epsPrecipDates?: string[]
    thresholds?: Record<string, unknown>
  }>()

  const emit = defineEmits<{
    (e: 'update:selectedHarmonieCaudalDate', value: string): void
    (e: 'update:selectedHarmoniePrecipDate', value: string): void
    (e: 'update:selectedEpsCaudalDate', value: string): void
    (e: 'update:selectedEpsPrecipDate', value: string): void
  }>()

  const selectedModel = ref<'harmonie' | 'eps'>('harmonie')

  const selectedHarmonieCaudalDateModel = useVModel(props, 'selectedHarmonieCaudalDate', emit, {
    defaultValue: '',
  })

  const selectedHarmoniePrecipDateModel = useVModel(props, 'selectedHarmoniePrecipDate', emit, {
    defaultValue: '',
  })

  const selectedEpsCaudalDateModel = useVModel(props, 'selectedEpsCaudalDate', emit, {
    defaultValue: '',
  })

  const selectedEpsPrecipDateModel = useVModel(props, 'selectedEpsPrecipDate', emit, {
    defaultValue: '',
  })

  function fmtValue(value: number | undefined, unit: string): string {
    if (value == null || !Number.isFinite(value)) return '--'
    return `${value.toFixed(2)} ${unit}`
  }

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

  const yellowThreshold = computed(() =>
    readNumber(['umbral_cauda_1', 'umbral_caudal_1', 'threshold_yellow'], props.thresholds)
  )

  const orangeThreshold = computed(() =>
    readNumber(['umbral_cauda_2', 'umbral_caudal_2', 'threshold_orange'], props.thresholds)
  )

  const redThreshold = computed(() =>
    readNumber(['umbral_cauda_3', 'umbral_caudal_3', 'threshold_red'], props.thresholds)
  )

  function getThresholdClass(value: number | undefined): string {
    if (props.activeTab !== 'caudal' || value == null || !Number.isFinite(value)) return ''
    if (redThreshold.value != null && value >= redThreshold.value) return 'red-lighten-3'
    if (orangeThreshold.value != null && value >= orangeThreshold.value) return 'orange-lighten-3'
    if (yellowThreshold.value != null && value >= yellowThreshold.value) return 'amber-lighten-3'
    return ''
  }

  function toTimestamp(dateValue: string): number {
    return parseDate(dateValue)?.getTime() ?? Number.NEGATIVE_INFINITY
  }

  function summaryFor(prediction: StationPrediction | undefined, unit: string) {
    const results = [...(prediction?.results ?? [])].sort(
      (a, b) => toTimestamp(a.date) - toTimestamp(b.date)
    )
    const last = results.length ? results[results.length - 1] : undefined
    const max = results.length
      ? results.reduce((acc, r) => (r.value > acc.value ? r : acc), results[0])
      : undefined

    return {
      lastValue: last?.value,
      lastValueLabel: fmtValue(last?.value, unit),
      lastDateLabel: formatDate(last?.date),
      maxValue: max?.value,
      maxValueLabel: fmtValue(max?.value, unit),
      maxDateLabel: formatDate(max?.date),
    }
  }

  const unit = computed(() => (props.activeTab === 'caudal' ? 'm3/s' : 'mm'))

  const harmonieData = computed(() =>
    summaryFor(
      props.activeTab === 'caudal'
        ? props.caudalForecastHarmonie
        : props.precipitationsForecastHarmonie,
      unit.value
    )
  )

  const epstatData = computed(() =>
    summaryFor(
      props.activeTab === 'caudal'
        ? props.caudalForecastEpstat
        : props.precipitationsForecastEpstat,
      unit.value
    )
  )

  const harmonieSelectedDate = computed(() =>
    props.activeTab === 'caudal'
      ? selectedHarmonieCaudalDateModel.value
      : selectedHarmoniePrecipDateModel.value
  )

  const setHarmonieDate = (value: string) => updateHarmonieDate(value)

  const harmonieDateOptions = computed(() => {
    const dates =
      props.activeTab === 'caudal' ? props.harmonieCaudalDates : props.harmoniePrecipDates
    return (dates ?? []).map((date) => ({
      title: formatSimulationDate(date),
      value: date,
    }))
  })

  const epsSelectedDate = computed(() =>
    props.activeTab === 'caudal'
      ? selectedEpsCaudalDateModel.value
      : selectedEpsPrecipDateModel.value
  )

  const setEpsDate = (value: string) => updateEpsDate(value)

  const epsDateOptions = computed(() => {
    const dates = props.activeTab === 'caudal' ? props.epsCaudalDates : props.epsPrecipDates
    return (dates ?? []).map((date) => ({
      title: formatSimulationDate(date),
      value: date,
    }))
  })

  function updateHarmonieDate(value: string): void {
    if (props.activeTab === 'caudal') {
      selectedHarmonieCaudalDateModel.value = value
    } else {
      selectedHarmoniePrecipDateModel.value = value
    }
  }

  function updateEpsDate(value: string): void {
    if (props.activeTab === 'caudal') {
      selectedEpsCaudalDateModel.value = value
    } else {
      selectedEpsPrecipDateModel.value = value
    }
  }
</script>

<style scoped></style>
