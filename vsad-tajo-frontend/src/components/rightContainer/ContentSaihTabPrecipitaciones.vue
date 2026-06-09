<template>
  <v-row class="align-stretch">
    <v-col cols="12" md="3" lg="2" class="order-2 order-md-1 d-flex flex-column">
      <v-card class="ma-2 pa-2 bg-background w-100 flex-shrink-0" elevation="2">
        <ContentSaihAlertStatusPrecipObserved
          :loading="loadingPrecipitaciones"
          :precipitations-historical="precipitationsHistorical"
          :thresholds="thresholds"
        />
      </v-card>

      <v-card class="ma-2 pa-2 bg-background w-100 flex-shrink-0" elevation="2">
        <v-row>
          <v-col cols="6" md="12">
            <ContentObservedData
              active-tab="precipitaciones"
              :loading="loadingPrecipitaciones"
              :precipitations-historical="precipitationsHistorical"
              :thresholds="thresholds"
            />
          </v-col>
        </v-row>
      </v-card>

      <v-card class="ma-2 mt-0 pa-2 bg-background w-100 flex-grow-1" elevation="2">
        <ContentSaihOperationalSummaryPrecipObserved
          :loading="loadingPrecipitaciones"
          :precipitations-historical="precipitationsHistorical"
          :thresholds="thresholds"
          title="Resumen Operativo Observado"
        />
      </v-card>
    </v-col>

    <v-col cols="12" md="6" lg="8" class="pt-2 pt-md-4 order-1 order-md-2 d-flex flex-column">
      <div class="w-100 h-100 d-flex flex-column">
        <v-card class="bg-background w-100 d-flex flex-column flex-grow-1" elevation="2">
          <v-card-text class="pa-2 d-flex flex-column flex-grow-1">
            <v-tabs v-model="selectedPrecipChartTab" class="bg-surface px-2">
              <v-tab value="precipitaciones">Precipitaciones</v-tab>
              <v-tab value="acumuladas">Acumuladas</v-tab>
            </v-tabs>

            <v-window v-model="selectedPrecipChartTab" class="flex-grow-1">
              <v-window-item value="precipitaciones" class="h-100">
                <v-sheet class="pa-2 h-100 d-flex flex-column">
                  <PrecipitationsChart
                    :data="precipitationsChartData"
                    :height="700"
                    :loading="loadingPrecipitaciones"
                    mode="precipitations"
                  />
                </v-sheet>
              </v-window-item>

              <v-window-item value="acumuladas" class="h-100">
                <v-sheet class="pa-2 h-100 d-flex flex-column">
                  <PrecipitationsChart
                    :data="precipitationsChartData"
                    :height="700"
                    :loading="loadingPrecipitaciones"
                    mode="accumulated"
                  />
                </v-sheet>
              </v-window-item>
            </v-window>
          </v-card-text>
        </v-card>
      </div>
    </v-col>

    <v-col cols="12" md="3" lg="2" class="order-3 order-md-3 d-flex flex-column pe-3 pl-0">
      <v-card class="ml-1 mr-1 mt-2 mb-2 pa-2 bg-background w-100 flex-shrink-0" elevation="2">
        <ContentSaihAlertStatusPrecipPredictions
          :loading="loadingPrecipitaciones"
          :precipitations-forecast-harmonie="precipitationsForecastHarmonie"
          :precipitations-forecast-epstat="precipitationsForecastEpstat"
          :precipitations-forecast-ens-p10="precipitationsForecastEnsP10"
          :precipitations-forecast-ens-p25="precipitationsForecastEnsP25"
          :precipitations-forecast-ens-p75="precipitationsForecastEnsP75"
          :precipitations-forecast-ens-p90="precipitationsForecastEnsP90"
          :thresholds="thresholds"
        />
      </v-card>

      <v-card class="ml-1 mr-1 my-2 pa-2 bg-background w-100 flex-shrink-0" elevation="2">
        <ContentSaihPredictionsLatest
          class="ma-2"
          active-tab="precipitaciones"
          :loading="loadingPrecipitaciones"
          :loading-harmonie="loadingHarmoniePredict"
          :loading-eps="loadingEpsPredict"
          :precipitations-forecast-harmonie="precipitationsForecastHarmonie"
          :precipitations-forecast-epstat="precipitationsForecastEpstat"
          :selected-harmonie-precip-date="selectedHarmoniePrecipDate"
          :selected-eps-precip-date="selectedEpsPrecipDate"
          :harmonie-precip-dates="harmoniePrecipDates"
          :eps-precip-dates="epsPrecipDates"
          :thresholds="thresholds"
          @update:selected-harmonie-precip-date="selectedHarmoniePrecipDate = $event"
          @update:selected-eps-precip-date="selectedEpsPrecipDate = $event"
        />
      </v-card>

      <v-card class="ml-1 mr-1 mt-2 pa-2 bg-background w-100 flex-grow-1" elevation="2">
        <ContentSaihOperationalSummaryPrecipPredictions
          :loading="loadingPrecipitaciones"
          :precipitations-forecast-harmonie="precipitationsForecastHarmonie"
          :precipitations-forecast-epstat="precipitationsForecastEpstat"
          :precipitations-forecast-ens-p10="precipitationsForecastEnsP10"
          :precipitations-forecast-ens-p25="precipitationsForecastEnsP25"
          :precipitations-forecast-ens-p75="precipitationsForecastEnsP75"
          :precipitations-forecast-ens-p90="precipitationsForecastEnsP90"
          :thresholds="thresholds"
          title="Resumen Operativo Predicciones"
        />
      </v-card>
    </v-col>
  </v-row>

  <v-row class="align-stretch">
    <v-col cols="12" md="3" lg="3" class="order-4 order-md-4 d-flex flex-column">
      <v-card
        class="ma-2 mt-2 pa-2 bg-background w-100 flex-grow-1 d-flex flex-column"
        elevation="2"
      >
        <ContentSaihPrecipStationTable
          :loading="loadingPrecipitaciones"
          :precipitations-historical="precipitationsHistorical"
          :precipitations-forecast-harmonie="precipitationsForecastHarmonie"
          :precipitations-forecast-epstat="precipitationsForecastEpstat"
          :precipitations-forecast-ens-p10="precipitationsForecastEnsP10"
          :precipitations-forecast-ens-p25="precipitationsForecastEnsP25"
          :precipitations-forecast-ens-p75="precipitationsForecastEnsP75"
          :precipitations-forecast-ens-p90="precipitationsForecastEnsP90"
          :thresholds="thresholds"
        />
      </v-card>
    </v-col>

    <v-col cols="12" md="6" lg="9" class="order-5 order-md-5 d-flex flex-column">
      <v-card
        class="pa-2 bg-background w-100 mt-2 md:mt-0 flex-grow-1 d-flex flex-column"
        elevation="2"
      >
        <ContentSaihPrecipAccumulatedBars
          :loading="loadingPrecipitaciones"
          :precipitations-historical="precipitationsHistorical"
          :precipitations-forecast-harmonie="precipitationsForecastHarmonie"
          :precipitations-forecast-epstat="precipitationsForecastEpstat"
          :precipitations-forecast-ens-p10="precipitationsForecastEnsP10"
          :precipitations-forecast-ens-p25="precipitationsForecastEnsP25"
          :precipitations-forecast-ens-p75="precipitationsForecastEnsP75"
          :precipitations-forecast-ens-p90="precipitationsForecastEnsP90"
        />
      </v-card>
    </v-col>
  </v-row>
