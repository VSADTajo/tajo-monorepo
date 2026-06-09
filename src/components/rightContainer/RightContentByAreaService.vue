<template>
  <v-card class="pa-2 bg-background" elevation="2">
    <v-progress-linear v-if="loading" indeterminate />

    <!-- Skeleton while loading -->
    <template v-if="loading">
      <div class="pa-4">
        <v-skeleton-loader type="heading" height="28" class="mb-2" />
        <v-skeleton-loader type="text" height="18" class="mb-2" />
        <v-skeleton-loader type="list-item" class="mb-2" />
      </div>
    </template>

    <template v-else-if="selectedRouteValue">
      <!-- Header estilo RightContentSaih -->
      <v-card-title class="d-flex justify-space-between align-start pa-6" :style="headerStyle">
        <div>
          <div class="text-h6 font-weight-bold" style="color: white">
            {{ feature?.properties?.nombre ?? selectedRouteValue }}
          </div>
          <div
            v-if="feature?.properties?.code"
            class="text-caption"
            style="color: rgba(255, 255, 255, 0.9)"
          >
            {{ feature.properties.name }}
          </div>
        </div>

        <v-btn
          icon="mdi-close"
          variant="text"
          size="small"
          style="color: white"
          @click="closeDrawer"
        />
      </v-card-title>

      <v-card-text>
        <!-- Chip tipo -->
        <div class="d-flex justify-space-between align-center flex-wrap ga-4 w-100">
          <div class="mb-3 mt-2">
            <v-chip
              prepend-icon="mdi-shape"
              :color="headerBaseColor"
              variant="tonal"
              size="small"
              class="font-weight-bold"
            >
              {{ kindLabel }}
            </v-chip>
          </div>

          <div
            v-if="areaValue || perimeterValue"
            class="mb-3 mt-2 d-flex flex-wrap ga-2 ms-auto justify-end"
          >
            <v-chip v-if="areaValue" size="small" variant="outlined">
              Area: {{ Number(areaValue).toFixed(2) }} km2
            </v-chip>
            <v-chip v-if="perimeterValue" size="small" variant="outlined">
              Perimetro: {{ Number(perimeterValue).toFixed(2) }} km
            </v-chip>
          </div>
        </div>

        <v-divider class="mb-3" />

        <v-row>
          <v-col cols="12" sm="4">
            <v-card>
              <MapDetail
                :type="mapType"
                :stations="stations"
                :selected-station-code="selectedStationCode"
                @update:selected-station-code="selectedStationCode = $event"
              />
            </v-card>
          </v-col>
          <v-col cols="12" sm="8">
            <v-card>
              <ByAreaStationsTable
                :stations="stations"
                :loading="loadingStations"
                :selected-station-code="selectedStationCode"
                @update:selected-station-code="selectedStationCode = $event"
              />
            </v-card>
          </v-col>
        </v-row>

        <v-row class="mt-2">
          <v-col cols="12">
            <v-card class="pa-2 bg-background" elevation="2">
              <template v-if="loadingChart || selectedChartData">
                <v-card-title class="text-subtitle-1 font-weight-bold pb-0">
                  {{
                    selectedSeries === 'caudal'
                      ? `Caudal - ${selectedStationName}`
                      : `Precipitación - ${selectedStationName}`
                  }}
                </v-card-title>

                <v-card-text class="bg-surface mt-2 border-radius-4" elevation="2">
                  <ForecastChartNew
                    v-if="selectedSeries === 'caudal'"
                    :data="selectedChartData ?? {}"
                    :loading="loadingChart"
                    :height="500"
                    :toolbar="false"
                    :thresholds="currentStationThresholds"
                  />

                  <div v-else>
                    <v-tabs v-model="selectedPrecipChartTab" class="bg-surface px-2">
                      <v-tab value="precipitaciones">Precipitaciones</v-tab>
                      <v-tab value="acumuladas">Acumuladas</v-tab>
                    </v-tabs>

                    <v-window v-model="selectedPrecipChartTab" class="flex-grow-1">
                      <v-window-item value="precipitaciones" class="h-100">
                        <v-sheet class="pa-2 h-100 d-flex flex-column">
                          <PrecipitationsChart
                            :data="selectedChartData ?? {}"
                            :loading="loadingChart"
                            mode="precipitations"
                          />
                        </v-sheet>
                      </v-window-item>

                      <v-window-item value="acumuladas" class="h-100">
                        <v-sheet class="pa-2 h-100 d-flex flex-column">
                          <PrecipitationsChart
                            :data="selectedChartData ?? {}"
                            :loading="loadingChart"
                            mode="accumulated"
                          />
                        </v-sheet>
                      </v-window-item>
                    </v-window>
                  </div>
                </v-card-text>
              </template>

              <v-card-text
                v-else
                class="bg-surface mt-2 d-flex align-center justify-center text-medium-emphasis"
                style="height: 360px"
              >
                Selecciona una estación en la tabla para ver su gráfica.
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-card-text>
    </template>
  </v-card>
