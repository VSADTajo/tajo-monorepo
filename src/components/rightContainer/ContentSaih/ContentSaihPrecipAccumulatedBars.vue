<template>
  <v-card class="pa-2 bg-surface" elevation="2">
    <v-card-title class="d-flex flex-wrap align-center justify-space-between ga-2 py-2 px-0">
      <span class="text-subtitle-1 font-weight-bold pl-2">Acumulado Precipitación</span>
      <v-btn-toggle
        v-model="selectedProvider"
        mandatory
        density="compact"
        color="primary"
        divided
        variant="outlined"
      >
        <v-btn value="observed" size="small">Observado</v-btn>
        <v-btn value="harmonie" size="small">Harmonie</v-btn>
        <v-btn value="eps" size="small">EPS Medio</v-btn>
        <v-btn value="p10" size="small">P10</v-btn>
        <v-btn value="p25" size="small">P25</v-btn>
        <v-btn value="p75" size="small">P75</v-btn>
        <v-btn value="p90" size="small">P90</v-btn>
      </v-btn-toggle>
    </v-card-title>

    <v-divider class="mb-2" />

    <div v-if="loading" class="chart-loading" :style="{ height: `${chartHeight}px` }">
      <v-skeleton-loader type="image" class="h-100 w-100" />
    </div>

    <apexchart
      v-else-if="hasData"
      :key="`precip-bars-${selectedProvider}`"
      type="bar"
      :height="chartHeight"
      :options="chartOptions"
      :series="series"
    />

    <div v-else class="chart-empty" :style="{ height: `${chartHeight}px` }">
      Sin datos para mostrar
    </div>
  </v-card>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import type { ApexOptions } from 'apexcharts'
  import type { StationPrediction } from '@/types/Predictions'
  import {
    extractAccumulatedHorizonValuesWithMode,
    PRECIP_HORIZON_META,
  } from '../utils/precipAccumulation'
  import {
    DEFAULT_PRECIP_THRESHOLDS_GRAVE,
    DEFAULT_PRECIP_THRESHOLDS_LEVE,
    DEFAULT_PRECIP_THRESHOLDS_MEDIO,
  } from '../utils/precipThresholds'

  type ThresholdValues = {
    h0?: number | null
    h1?: number | null
    h2?: number | null
    h4?: number | null
    h8?: number | null
    h12?: number | null
    h24?: number | null
  }

  const props = withDefaults(
    defineProps<{
      precipitationsHistorical?: StationPrediction
      precipitationsForecastHarmonie?: StationPrediction
      precipitationsForecastEpstat?: StationPrediction
      precipitationsForecastEnsP10?: StationPrediction
      precipitationsForecastEnsP25?: StationPrediction
      precipitationsForecastEnsP75?: StationPrediction
      precipitationsForecastEnsP90?: StationPrediction
      forecastHarmonie?: StationPrediction
      forecastEpsat?: StationPrediction
      thresholdsLeve?: ThresholdValues
      thresholdsMedio?: ThresholdValues
      thresholdsGrave?: ThresholdValues
      loading?: boolean
      height?: number
    }>(),
    {
      precipitationsHistorical: undefined,
      precipitationsForecastHarmonie: undefined,
      precipitationsForecastEpstat: undefined,
      precipitationsForecastEnsP10: undefined,
      precipitationsForecastEnsP25: undefined,
      precipitationsForecastEnsP75: undefined,
      precipitationsForecastEnsP90: undefined,
      forecastHarmonie: undefined,
      forecastEpsat: undefined,
      thresholdsLeve: () => ({ ...DEFAULT_PRECIP_THRESHOLDS_LEVE }),
      thresholdsMedio: () => ({ ...DEFAULT_PRECIP_THRESHOLDS_MEDIO }),
      thresholdsGrave: () => ({ ...DEFAULT_PRECIP_THRESHOLDS_GRAVE }),
      loading: false,
      height: 320,
    }
  )

  const selectedProvider = ref<'observed' | 'harmonie' | 'eps' | 'p10' | 'p25' | 'p75' | 'p90'>(
    'observed'
  )

  const harmoniePrediction = computed<StationPrediction | undefined>(
    () => props.precipitationsForecastHarmonie ?? props.forecastHarmonie
  )

  const epsPrediction = computed<StationPrediction | undefined>(
    () => props.precipitationsForecastEpstat ?? props.forecastEpsat
  )

  const p10Prediction = computed<StationPrediction | undefined>(
    () => props.precipitationsForecastEnsP10
  )
  const p25Prediction = computed<StationPrediction | undefined>(
    () => props.precipitationsForecastEnsP25
  )
  const p75Prediction = computed<StationPrediction | undefined>(
    () => props.precipitationsForecastEnsP75
  )
  const p90Prediction = computed<StationPrediction | undefined>(
    () => props.precipitationsForecastEnsP90
  )

  const selectedPrediction = computed<StationPrediction | undefined>(() => {
    if (selectedProvider.value === 'observed') return props.precipitationsHistorical
    if (selectedProvider.value === 'harmonie') return harmoniePrediction.value
    if (selectedProvider.value === 'p10') return p10Prediction.value
    if (selectedProvider.value === 'p25') return p25Prediction.value
    if (selectedProvider.value === 'p75') return p75Prediction.value
    if (selectedProvider.value === 'p90') return p90Prediction.value
    return epsPrediction.value
  })

  const horizonValues = computed(() =>
    extractAccumulatedHorizonValuesWithMode(
      selectedPrediction.value,
      selectedProvider.value === 'observed' ? 'backward' : 'forward'
    )
  )

  const displayHorizons = computed(() => {
    const horizons = PRECIP_HORIZON_META.filter((item) => item.hours > 0)
    return selectedProvider.value === 'observed' ? [...horizons].reverse() : horizons
  })

  const categories = computed(() =>
    displayHorizons.value.map((item) =>
      selectedProvider.value === 'observed' ? `-${Math.abs(item.hours)}hs` : item.label
    )
  )
  const values = computed(() =>
    displayHorizons.value.map((item) => horizonValues.value[item.key] ?? 0)
  )
  const leveValues = computed(() =>
    displayHorizons.value.map((item) => props.thresholdsLeve?.[item.key] ?? null)
  )
  const medioValues = computed(() =>
    displayHorizons.value.map((item) => props.thresholdsMedio?.[item.key] ?? null)
  )
  const graveValues = computed(() =>
    displayHorizons.value.map((item) => props.thresholdsGrave?.[item.key] ?? null)
  )

  const hasData = computed(() => Boolean(selectedPrediction.value?.results?.length))

  const series = computed(() => [
    {
      type: 'bar',
      name:
        selectedProvider.value === 'observed'
          ? 'Observado'
          : selectedProvider.value === 'harmonie'
            ? 'Harmonie'
            : selectedProvider.value === 'eps'
              ? 'EPS Medio'
              : selectedProvider.value.toUpperCase(),
      data: values.value,
    },
    {
      type: 'line',
      name: 'Leve',
      data: leveValues.value,
    },
    {
      type: 'line',
      name: 'Medio',
      data: medioValues.value,
    },
    {
      type: 'line',
      name: 'Grave',
      data: graveValues.value,
    },
  ])

  const chartHeight = computed(() => props.height)

  const chartOptions = computed<ApexOptions>(() => ({
    chart: {
      toolbar: { show: true },
      animations: { enabled: true },
    },
    stroke: {
      width: [0, 2, 2, 2],
      curve: 'straight',
    },
    plotOptions: {
      bar: {
        borderRadius: 4,
        columnWidth: '50%',
      },
    },
    markers: {
      size: [0, 7, 7, 7],
      strokeWidth: 0,
      hover: { sizeOffset: 1 },
    },
    dataLabels: {
      enabled: true,
      enabledOnSeries: [0],
      formatter: (value: number) => (Number.isFinite(value) ? value.toFixed(1) : '--'),
      style: {
        fontSize: '10px',
      },
    },
    xaxis: {
      categories: categories.value,
      labels: {
        rotate: 0,
      },
    },
    yaxis: {
      title: {
        text: 'mm acumulados',
      },
      min: 0,
      decimalsInFloat: 1,
      forceNiceScale: true,
      labels: {
        formatter: (value: number) => (Number.isFinite(value) ? value.toFixed(1) : '--'),
      },
    },
    colors: [
      selectedProvider.value === 'observed'
        ? '#2e7d32'
        : selectedProvider.value === 'harmonie'
          ? '#1976d2'
          : selectedProvider.value === 'eps'
            ? '#00897b'
            : selectedProvider.value === 'p10'
              ? '#b0bec5'
              : selectedProvider.value === 'p25'
                ? '#757575'
                : selectedProvider.value === 'p75'
                  ? '#616161'
                  : '#90a4ae',
      '#fdd835',
      '#fb923c',
      '#ef5350',
    ],
    tooltip: {
      followCursor: true,
      y: {
        formatter: (value: number) => (Number.isFinite(value) ? `${value.toFixed(1)} mm` : '--'),
      },
    },
    grid: {
      borderColor: '#e0e0e0',
      strokeDashArray: 3,
    },
    legend: { show: true, position: 'bottom' },
  }))
</script>

<style scoped>
  .chart-loading,
  .chart-empty {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .chart-empty {
    color: rgba(0, 0, 0, 0.55);
    font-size: 0.9rem;
  }
</style>