</template>

<script lang="ts" setup>
  import { computed, ref, watch, type Ref } from 'vue'
  import type {
    DataStationPrediction,
    DatesAvailableResponse,
    PredictionTypeName,
    StationPrediction,
  } from '@/types/Predictions'
  import {
    getAvailablePredictionsService,
    getHistoricalPredictionService,
  } from '@/services/predictions'

  const HISTORICAL_RANGE_DAYS = 30

  import PrecipitationsChart from '../charts/PrecipitationsChart.vue'
  import ContentSaihAlertStatusPrecipObserved from './ContentSaih/ContentSaihAlertStatusPrecipObserved.vue'
  import ContentSaihAlertStatusPrecipPredictions from './ContentSaih/ContentSaihAlertStatusPrecipPredictions.vue'
  import ContentObservedData from './ContentSaih/ContentObservedData.vue'
  import ContentSaihOperationalSummaryPrecipObserved from './ContentSaih/ContentSaihOperationalSummaryPrecipObserved.vue'
  import ContentSaihOperationalSummaryPrecipPredictions from './ContentSaih/ContentSaihOperationalSummaryPrecipPredictions.vue'
  import ContentSaihPredictionsLatest from './ContentSaih/ContentSaihPredictionsLatest.vue'
  import ContentSaihPrecipStationTable from './ContentSaih/ContentSaihPrecipStationTable.vue'
  import ContentSaihPrecipAccumulatedBars from './ContentSaih/ContentSaihPrecipAccumulatedBars.vue'

  import {
    applyForecastData,
    clearForecasts,
    fetchPredictionBatch,
    pickDefaultDate,
    toDateList,
    type ForecastRequestDef,
  } from './utils/predictionTabUtils'

  type ForecastKey = keyof DataStationPrediction
  type ForecastRefsMap = Record<ForecastKey, Ref<StationPrediction | undefined>>

  const props = defineProps<{
    thresholds?: Record<string, unknown>
    normalizedStationCode: string
  }>()

  const loadingPrecipitaciones = ref(false)
  const loadingHarmoniePredict = ref(false)
  const loadingEpsPredict = ref(false)

  const precipitationsHistorical = ref<StationPrediction>()
  const precipitationsForecastEpstat = ref<StationPrediction>()
  const precipitationsForecastHarmonie = ref<StationPrediction>()
  const precipitationsForecastEnsP10 = ref<StationPrediction>()
  const precipitationsForecastEnsP25 = ref<StationPrediction>()
  const precipitationsForecastEnsP75 = ref<StationPrediction>()
  const precipitationsForecastEnsP90 = ref<StationPrediction>()

  const observedPrecipDates = ref<string[]>([])
  const harmoniePrecipDates = ref<string[]>([])
  const epsPrecipDates = ref<string[]>([])

  const selectedObservedPrecipDate = ref('')
  const selectedHarmoniePrecipDate = ref('')
  const selectedEpsPrecipDate = ref('')
  const selectedPrecipChartTab = ref<'precipitaciones' | 'acumuladas'>('precipitaciones')

  const precipitationRefs: ForecastRefsMap = {
    historical: precipitationsHistorical,
    forecastHarmonie: precipitationsForecastHarmonie,
    forecastEpsat: precipitationsForecastEpstat,
    forecastEnsP10: precipitationsForecastEnsP10,
    forecastEnsP25: precipitationsForecastEnsP25,
    forecastEnsP75: precipitationsForecastEnsP75,
    forecastEnsP90: precipitationsForecastEnsP90,
  }

  const precipitationsChartData = computed(() => ({
    historical: precipitationsHistorical.value,
    forecastHarmonie: precipitationsForecastHarmonie.value,
    forecastEpsat: precipitationsForecastEpstat.value,
    forecastEnsP10: precipitationsForecastEnsP10.value,
    forecastEnsP25: precipitationsForecastEnsP25.value,
    forecastEnsP90: precipitationsForecastEnsP90.value,
    forecastEnsP75: precipitationsForecastEnsP75.value,
  }))

  const precipitationRequests = computed<ForecastRequestDef<ForecastKey>[]>(() => [
    {
      key: 'forecastHarmonie',
      predictionType: 'P.harmonie.forecast',
      simulationDate: selectedHarmoniePrecipDate.value,
    },
    {
      key: 'forecastEpsat',
      predictionType: 'P.ens.forecast',
      simulationDate: selectedEpsPrecipDate.value,
    },
    {
      key: 'forecastEnsP10',
      predictionType: 'P.ens.forecast',
      simulationDate: selectedEpsPrecipDate.value,
      percentile: '10',
    },
    {
      key: 'forecastEnsP25',
      predictionType: 'P.ens.forecast',
      simulationDate: selectedEpsPrecipDate.value,
      percentile: '25',
    },
    {
      key: 'forecastEnsP75',
      predictionType: 'P.ens.forecast',
      simulationDate: selectedEpsPrecipDate.value,
      percentile: '75',
    },
    {
      key: 'forecastEnsP90',
      predictionType: 'P.ens.forecast',
      simulationDate: selectedEpsPrecipDate.value,
      percentile: '90',
    },
  ])

  async function getAvailableDates(code: string): Promise<void> {
    try {
      const [observedPrecipResponse, harmoniePrecipResponse, epsPrecipResponse] = await Promise.all(
        [
          getAvailablePredictionsService(code, 'WI__01.historical' as PredictionTypeName),
          getAvailablePredictionsService(code, 'P.harmonie.forecast' as PredictionTypeName),
          getAvailablePredictionsService(code, 'P.ens.forecast' as PredictionTypeName),
        ]
      )

      observedPrecipDates.value = toDateList(observedPrecipResponse as DatesAvailableResponse)
      harmoniePrecipDates.value = toDateList(harmoniePrecipResponse as DatesAvailableResponse)
      epsPrecipDates.value = toDateList(epsPrecipResponse as DatesAvailableResponse)
    } catch (err) {
      console.error('Error loading available precipitation dates:', err)
      observedPrecipDates.value = []
      harmoniePrecipDates.value = []
      epsPrecipDates.value = []
    }
  }

  let fetchRequestId = 0
  let isFullReloading = false
  let skipNextDateWatch = false

  async function refreshPrecipitationPredictions(requestId: number): Promise<void> {
    const code = props.normalizedStationCode
    if (!code) return

    const historicalEnd = new Date().toISOString()
    const historicalStart = new Date(
      Date.now() - HISTORICAL_RANGE_DAYS * 24 * 60 * 60 * 1000
    ).toISOString()

    try {
      const [precipitationData, historical] = await Promise.all([
        fetchPredictionBatch(code, precipitationRequests.value),
        getHistoricalPredictionService(
          code,
          'WI__01.historical',
          historicalStart,
          historicalEnd
        ),
      ])
      if (requestId !== fetchRequestId) return
      applyForecastData(precipitationRefs, precipitationData)
      precipitationsHistorical.value = historical
    } catch (err) {
      console.error('Error loading precipitation predictions:', err)
      if (requestId !== fetchRequestId) return
      clearForecasts(precipitationRefs)
    }
  }

  watch(
    () => props.normalizedStationCode,
    async (code) => {
      isFullReloading = true
      clearForecasts(precipitationRefs)
      observedPrecipDates.value = []
      harmoniePrecipDates.value = []
      epsPrecipDates.value = []
      selectedObservedPrecipDate.value = ''
      selectedHarmoniePrecipDate.value = ''
      selectedEpsPrecipDate.value = ''

      if (!code) {
        loadingPrecipitaciones.value = false
        isFullReloading = false
        return
      }

      const requestId = ++fetchRequestId
      loadingPrecipitaciones.value = true
      try {
        await getAvailableDates(code)
        if (requestId !== fetchRequestId) return

        skipNextDateWatch = true
        selectedObservedPrecipDate.value = pickDefaultDate('', observedPrecipDates.value)
        selectedHarmoniePrecipDate.value = pickDefaultDate('', harmoniePrecipDates.value)
        selectedEpsPrecipDate.value = pickDefaultDate('', epsPrecipDates.value)

        await refreshPrecipitationPredictions(requestId)
      } finally {
        isFullReloading = false
        if (requestId === fetchRequestId) loadingPrecipitaciones.value = false
      }
    },
    { immediate: true }
  )

  watch(
    [selectedHarmoniePrecipDate, selectedEpsPrecipDate],
    async (currentValues, previousValues) => {
      if (skipNextDateWatch) {
        skipNextDateWatch = false
        return
      }
      if (isFullReloading) return

      const harmonieChanged = currentValues[0] !== previousValues?.[0]
      const epsChanged = currentValues[1] !== previousValues?.[1]
      if (!harmonieChanged && !epsChanged) return

      loadingHarmoniePredict.value = harmonieChanged
      loadingEpsPredict.value = epsChanged

      const requestId = ++fetchRequestId
      try {
        await refreshPrecipitationPredictions(requestId)
      } finally {
        loadingHarmoniePredict.value = false
        loadingEpsPredict.value = false
      }
    }
  )
</script>