</template>

<script lang="ts" setup>
  import { computed, onBeforeUnmount, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import type { DataStationPrediction, PredictionTypeName } from '@/types/Predictions'
  import {
    useSubcuencaSelectionBus,
    type SubcuencaSeriesMode,
  } from '@/composables/useSubcuencaSelectionBus'
  import ForecastChartNew from '../charts/ForecastChartNew.vue'
  import PrecipitationsChart from '../charts/PrecipitationsChart.vue'
  import MapDetail from './MapDetail.vue'
  import ByAreaStationsTable from './ByAreaStationsTable.vue'
  import { getWFSFeatureById } from '@/services/geoserver'
  import { dynamicLayersConfig } from '@/config/layers.config'
  import type { WFSLayerConfig } from '@/types/Layers'
  import type { StationData } from '@/utils/stationsToGeoJSON'
  import {
    getAvailablePredictionsService,
    getHistoricalPredictionService,
    getPredictionsService,
  } from '@/services/predictions'
  import { getStationsByAreaService } from '@/services/general'
  import {
    subcuencasStyle,
    sistemas10Style,
    zonasexplStyle,
    comarcasagrariasStyle,
  } from '@/config/styles/layerStyles'

  const props = withDefaults(
    defineProps<{
      kind?: 'subcuenca' | 'sistema' | 'zona' | 'comarca'
    }>(),
    {
      kind: 'subcuenca',
    }
  )

  const route = useRoute()
  const router = useRouter()
  const selectionBus = useSubcuencaSelectionBus()

  const loading = ref(false)
  const loadingStations = ref(false)
  const loadingChart = ref(false)
  const feature = ref<GeoJSON.Feature | null>(null)
  const stations = ref<StationData[]>([])
  const selectedStationCode = ref<string | null>(null)
  const selectedChartData = ref<DataStationPrediction | null>(null)
  const selectedSeries = ref<SubcuencaSeriesMode>('caudal')
  const selectedPrecipChartTab = ref<'precipitaciones' | 'acumuladas'>('precipitaciones')
  const selectedStationName = ref('')
  let stationsRequestId = 0
  let chartFetchId = 0

  const routeKey = computed(() => {
    if (props.kind === 'sistema') return 'sistema'
    if (props.kind === 'zona') return 'zona'
    if (props.kind === 'comarca') return 'comarca'
    return 'subcuenca'
  })
  const selectedRouteValue = computed(() => {
    const value = route.query[routeKey.value]
    return typeof value === 'string' ? value : undefined
  })
  const kindLabel = computed(() => {
    if (props.kind === 'sistema') return 'Sistema'
    if (props.kind === 'zona') return 'Zona'
    if (props.kind === 'comarca') return 'Comarca'
    return 'Subcuenca'
  })

  const mapType = computed(() => {
    if (props.kind === 'sistema') return 'sistemas10'
    if (props.kind === 'zona') return 'zonasexpl'
    if (props.kind === 'comarca') return 'comarcasagrarias'
    return 'subcuencas'
  })

  const headerBaseColor = computed(() => {
    if (props.kind === 'sistema') return sistemas10Style.normal.fillColor ?? '#000000'
    if (props.kind === 'zona') return zonasexplStyle.normal.fillColor ?? '#000000'
    if (props.kind === 'comarca') return comarcasagrariasStyle.normal.fillColor ?? '#000000'
    return subcuencasStyle.normal.fillColor ?? '#000000'
  })

  function hexToRgb(hex: string): [number, number, number] {
    const value = hex.replace('#', '')
    const full =
      value.length === 3
        ? value
            .split('')
            .map((c) => c + c)
            .join('')
        : value
    const num = Number.parseInt(full, 16)

    return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
  }

  function darkenHex(hex: string, factor: number): string {
    const [r, g, b] = hexToRgb(hex)
    const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)))

    return `rgb(${clamp(r * factor)}, ${clamp(g * factor)}, ${clamp(b * factor)})`
  }

  const headerDarkColor = computed(() => darkenHex(headerBaseColor.value ?? '#000000', 0.72))

  const headerStyle = computed(() => ({
    background: `linear-gradient(135deg, ${headerBaseColor.value} 0%, ${headerDarkColor.value} 100%)`,
    margin: '-8px -8px 0 -8px',
  }))

  const areaValue = computed(() => {
    const props = feature.value?.properties
    if (!props?.area) return ''
    return String(props.area)
  })

  const perimeterValue = computed(() => {
    const props = feature.value?.properties
    if (!props?.perimetro) return ''
    return String(props.perimetro)
  })

  const layerConfig = computed(() => {
    const idMap: Record<string, string> = {
      sistema: 'sistemas10',
      zona: 'zonasexpl',
      comarca: 'comarcasagrarias',
      subcuenca: 'subcuencas',
    }

    return dynamicLayersConfig.find((l) => l.id === idMap[props.kind]) as WFSLayerConfig | undefined
  })

  const currentStationThresholds = computed<Record<string, unknown> | undefined>(() => {
    if (!selectedStationCode.value) return undefined
    const station = stations.value.find((s) => s.stationCode === selectedStationCode.value)

    return (station?.threshold ?? null) as Record<string, unknown> | undefined
  })

  function getStationsLookupValueFromFeature(targetFeature: GeoJSON.Feature | null): string {
    const featureProps = (targetFeature?.properties ?? {}) as Record<string, unknown>
    let value: unknown
    if (props.kind === 'sistema') {
      value =
        featureProps.sistema ?? featureProps.systemName ?? featureProps.name ?? featureProps.nombre
    } else if (props.kind === 'zona') {
      value = featureProps.ogc_fid != null ? String(featureProps.ogc_fid) : ''
    } else if (props.kind === 'comarca') {
      value =
        featureProps.ds_comarca ??
        featureProps.comarcaName ??
        featureProps.comarca ??
        featureProps.name ??
        featureProps.nombre
    } else {
      value =
        featureProps.cuencasname ??
        featureProps.cuencasName ??
        featureProps.name ??
        featureProps.nombre
    }

    if (typeof value !== 'string') return ''

    return value.trim()
  }

  async function loadStations(lookupValue: string): Promise<void> {
    const requestId = ++stationsRequestId

    if (!lookupValue) {
      loadingStations.value = false
      stations.value = []
      return
    }

    loadingStations.value = true

    try {
      let searchParams: Parameters<typeof getStationsByAreaService>[0]
      if (props.kind === 'sistema') {
        searchParams = { sistemaName: lookupValue }
      } else if (props.kind === 'zona') {
        searchParams = { zonaExplOgcFid: lookupValue }
      } else if (props.kind === 'comarca') {
        searchParams = { comarcaName: lookupValue }
      } else {
        searchParams = { subBasinName: lookupValue }
      }

      const items = await getStationsByAreaService(searchParams)

      if (requestId !== stationsRequestId) {
        return
      }

      stations.value = items
    } catch {
      if (requestId !== stationsRequestId) {
        return
      }

      stations.value = []
    } finally {
      if (requestId === stationsRequestId) {
        loadingStations.value = false
      }
    }
  }

  async function loadFeature(code: string) {
    if (!layerConfig.value) return
    loading.value = true
    try {
      const fieldName =
        props.kind === 'sistema'
          ? 'sistema'
          : props.kind === 'comarca'
            ? 'ds_comarca'
            : props.kind === 'zona'
              ? 'ogc_fid'
              : 'code'

      feature.value = await getWFSFeatureById(layerConfig.value, fieldName, code)
      await loadStations(getStationsLookupValueFromFeature(feature.value))
    } catch {
      feature.value = null
      stations.value = []
    } finally {
      loading.value = false
    }
  }

  watch(
    selectedRouteValue,
    (code) => {
      feature.value = null
      stations.value = []
      loadingStations.value = false
      selectedStationCode.value = null
      selectedChartData.value = null
      if (code) loadFeature(code)
    },
    { immediate: true }
  )

  async function fetchChartData(stationCode: string, series: SubcuencaSeriesMode): Promise<void> {
    const requestId = ++chartFetchId
    loadingChart.value = true
    selectedChartData.value = null

    const station = stations.value.find((s) => s.stationCode === stationCode)
    const isEmbalse = (station?.tipoCod ?? '').toUpperCase() === 'E'

    let historicalType: PredictionTypeName
    let harmonieType: PredictionTypeName
    let epsType: PredictionTypeName

    if (series === 'caudal') {
      historicalType = 'FICT98.historical'
      harmonieType = isEmbalse ? 'I.NAM.harmonie' : 'Q.NAM.harmonie'
      epsType = isEmbalse ? 'I.NAM.ens.medio' : 'Q.NAM.ens'
    } else {
      historicalType = 'WI__01.historical'
      harmonieType = 'P.harmonie.forecast'
      epsType = 'P.ens.forecast'
    }

    function latestDate(
      resp: Awaited<ReturnType<typeof getAvailablePredictionsService>>
    ): string | undefined {
      return [...(resp.simulationDates ?? []).map((d) => d.simulationDate), ...(resp.dates ?? [])]
        .filter((v): v is string => Boolean(v))
        .sort((a, b) => b.localeCompare(a))[0]
    }

    const HISTORICAL_RANGE_DAYS = 30
    const historicalEndDate = new Date().toISOString()
    const historicalStartDate = new Date(
      Date.now() - HISTORICAL_RANGE_DAYS * 24 * 60 * 60 * 1000
    ).toISOString()

    try {
      const [harmonieDates, epsDates] = await Promise.all([
        getAvailablePredictionsService(stationCode, harmonieType),
        getAvailablePredictionsService(stationCode, epsType),
      ])

      if (requestId !== chartFetchId) return

      const harmonieDateStr = latestDate(harmonieDates)
      const epsDateStr = latestDate(epsDates)

      const [harmoniePred, epsPred, historicalPred, p10Pred, p25Pred, p75Pred, p90Pred] =
        await Promise.all([
          harmonieDateStr
            ? getPredictionsService(stationCode, harmonieType, harmonieDateStr)
            : Promise.resolve(undefined),
          epsDateStr
            ? getPredictionsService(stationCode, epsType, epsDateStr)
            : Promise.resolve(undefined),
          getHistoricalPredictionService(
            stationCode,
            historicalType,
            historicalStartDate,
            historicalEndDate
          ),
          epsDateStr && series === 'caudal'
            ? getPredictionsService(stationCode, epsType, epsDateStr, '10')
            : epsDateStr
              ? getPredictionsService(stationCode, epsType, epsDateStr, '10')
              : Promise.resolve(undefined),
          epsDateStr && series === 'caudal'
            ? getPredictionsService(stationCode, epsType, epsDateStr, '25')
            : epsDateStr
              ? getPredictionsService(stationCode, epsType, epsDateStr, '25')
              : Promise.resolve(undefined),
          epsDateStr && series === 'caudal'
            ? getPredictionsService(stationCode, epsType, epsDateStr, '75')
            : epsDateStr
              ? getPredictionsService(stationCode, epsType, epsDateStr, '75')
              : Promise.resolve(undefined),
          epsDateStr && series === 'caudal'
            ? getPredictionsService(stationCode, epsType, epsDateStr, '90')
            : epsDateStr
              ? getPredictionsService(stationCode, epsType, epsDateStr, '90')
              : Promise.resolve(undefined),
        ])

      if (requestId !== chartFetchId) return

      selectedChartData.value = {
        historical: historicalPred,
        forecastHarmonie: harmoniePred,
        forecastEpsat: epsPred,
        forecastEnsP10: p10Pred,
        forecastEnsP25: p25Pred,
        forecastEnsP75: p75Pred,
        forecastEnsP90: p90Pred,
      }
    } catch {
      if (requestId === chartFetchId) selectedChartData.value = null
    } finally {
      if (requestId === chartFetchId) loadingChart.value = false
    }
  }

  const stopBusListener = selectionBus.on((payload) => {
    selectedSeries.value = payload.series
    selectedStationName.value = payload.station?.nombre ?? ''

    if (!payload.station) {
      selectedChartData.value = null
      loadingChart.value = false
      return
    }

    void fetchChartData(payload.station.codigo, payload.series)
  })

  onBeforeUnmount(() => {
    stopBusListener()
  })

  function closeDrawer() {
    if (!selectedRouteValue.value) return

    const query = { ...route.query }
    delete query[routeKey.value]

    router.replace({ query })
  }
</script>
