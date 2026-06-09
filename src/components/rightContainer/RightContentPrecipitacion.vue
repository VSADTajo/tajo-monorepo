<template>
  <v-card class="pa-4 bg-background" elevation="2">
    <v-card-title class="d-flex justify-space-between align-start" :style="headerStyle">
      <div>
        <div class="text-h6 font-weight-bold text-white">Precipitación horaria</div>
        <div v-if="layerName" class="text-caption" style="color: rgba(255, 255, 255, 0.8)">
          {{ layerName }}
        </div>
        <div v-if="coords" class="text-caption" style="color: rgba(255, 255, 255, 0.7)">
          {{ coords.lat }}, {{ coords.lng }}
        </div>
      </div>
      <v-btn icon="mdi-close" variant="text" size="small" color="white" @click="closeDrawer" />
    </v-card-title>

    <v-divider class="my-3" />

    <v-progress-linear v-if="loading" indeterminate class="mb-2" />

    <v-card-text>
      <!-- Información de ubicación -->
      <v-sheet class="pa-3 mb-4 rounded" elevation="1">
        <v-row v-if="loading" dense>
          <v-col cols="12" md="4">
            <v-skeleton-loader type="text" class="mb-2" />
          </v-col>
          <v-col cols="12" md="4">
            <v-skeleton-loader type="text" class="mb-2" />
          </v-col>
          <v-col cols="12" md="4">
            <v-skeleton-loader type="text" class="mb-2" />
          </v-col>
        </v-row>

        <v-row v-else dense>
          <v-col cols="12" sm="3" class="mb-2">
            <v-chip
              prepend-icon="mdi-shape"
              variant="tonal"
              size="small"
              class="font-weight-bold"
              style="background-color: #ec9c41; color: #3b2200"
            >
              Subcuenca
            </v-chip>
            <div class="text-body-2 font-weight-medium mt-1">
              {{ locationInfo.subcuenca || '-' }}
            </div>
          </v-col>

          <v-col cols="12" sm="3" class="mb-2">
            <v-chip
              prepend-icon="mdi-shape"
              variant="tonal"
              size="small"
              class="font-weight-bold"
              style="background-color: #b2df8a; color: #1a4a12"
            >
              Sistema
            </v-chip>
            <div class="text-body-2 font-weight-medium mt-1">
              {{ locationInfo.sistema || '-' }}
            </div>
          </v-col>

          <v-col cols="12" sm="3" class="mb-2">
            <v-chip
              prepend-icon="mdi-shape"
              variant="tonal"
              size="small"
              class="font-weight-bold"
              style="background-color: #a0c8e2; color: #0d3a55"
            >
              Zona
            </v-chip>
            <div class="text-body-2 font-weight-medium mt-1">
              {{ locationInfo.zona || '-' }}
            </div>
          </v-col>

          <v-col cols="12" sm="3" class="mb-2">
            <v-chip
              prepend-icon="mdi-shape"
              variant="tonal"
              size="small"
              class="font-weight-bold"
              style="background-color: #976363; color: #fff"
            >
              Comarca
            </v-chip>
            <div class="text-body-2 font-weight-medium mt-1">
              {{ locationInfo.comarca || '-' }}
            </div>
          </v-col>
        </v-row>
      </v-sheet>

      <v-sheet class="pa-4" rounded elevation="1">
        <div class="text-subtitle-2 font-weight-medium mb-3">Precipitación por hora</div>

        <v-skeleton-loader v-if="chartLoading" type="image" height="520" />

        <apexchart
          v-else-if="hasChartData"
          type="bar"
          height="520"
          :options="chartOptions"
          :series="chartSeries"
        />

        <div
          v-else
          class="d-flex flex-column align-center justify-center py-10 text-medium-emphasis"
        >
          <v-icon size="42" class="mb-2">mdi-chart-bar</v-icon>
          <div>Sin datos de precipitación para este punto</div>
          <div class="text-caption mt-1">Lat: {{ coords?.lat }} — Lng: {{ coords?.lng }}</div>
        </div>
      </v-sheet>
    </v-card-text>
  </v-card>
</template>

