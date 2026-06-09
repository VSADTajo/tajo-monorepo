<template>
  <div>
    <div v-if="loading" class="chart-loading-state" :style="{ height: `${resolvedHeight}px` }">
      <v-skeleton-loader type="image" class="h-100 w-100" />
    </div>

    <div
      v-else-if="hasRenderableSeries"
      class="combined-chart"
      :style="{ height: `${resolvedHeight}px` }"
    >
      <apexchart :height="precipHeight" :options="precipOptions" :series="precipSeries" />
      <apexchart :height="caudalHeight" :options="caudalOptions" :series="caudalSeries" />
    </div>

    <div v-else class="chart-empty-state" :style="{ height: `${resolvedHeight}px` }">
      Sin datos para mostrar
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import type { ApexOptions } from 'apexcharts'
  import type { DataStationPrediction } from '@/types/Predictions'
  import { dateFormattedWithHours } from '@/utils/dates'

  type DateValue = { date: string; value: number | null }

  const props = withDefaults(
    defineProps<{
      caudalData: DataStationPrediction
      precipitationsData: DataStationPrediction
      loading?: boolean
      height?: number
    }>(),
    {
      loading: false,
      height: 510,
    }
  )

  const resolvedHeight = computed(() => props.height)
  const precipHeight = computed(() => Math.round(resolvedHeight.value * 0.32))
  const caudalHeight = computed(() => resolvedHeight.value - precipHeight.value)

  function normalizePredictionResults(
    prediction?: DataStationPrediction['forecastHarmonie']
  ): DateValue[] {
    if (!prediction?.results?.length) return []

    return prediction.results
      .map((result) => {
        const timestamp = new Date(result.date).getTime()
        if (!Number.isFinite(timestamp)) return null

        const numericValue = Number(result.value)
        return {
          date: result.date,
          value: Number.isFinite(numericValue) ? numericValue : null,
        }
      })
      .filter((item): item is DateValue => item !== null)
  }

  const caudalHistorical = computed(() => normalizePredictionResults(props.caudalData.historical))
  const caudalHarmonie = computed(() =>
    normalizePredictionResults(props.caudalData.forecastHarmonie)
  )
  const caudalEps = computed(() => normalizePredictionResults(props.caudalData.forecastEpsat))

  const precipHistorical = computed(() =>
    normalizePredictionResults(props.precipitationsData.historical)
  )
  const precipHarmonie = computed(() =>
    normalizePredictionResults(props.precipitationsData.forecastHarmonie)
  )
  const precipEps = computed(() =>
    normalizePredictionResults(props.precipitationsData.forecastEpsat)
  )

  const allDates = computed(() => {
    const dates = new Set<string>()

    caudalHistorical.value.forEach((item) => dates.add(item.date))
    caudalHarmonie.value.forEach((item) => dates.add(item.date))
    caudalEps.value.forEach((item) => dates.add(item.date))
    precipHistorical.value.forEach((item) => dates.add(item.date))
    precipHarmonie.value.forEach((item) => dates.add(item.date))
    precipEps.value.forEach((item) => dates.add(item.date))

    return Array.from(dates).sort()
  })

  const xLabels = computed(() =>
    allDates.value.map((date) => dateFormattedWithHours(new Date(date).getTime()))
  )

  function mapToLabelValues(seriesData: DateValue[]) {
    const byDate = new Map(seriesData.map((item) => [item.date, item.value]))

    return allDates.value.map((date, index) => ({
      x: xLabels.value[index],
      y: byDate.get(date) ?? null,
    }))
  }

  function hasAnyFinite(values: Array<number | null>): boolean {
    return values.some((value) => Number.isFinite(value))
  }

  const precipSeries = computed(() => {
    const result: Array<{
      name: string
      type: 'bar'
      data: Array<{ x: string; y: number | null }>
    }> = []

    const observedData = mapToLabelValues(precipHistorical.value)
    if (hasAnyFinite(observedData.map((point) => point.y))) {
      result.push({ name: 'Precipitación observada', type: 'bar', data: observedData })
    }

    const harmonieData = mapToLabelValues(precipHarmonie.value)
    if (hasAnyFinite(harmonieData.map((point) => point.y))) {
      result.push({ name: 'Precipitación Harmonie', type: 'bar', data: harmonieData })
    }

    const epsData = mapToLabelValues(precipEps.value)
    if (hasAnyFinite(epsData.map((point) => point.y))) {
      result.push({ name: 'Precipitación EPS', type: 'bar', data: epsData })
    }

    return result
  })

  const caudalSeries = computed(() => {
    const result: Array<{
      name: string
      type: 'line'
      data: Array<{ x: string; y: number | null }>
    }> = []

    const observedData = mapToLabelValues(caudalHistorical.value)
    if (hasAnyFinite(observedData.map((point) => point.y))) {
      result.push({ name: 'Caudal observado', type: 'line', data: observedData })
    }

    const harmonieData = mapToLabelValues(caudalHarmonie.value)
    if (hasAnyFinite(harmonieData.map((point) => point.y))) {
      result.push({ name: 'Caudal Harmonie', type: 'line', data: harmonieData })
    }

    const epsData = mapToLabelValues(caudalEps.value)
    if (hasAnyFinite(epsData.map((point) => point.y))) {
      result.push({ name: 'Caudal EPS', type: 'line', data: epsData })
    }

    return result
  })

  const hasRenderableSeries = computed(
    () => precipSeries.value.length > 0 || caudalSeries.value.length > 0
  )

  const sharedTooltip: ApexOptions['tooltip'] = {
    shared: true,
    intersect: false,
    followCursor: true,
    x: {
      show: true,
    },
  }

  const precipOptions = computed<ApexOptions>(() => ({
    chart: {
      id: 'hydro-precip',
      group: 'hydro-combined',
      type: 'bar',
      toolbar: { show: false },
      zoom: { enabled: true },
      animations: { enabled: false },
    },
    stroke: {
      width: [0, 0, 0],
    },
    plotOptions: {
      bar: {
        columnWidth: '62%',
        borderRadius: 0,
      },
    },
    dataLabels: { enabled: false },
    legend: { show: false },
    colors: ['#1B8A5A', '#6FBF9A', '#9AD0B3'],
    grid: {
      padding: {
        top: 8,
        right: 14,
        left: 6,
        bottom: 0,
      },
      borderColor: '#D0D3D4',
      strokeDashArray: 3,
    },
    xaxis: {
      type: 'category',
      position: 'top',
      tickPlacement: 'on',
      labels: {
        show: true,
        rotate: 0,
        hideOverlappingLabels: true,
      },
      axisBorder: {
        show: true,
      },
      axisTicks: {
        show: true,
      },
    },
    yaxis: {
      reversed: true,
      min: 0,
      title: {
        text: 'Precipitación (mm)',
      },
      labels: {
        formatter: (value) => `${Math.abs(value).toFixed(0)}`,
      },
    },
    tooltip: {
      ...sharedTooltip,
      y: {
        formatter: (value) => (value == null ? '-' : `${value.toFixed(2)} mm`),
      },
    },
  }))

  const caudalOptions = computed<ApexOptions>(() => ({
    chart: {
      id: 'hydro-caudal',
      group: 'hydro-combined',
      type: 'line',
      toolbar: { show: true },
      zoom: { enabled: true },
      animations: { enabled: false },
    },
    stroke: {
      curve: 'smooth',
      width: [2.5, 2, 2],
    },
    dataLabels: { enabled: false },
    colors: ['#1E3A8A', '#2563EB', '#60A5FA'],
    grid: {
      padding: {
        top: 0,
        right: 14,
        left: 6,
        bottom: 8,
      },
      borderColor: '#D0D3D4',
      strokeDashArray: 3,
    },
    xaxis: {
      type: 'category',
      position: 'bottom',
      tickPlacement: 'on',
      labels: {
        show: true,
        rotate: 0,
        hideOverlappingLabels: true,
      },
      axisBorder: {
        show: true,
      },
      axisTicks: {
        show: true,
      },
      title: {
        text: 'Tiempo',
      },
    },
    yaxis: {
      title: {
        text: 'Caudal (m3/s)',
      },
      decimalsInFloat: 2,
    },
    tooltip: {
      ...sharedTooltip,
      y: {
        formatter: (value) => (value == null ? '-' : `${value.toFixed(2)} m3/s`),
      },
    },
    legend: {
      show: true,
      position: 'top',
      horizontalAlign: 'right',
    },
  }))
</script>

<style scoped>
  .combined-chart {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .chart-loading-state,
  .chart-empty-state {
    display: flex;
    align-items: stretch;
    justify-content: stretch;
  }

  .chart-empty-state {
    align-items: center;
    justify-content: center;
  }
</style>
