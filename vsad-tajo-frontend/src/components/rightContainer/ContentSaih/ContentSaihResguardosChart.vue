<template>
  <v-card class="pa-2 bg-surface" elevation="2">
    <v-card-title class="d-flex align-center justify-space-between ga-2 py-3 px-4">
      <div class="text-subtitle-1 font-weight-bold">Resguardos y Volúmenes Mínimos Anual</div>
      <v-select
        v-model="selectedHydrologicalYear"
        :items="hydrologicalYearOptions"
        density="compact"
        variant="outlined"
        hide-details
        class="resguardos-year-select"
        label="Año"
      />
    </v-card-title>
    <v-divider />
    <v-card-text>
      <div class="chart-container">
        <div v-if="loading" class="chart-empty-state">Cargando datos de resguardos...</div>
        <apexchart
          v-else-if="hasSeries"
          type="line"
          :height="200"
          :options="chartOptions"
          :series="series"
        />
        <div v-else class="chart-empty-state">Sin datos para mostrar</div>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import type { ApexOptions } from 'apexcharts'
  import type { SeriesItem } from '@/types/Predictions'
  import type { ResguardosStationResponse } from '@/types/Resguardos'

  const props = defineProps<{
    resguardosData?: ResguardosStationResponse
    loading?: boolean
  }>()

  const selectedHydrologicalYear = ref('2025-2026')
  const hydrologicalYearOptions = ['2025-2026', '2024-2025']

  function getHydrologicalYear(date: Date): string {
    const year = date.getFullYear()
    const month = date.getMonth()
    if (month >= 9) {
      return `${year}-${year + 1}`
    }
    return `${year - 1}-${year}`
  }

  const resguardosEntries = computed(() => {
    const entries = props.resguardosData?.entries ?? {}

    return Object.entries(entries)
      .map(([date, value]) => {
        const timestamp = new Date(date).getTime()
        if (!Number.isFinite(timestamp)) return null
        return {
          date,
          timestamp,
          year: getHydrologicalYear(new Date(timestamp)),
          reserveVolume: value.reserveVolume,
          minimumVolume: value.minimumVolume,
        }
      })
      .filter(
        (
          item
        ): item is {
          date: string
          timestamp: number
          year: string
          reserveVolume: number | null
          minimumVolume: number | null
        } => item !== null
      )
      .sort((a, b) => a.timestamp - b.timestamp)
  })

  const selectedEntries = computed(() => {
    const filtered = resguardosEntries.value.filter(
      (entry) => entry.year === selectedHydrologicalYear.value
    )
    return filtered.length ? filtered : resguardosEntries.value
  })

  const series = computed<SeriesItem[]>(() => {
    if (selectedEntries.value.length) {
      const resguardoSeries = selectedEntries.value
        .filter((item) => Number.isFinite(Number(item.reserveVolume)))
        .map((item) => ({ x: item.date, y: Number(item.reserveVolume) }))

      const minimoSeries = selectedEntries.value
        .filter((item) => Number.isFinite(Number(item.minimumVolume)))
        .map((item) => ({ x: item.date, y: Number(item.minimumVolume) }))

      const apiSeries: SeriesItem[] = []

      if (resguardoSeries.length) {
        apiSeries.push({
          name: 'Resguardo',
          type: 'line',
          data: resguardoSeries,
        })
      }

      if (minimoSeries.length) {
        apiSeries.push({
          name: 'Volumen mínimo',
          type: 'line',
          data: minimoSeries,
        })
      }

      return apiSeries
    }

    const result: SeriesItem[] = []

    return result
  })

  const hasSeries = computed(() => series.value.length > 0)

  const chartOptions = computed<ApexOptions>(() => ({
    chart: {
      type: 'line',
      toolbar: { show: false },
      zoom: { enabled: false },
    },
    colors: ['#5E35B1', '#26A69A'],
    stroke: {
      curve: 'smooth',
      width: [3, 3],
      dashArray: [0, 6],
    },
    dataLabels: { enabled: false },
    legend: {
      position: 'bottom',
      horizontalAlign: 'left',
    },
    xaxis: {
      type: 'datetime',
      labels: {
        datetimeUTC: false,
      },
    },
    yaxis: {
      min: 0,
      title: { text: 'hm3' },
      labels: {
        formatter: (value: number) => value.toFixed(1),
      },
    },
    tooltip: {
      shared: true,
      intersect: false,
      x: {
        format: 'dd/MM/yyyy',
      },
      y: {
        formatter: (value: number) => `${value.toFixed(1)} hm3`,
      },
    },
  }))
</script>

<style scoped>
  .resguardos-year-select {
    max-width: 120px;
  }

  .chart-container {
    min-height: 200px;
  }

  .chart-empty-state {
    min-height: 200px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(0, 0, 0, 0.6);
  }
</style>