<script lang="ts" setup>
  import { computed, ref, watch } from 'vue'
  import type { ApexOptions } from 'apexcharts'
  import { useRoute, useRouter } from 'vue-router'
  import { usePrecipitacionLocationInfo } from '@/composables/usePrecipitacionLocationInfo'
  import { useLayersStore } from '@/stores/layersStore'
  import { dynamicLayersConfig } from '@/config/layers.config'
  import { dateFormattedWithHours } from '@/utils/dates'
  import {
    fetchGeoServerLayerPointTimeSeries,
    getGeoServerLayerTimeDimension,
  } from '@/services/geoserverWmsService'
  import type { MeteoAccumulatedImageLayerConfig, WMSLayerConfig } from '@/types/Layers'

  const route = useRoute()
  const router = useRouter()
  const layersStore = useLayersStore()

  const coords = computed(() => {
    const raw = route.query.precipitacion as string | undefined
    if (!raw) return null
    const [lat, lng] = raw.split(',').map(Number)
    if (isNaN(lat) || isNaN(lng)) return null
    return { lat, lng }
  })

  const layerName = computed(() => {
    const id = route.query.precipitacionLayer as string | undefined
    if (!id) return null
    const labels: Record<string, string> = {
      eps_precipitacion_25: 'EPS Precipitación P25',
      eps_precipitacion_75: 'EPS Precipitación P75',
      eps_precipitacion_media: 'EPS Precipitación Media',
      eps_precipitacion_media_acumulada: 'EPS Precipitación Media Acumulada',
      harmonie_precipitacion: 'Harmonie Precipitación',
      harmonie_precipitacion_acumulada: 'Harmonie Precipitación Acumulada',
    }
    return labels[id] ?? id
  })

  const selectedLayerId = computed(() => route.query.precipitacionLayer as string | undefined)

  const selectedLayerConfig = computed(() => {
    const id = selectedLayerId.value
    if (!id) return null

    return dynamicLayersConfig.find((layer) => layer.id === id) ?? null
  })

  const isAccumulatedLayer = computed(
    () => selectedLayerConfig.value?.type === 'METEO_ACCUMULATED_IMAGE'
  )

  const chartSourceLayerConfig = computed(() => {
    const config = selectedLayerConfig.value
    if (!config) return null

    if (config.type === 'WMS') {
      return config as WMSLayerConfig
    }

    if (config.type !== 'METEO_ACCUMULATED_IMAGE') {
      return null
    }

    const sourceId = (config as MeteoAccumulatedImageLayerConfig).chartSourceLayerId
    if (!sourceId) return null

    const sourceConfig = dynamicLayersConfig.find((layer) => layer.id === sourceId)
    if (!sourceConfig || sourceConfig.type !== 'WMS') return null

    return sourceConfig as WMSLayerConfig
  })

  const selectedLayerState = computed(() => {
    const id = selectedLayerId.value
    if (!id) return null
    return layersStore.layers[id]
  })

  const chartLoading = ref(false)
  const chartSeries = ref<Array<{ name: string; data: Array<{ x: string; y: number | null }> }>>([])
  const chartTemporalStepHours = ref(1)
  const temporalFallbackByLayer = ref<
    Record<string, { start: string; end: string; stepHours: number }>
  >({})

  const hasChartData = computed(() =>
    chartSeries.value.some((serie) => serie.data.some((point) => Number.isFinite(point.y)))
  )

  const xAxisCategories = computed(() => chartSeries.value[0]?.data.map((point) => point.x) ?? [])

  const xAxisLabelStep = computed(() => {
    const stepHours = chartTemporalStepHours.value
    return Math.max(1, Math.ceil(12 / stepHours))
  })

  const chartOptions = computed<ApexOptions>(() => ({
    chart: {
      type: 'bar',
      toolbar: { show: true },
      zoom: { enabled: true },
    },
    colors: [
      ({ value }: { value: number }) => {
        if (value <= 0.1) return '#ffffff'
        if (value <= 1) return '#c7c7c5'
        if (value <= 5) return '#79baec'
        if (value <= 10) return '#0000ff'
        if (value <= 20) return '#4cc417'
        if (value <= 40) return '#ffff00'
        if (value <= 70) return '#f87a17'
        if (value <= 100) return '#ff0000'
        if (value <= 150) return '#461b7e'
        return '#000000'
      },
    ],
    dataLabels: { enabled: false },
    plotOptions: {
      bar: {
        borderRadius: 4,
        columnWidth: '68%',
        distributed: false,
      },
    },
    xaxis: {
      type: 'category',
      categories: xAxisCategories.value,
      labels: {
        rotate: -30,
        hideOverlappingLabels: true,
        formatter: (value: string) => {
          const index = xAxisCategories.value.indexOf(value)
          if (index < 0) return value
          return index % xAxisLabelStep.value === 0 ? value : ''
        },
      },
    },
    yaxis: {
      min: 0,
      title: { text: 'mm' },
      labels: {
        formatter: (value: number) => value.toFixed(2),
      },
    },
    tooltip: {
      x: { show: true },
      y: {
        formatter: (value: number) => `${Number(value).toFixed(2)} mm`,
      },
    },
    noData: {
      text: 'Sin datos',
    },
  }))

  function shadeHex(hex: string, factor: number): string {
    const n = parseInt(hex.replace('#', ''), 16)
    const r = Math.round(((n >> 16) & 0xff) * factor)
    const g = Math.round(((n >> 8) & 0xff) * factor)
    const b = Math.round((n & 0xff) * factor)
    return `#${[r, g, b].map((c) => Math.min(255, c).toString(16).padStart(2, '0')).join('')}`
  }

  const headerStyle = computed(() => {
    const base = '#1E88E5'
    const darker = shadeHex(base, 0.65)
    return {
      background: `linear-gradient(135deg, ${base} 0%, ${darker} 100%)`,
      margin: '-16px -16px 0 -16px',
      padding: '16px',
      borderRadius: '4px 4px 0 0',
    }
  })

  async function resolveTemporalRange(layerConfig: WMSLayerConfig): Promise<{
    start: string
    end: string
    stepHours: number
  } | null> {
    const state = selectedLayerState.value
    const hasRangeParams = Boolean(state?.params?.from && state?.params?.to)

    if (isAccumulatedLayer.value && hasRangeParams) {
      return {
        start: state?.params?.from ?? '',
        end: state?.params?.to ?? '',
        stepHours: state?.temporal?.stepHours ?? 1,
      }
    }

    const stateTemporal = state?.temporal
    if (stateTemporal) {
      return stateTemporal
    }

    const cachedTemporal = temporalFallbackByLayer.value[layerConfig.id]
    if (cachedTemporal) {
      return cachedTemporal
    }

    const capabilitiesTemporal = await getGeoServerLayerTimeDimension({
      url: layerConfig.url,
      layerName: layerConfig.layers,
    })

    if (!capabilitiesTemporal) {
      return null
    }

    const parsedEnd = new Date(capabilitiesTemporal.end)
    const safeEnd = new Date(parsedEnd.getTime() - capabilitiesTemporal.stepHours * 60 * 60 * 1000)

    const fallbackTemporal = {
      start: capabilitiesTemporal.start,
      end: Number.isNaN(safeEnd.getTime()) ? capabilitiesTemporal.end : safeEnd.toISOString(),
      stepHours: capabilitiesTemporal.stepHours,
    }

    temporalFallbackByLayer.value[layerConfig.id] = fallbackTemporal
    return fallbackTemporal
  }

  async function loadChartData() {
    const currentCoords = coords.value
    const layerConfig = chartSourceLayerConfig.value
    const temporal = layerConfig ? await resolveTemporalRange(layerConfig) : null

    if (!currentCoords || !layerConfig || !temporal) {
      chartSeries.value = []
      return
    }

    chartLoading.value = true

    try {
      chartTemporalStepHours.value = temporal.stepHours

      const timeSeries = await fetchGeoServerLayerPointTimeSeries({
        url: layerConfig.url,
        layerName: layerConfig.layers,
        lat: currentCoords.lat,
        lng: currentCoords.lng,
        startIso: temporal.start,
        endIso: temporal.end,
        stepHours: temporal.stepHours,
      })

      const isAccumulated = isAccumulatedLayer.value
      let runningTotal = 0
      const chartData = timeSeries.map((entry) => {
        const value = entry.value ?? 0
        runningTotal += value

        return {
          x: dateFormattedWithHours(new Date(entry.time).getTime()),
          y: isAccumulated ? runningTotal : value,
        }
      })

      chartSeries.value = [
        {
          name: layerName.value ?? 'Precipitación',
          data: chartData,
        },
      ]
    } catch {
      console.error('[RightContentPrecipitacion] loadChartData failed')
      chartSeries.value = []
    } finally {
      chartLoading.value = false
    }
  }

  const { loading, locationInfo, fetchLocationInfo } = usePrecipitacionLocationInfo(
    coords.value?.lat ?? null,
    coords.value?.lng ?? null
  )

  watch(
    () => route.query.precipitacion,
    (newPrecipitacion) => {
      if (newPrecipitacion) {
        const [lat, lng] = (newPrecipitacion as string).split(',').map(Number)
        if (!isNaN(lat) && !isNaN(lng)) {
          fetchLocationInfo(lat, lng)
          void loadChartData()
        }
      }
    },
    { immediate: true }
  )

  watch(
    () => [
      route.query.precipitacionLayer,
      selectedLayerState.value?.params?.time,
      selectedLayerState.value?.params?.from,
      selectedLayerState.value?.params?.to,
    ],
    () => {
      void loadChartData()
    }
  )

  function closeDrawer() {
    const queryObj = { ...route.query }
    delete queryObj.precipitacion
    delete queryObj.precipitacionLayer
    router.replace({ query: queryObj })
  }
</script>
