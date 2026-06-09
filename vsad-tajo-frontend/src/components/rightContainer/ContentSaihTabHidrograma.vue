<template>
  <v-row justify="center" class="px-3 align-stretch">
    <v-col
      cols="12"
      md="3"
      lg="2"
      class="order-2 order-md-1 d-flex flex-column"
      style="min-height: 0"
    >
      <v-card
        ref="leftStatusCardEl"
        class="ma-2 pa-2 bg-background w-100 flex-shrink-0"
        elevation="2"
      >
        <ContentSaihAlertStatus
          :loading="loadingCaudales"
          :caudal-historical="caudalHistorical"
          :thresholds="thresholds"
        />
      </v-card>

      <v-card
        ref="leftObservedCardEl"
        class="ma-2 pa-2 bg-background w-100 flex-shrink-0"
        elevation="2"
      >
        <v-row>
          <v-col cols="6" md="12">
            <ContentObservedData
              :loading="loadingCaudales"
              :is-embalse="isEmbalse"
              :caudal-historical="caudalHistorical"
              :caudal-outflow-historical="caudalOutflowHistorical"
              :embalse-volume-historical="embalseVolumeHistorical"
              :thresholds="thresholds"
            />
          </v-col>
        </v-row>
      </v-card>

      <v-card
        ref="leftSummaryCardEl"
        class="ma-2 mt-0 pa-2 bg-background w-100 d-flex flex-column summary-container-card"
        elevation="2"
        :style="leftSummaryCardStyle"
      >
        <ContentSaihOperationalSummary
          :loading="loadingCaudales"
          mode="observed"
          :caudal-historical="caudalHistorical"
          :thresholds="thresholds"
          title="Resumen Operativo Observado"
        />
      </v-card>
    </v-col>

    <v-col cols="12" md="6" lg="8" class="pt-2 pt-md-4 order-1 order-md-2 d-flex flex-column">
      <div ref="centerStackEl" class="w-100 d-flex flex-column">
        <v-card class="bg-background w-100 d-flex flex-column">
          <v-card-text>
            <v-sheet class="pa-5">
              <template v-if="isEmbalse">
                <v-tabs v-model="selectedEmbalseChartTab" density="compact" class="mb-3">
                  <v-tab value="caudal">Caudal</v-tab>
                  <v-tab value="volumen">Volumen</v-tab>
                </v-tabs>

                <v-window v-model="selectedEmbalseChartTab">
                  <v-window-item value="caudal">
                    <ForecastChartNew
                      :data="caudalOnlyChartData"
                      :is-embalse="true"
                      :height="550"
                      :loading="loadingCaudales"
                      :thresholds="thresholds"
                      :focus-threshold-request="thresholdFocusRequest"
                      @focus-threshold-complete="handleThresholdFocusComplete"
                    />
                  </v-window-item>

                  <v-window-item value="volumen">
                    <ForecastChartNew
                      :data="volumenOnlyChartData"
                      :is-embalse="true"
                      :height="550"
                      :loading="loadingCaudales"
                      :thresholds="thresholds"
                      :focus-threshold-request="thresholdFocusRequest"
                      @focus-threshold-complete="handleThresholdFocusComplete"
                    />
                  </v-window-item>
                </v-window>
              </template>

              <template v-else>
                <ForecastChartNew
                  :data="caudalChartData"
                  :is-embalse="isEmbalse"
                  :loading="loadingCaudales"
                  :thresholds="thresholds"
                  :focus-threshold-request="thresholdFocusRequest"
                  @focus-threshold-complete="handleThresholdFocusComplete"
                />
              </template>
            </v-sheet>
          </v-card-text>
        </v-card>

        <v-card class="mt-2 pa-2 bg-background" elevation="2">
          <ContentUmbralesData
            active-tab="caudal"
            :is-embalse="isEmbalse"
            :thresholds="thresholds"
            :selected-threshold="selectedThreshold"
            @focus-threshold="handleThresholdFocus"
          />
        </v-card>

        <v-card class="pa-2 bg-background mt-2" elevation="2">
          <ContentSaihCaudalMatrix
            :forecast-harmonie="caudalForecastHarmonie"
            :forecast-epsat="caudalForecastEpstat"
            :thresholds="thresholds"
            :loading="loadingCaudales"
          />
        </v-card>
      </div>
    </v-col>

    <v-col
      cols="12"
      md="3"
      lg="2"
      class="order-3 order-md-3 d-flex flex-column pl-0"
      style="min-height: 0"
    >
      <v-card
        ref="rightStatusCardEl"
        class="ma-2 pa-2 bg-background w-100 flex-shrink-0"
        elevation="2"
      >
        <ContentSaihAlertStatus
          :loading="loadingCaudales"
          :caudal-forecast-harmonie="caudalForecastHarmonie"
          :caudal-forecast-epsat="caudalForecastEpstat"
          :mode="'predictions'"
          :thresholds="thresholds"
        />
      </v-card>
      <v-card
        ref="rightLatestCardEl"
        class="ma-2 pa-2 bg-background w-100 flex-shrink-0"
        elevation="2"
      >
        <ContentSaihPredictionsLatest
          class="ma-2"
          active-tab="caudal"
          :loading="loadingCaudales"
          :loading-harmonie="loadingHarmoniePredict"
          :loading-eps="loadingEpsPredict"
          :caudal-forecast-harmonie="caudalForecastHarmonie"
          :caudal-forecast-epstat="caudalForecastEpstat"
          :selected-harmonie-caudal-date="selectedHarmonieCaudalDate"
          :selected-eps-caudal-date="selectedEpsCaudalDate"
          :harmonie-caudal-dates="harmonieCaudalDates"
          :eps-caudal-dates="epsCaudalDates"
          :thresholds="thresholds"
          @update:selected-harmonie-caudal-date="
            emit('update:selected-harmonie-caudal-date', $event)
          "
          @update:selected-eps-caudal-date="emit('update:selected-eps-caudal-date', $event)"
        />
      </v-card>

      <v-card
        ref="rightSummaryCardEl"
        class="ma-2 mt-0 pa-2 bg-background w-100 d-flex flex-column summary-container-card"
        elevation="2"
        :style="rightSummaryCardStyle"
      >
        <ContentSaihOperationalSummary
          :loading="loadingCaudales"
          mode="predictions"
          :caudal-forecast-harmonie="caudalForecastHarmonie"
          :caudal-forecast-epstat="caudalForecastEpstat"
          :caudal-forecast-ens-p10="caudalForecastEnsP10"
          :caudal-forecast-ens-p25="caudalForecastEnsP25"
          :caudal-forecast-ens-p75="caudalForecastEnsP75"
          :caudal-forecast-ens-p90="caudalForecastEnsP90"
          :thresholds="thresholds"
          title="Resumen Operativo Predicciones"
        />
      </v-card>
    </v-col>
  </v-row>

  <v-row class="align-stretch">
    <v-col v-if="isEmbalse" cols="12" md="3" lg="3" class="order-4 order-md-4 d-flex flex-column">
      <v-card
        class="ma-2 mt-2 pa-2 bg-background w-100 flex-grow-1 d-flex flex-column"
        elevation="2"
      >
        <ContentSaihResguardosData
          class="flex-grow-1"
          :resguardo-prediction="effectiveResguardoPrediction"
          :volumen-minimo-prediction="effectiveMinimoPrediction"
          @update:resguardo-prediction="editedResguardoPrediction = $event"
          @update:volumen-minimo-prediction="editedMinimoPrediction = $event"
        />
      </v-card>
    </v-col>

    <v-col v-if="isEmbalse" cols="12" md="6" lg="9" class="order-5 order-md-5 d-flex flex-column">
      <v-card
        class="pa-2 bg-background w-100 mt-2 md:mt-0 flex-grow-1 d-flex flex-column"
        elevation="2"
      >
        <ContentSaihResguardosChart
          class="flex-grow-1"
          :resguardos-data="resguardosApiData"
          :loading="loadingResguardos"
        />
      </v-card>
    </v-col>
  </v-row>
</template>

<script lang="ts" setup>
  import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'

  import type {
    DataStationPrediction,
    PredictionTypeName,
    StationPrediction,
  } from '@/types/Predictions'
  import type { ResguardosStationResponse } from '@/types/Resguardos'
  import {
    getAvailablePredictionsService,
    getHistoricalPredictionService,
  } from '@/services/predictions'

  const HISTORICAL_RANGE_DAYS = 30
  import { getResguardosByStationService } from '@/services/resguardos'
  import {
    applyForecastData,
    clearForecasts,
    fetchPredictionBatch,
    pickDefaultDate,
    toDateList,
    type ForecastRequestDef,
  } from './utils/predictionTabUtils'

  import ContentSaihAlertStatus from './ContentSaih/ContentSaihAlertStatus.vue'
  import ForecastChartNew from '../charts/ForecastChartNew.vue'
  import ContentObservedData from './ContentSaih/ContentObservedData.vue'
  import ContentSaihOperationalSummary from './ContentSaih/ContentSaihOperationalSummary.vue'
  import ContentUmbralesData from './ContentSaih/ContentUmbralesData.vue'
  import ContentSaihCaudalMatrix from './ContentSaih/ContentSaihCaudalMatrix.vue'
  import ContentSaihPredictionsLatest from './ContentSaih/ContentSaihPredictionsLatest.vue'
  import ContentSaihResguardosData from './ContentSaih/ContentSaihResguardosData.vue'
  import ContentSaihResguardosChart from './ContentSaih/ContentSaihResguardosChart.vue'

  type ForecastKey = keyof DataStationPrediction
  type ForecastRefsMap = Record<ForecastKey, Ref<StationPrediction | undefined>>

  type ThresholdType = 'caudal' | 'volumen'
  type ThresholdLevel = 1 | 2 | 3
  type ThresholdSelection = { kind: ThresholdType; level: ThresholdLevel } | null
  type ThresholdFocusRequest = {
    action: 'focus' | 'reset'
    kind?: ThresholdType
    level?: ThresholdLevel
    nonce: number
  }

  const props = defineProps<{
    isEmbalse?: boolean
    thresholds?: Record<string, unknown>
    normalizedStationCode: string
  }>()

  const emit = defineEmits<{
    (e: 'update:selected-harmonie-caudal-date', value: string): void
    (e: 'update:selected-eps-caudal-date', value: string): void
  }>()

  const selectedThreshold = ref<ThresholdSelection>(null)
  const thresholdFocusRequest = ref<ThresholdFocusRequest | null>(null)
  const thresholdFocusNonce = ref(0)
  const selectedEmbalseChartTab = ref<'caudal' | 'volumen'>('caudal')

  const centerStackEl = ref<HTMLElement | null>(null)
  const leftStatusCardEl = ref<unknown>(null)
  const leftObservedCardEl = ref<unknown>(null)
  const leftSummaryCardEl = ref<unknown>(null)
  const rightStatusCardEl = ref<unknown>(null)
  const rightLatestCardEl = ref<unknown>(null)
  const rightSummaryCardEl = ref<unknown>(null)

  const leftSummaryHeightPx = ref(280)
  const rightSummaryHeightPx = ref(280)

  const leftSummaryCardStyle = computed(() => ({
    minHeight: '0',
    height: `${leftSummaryHeightPx.value}px`,
    maxHeight: `${leftSummaryHeightPx.value}px`,
  }))

  const rightSummaryCardStyle = computed(() => ({
    minHeight: '0',
    height: `${rightSummaryHeightPx.value}px`,
    maxHeight: `${rightSummaryHeightPx.value}px`,
  }))

  function resolveElement(target: unknown): HTMLElement | null {
    if (target instanceof HTMLElement) return target
    if (
      typeof target === 'object' &&
      target !== null &&
      '$el' in target &&
      (target as { $el?: unknown }).$el instanceof HTMLElement
    ) {
      return (target as { $el: HTMLElement }).$el
    }
    return null
  }

  function outerHeightWithMargins(target: unknown): number {
    const el = resolveElement(target)
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    const styles = window.getComputedStyle(el)
    const mt = Number.parseFloat(styles.marginTop || '0') || 0
    const mb = Number.parseFloat(styles.marginBottom || '0') || 0
    return rect.height + mt + mb
  }

  function updateSummaryHeights(): void {
    const target = resolveElement(centerStackEl.value)?.getBoundingClientRect().height ?? 0
    if (target <= 0) return

    const leftBase =
      outerHeightWithMargins(leftStatusCardEl.value) +
      outerHeightWithMargins(leftObservedCardEl.value)
    const rightBase =
      outerHeightWithMargins(rightStatusCardEl.value) +
      outerHeightWithMargins(rightLatestCardEl.value)

    leftSummaryHeightPx.value = Math.max(0, target - leftBase)
    rightSummaryHeightPx.value = Math.max(0, target - rightBase)
  }

  let layoutObserver: ResizeObserver | null = null

  onMounted(() => {
    nextTick(() => {
      updateSummaryHeights()

      if (typeof ResizeObserver !== 'undefined') {
        layoutObserver = new ResizeObserver(() => updateSummaryHeights())
        const observed = [
          centerStackEl.value,
          leftStatusCardEl.value,
          leftObservedCardEl.value,
          rightStatusCardEl.value,
          rightLatestCardEl.value,
          leftSummaryCardEl.value,
          rightSummaryCardEl.value,
        ]

        for (const target of observed) {
          const el = resolveElement(target)
          if (el) layoutObserver.observe(el)
        }
      }
    })
  })

  onBeforeUnmount(() => {
    layoutObserver?.disconnect()
    layoutObserver = null
  })

  function handleThresholdFocus(payload: ThresholdSelection): void {
    selectedThreshold.value = payload

    thresholdFocusNonce.value += 1

    if (!payload) {
      thresholdFocusRequest.value = {
        action: 'reset',
        nonce: thresholdFocusNonce.value,
      }
      return
    }

    thresholdFocusRequest.value = {
      action: 'focus',
      kind: payload.kind,
      level: payload.level,
      nonce: thresholdFocusNonce.value,
    }
  }

  function handleThresholdFocusComplete(): void {
    // Intentionally left blank: the selection stays active until the user toggles it off.
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  const loadingCaudales = ref(false)
  const loadingHarmoniePredict = ref(false)
  const loadingEpsPredict = ref(false)
  const loadingResguardos = ref(false)

  const resguardosApiData = ref<ResguardosStationResponse>()

  // ── Caudal data ───────────────────────────────────────────────────────────
  const caudalHistorical = ref<StationPrediction>()
  const caudalForecastEpstat = ref<StationPrediction>()
  const caudalForecastHarmonie = ref<StationPrediction>()
  const caudalForecastEnsP10 = ref<StationPrediction>()
  const caudalForecastEnsP25 = ref<StationPrediction>()
  const caudalForecastEnsP75 = ref<StationPrediction>()
  const caudalForecastEnsP90 = ref<StationPrediction>()
  const caudalOutflowHistorical = ref<StationPrediction>()
  const embalseVolumeHistorical = ref<StationPrediction>()

  // ── Available dates ───────────────────────────────────────────────────────
  const observedCaudalDates = ref<string[]>([])
  const harmonieCaudalDates = ref<string[]>([])
  const harmoniePrecipDates = ref<string[]>([])
  const epsCaudalDates = ref<string[]>([])
  const epsPrecipDates = ref<string[]>([])

  // ── Selected dates ────────────────────────────────────────────────────────
  const selectedObservedCaudalDate = ref('')
  const selectedHarmonieCaudalDate = ref('')
  const selectedEpsCaudalDate = ref('')

  // ── Code type (E = embalse/aforo-especial, default = aforo) ──────────────
  const codeType = computed(() => {
    const val = props.thresholds?.tipoCod
    return typeof val === 'string' ? val : undefined
  })

  function toStationPredictionFromResguardos(
    kind: 'reserveVolume' | 'minimumVolume',
    predictionTypeName: string
  ): StationPrediction | undefined {
    const payload = resguardosApiData.value
    if (!payload) return undefined

    const entries = Object.entries(payload.entries)
      .map(([date, entry]) => {
        const parsedTime = Date.parse(`${date}T00:00:00`)
        if (!Number.isFinite(parsedTime)) return null
        return {
          date,
          time: parsedTime,
          value: kind === 'reserveVolume' ? entry.reserveVolume : entry.minimumVolume,
        }
      })
      .filter(
        (
          item
        ): item is {
          date: string
          time: number
          value: number | null
        } => item !== null
      )
      .sort((a, b) => a.time - b.time)

    const results = entries.flatMap((entry, index) => {
      const numericValue = Number(entry.value)
      if (!Number.isFinite(numericValue)) return []

      const startIso = new Date(`${entry.date}T00:00:00`).toISOString()
      const endIso = new Date(`${entry.date}T23:59:59`).toISOString()

      return [
        { id: index * 2 + 1, date: startIso, value: numericValue, flag: 0 },
        { id: index * 2 + 2, date: endIso, value: numericValue, flag: 0 },
      ]
    })

    if (!results.length) return undefined

    return {
      id: `${predictionTypeName}-${payload.stationCode}`,
      stationId: payload.stationCode,
      stationName: payload.stationName,
      predictionTypeName,
      simulationDate: results[0].date,
      predictionDate: new Date().toISOString(),
      predictionProvider: 'resguardos-api',
      predictedBy: 'api',
      results,
    }
  }

  const resguardoFromApi = computed<StationPrediction | undefined>(() =>
    toStationPredictionFromResguardos('reserveVolume', 'resguardo.hydrologicalYear')
  )

  const minimoFromApi = computed<StationPrediction | undefined>(() =>
    toStationPredictionFromResguardos('minimumVolume', 'volumen.minimo.hydrologicalYear')
  )

  const editedResguardoPrediction = ref<StationPrediction>()
  const editedMinimoPrediction = ref<StationPrediction>()
  const effectiveResguardoPrediction = computed(
    () => editedResguardoPrediction.value ?? resguardoFromApi.value
  )
  const effectiveMinimoPrediction = computed(
    () => editedMinimoPrediction.value ?? minimoFromApi.value
  )

  // ── Refs map & chart data ─────────────────────────────────────────────────
  const caudalRefs: ForecastRefsMap = {
    historical: caudalHistorical,
    forecastHarmonie: caudalForecastHarmonie,
    forecastEpsat: caudalForecastEpstat,
    forecastEnsP10: caudalForecastEnsP10,
    forecastEnsP25: caudalForecastEnsP25,
    forecastEnsP75: caudalForecastEnsP75,
    forecastEnsP90: caudalForecastEnsP90,
  }

  const caudalChartData = computed(() => ({
    historical: caudalHistorical.value,
    historicalOutflow: caudalOutflowHistorical.value,
    historicalVolume: embalseVolumeHistorical.value,
    resguardoVolume: effectiveResguardoPrediction.value,
    minimumVolume: effectiveMinimoPrediction.value,
    forecastHarmonie: caudalForecastHarmonie.value,
    forecastEpsat: caudalForecastEpstat.value,
    forecastEnsP10: caudalForecastEnsP10.value,
    forecastEnsP25: caudalForecastEnsP25.value,
    forecastEnsP90: caudalForecastEnsP90.value,
    forecastEnsP75: caudalForecastEnsP75.value,
  }))

  const caudalOnlyChartData = computed(() => ({
    historical: caudalHistorical.value,
    historicalOutflow: caudalOutflowHistorical.value,
    historicalVolume: undefined,
    resguardoVolume: undefined,
    minimumVolume: undefined,
    forecastHarmonie: caudalForecastHarmonie.value,
    forecastEpsat: caudalForecastEpstat.value,
    forecastEnsP10: caudalForecastEnsP10.value,
    forecastEnsP25: caudalForecastEnsP25.value,
    forecastEnsP90: caudalForecastEnsP90.value,
    forecastEnsP75: caudalForecastEnsP75.value,
  }))

  const volumenOnlyChartData = computed(() => ({
    historical: undefined,
    historicalOutflow: undefined,
    historicalVolume: embalseVolumeHistorical.value,
    resguardoVolume: effectiveResguardoPrediction.value,
    minimumVolume: effectiveMinimoPrediction.value,
    forecastHarmonie: undefined,
    forecastEpsat: undefined,
    forecastEnsP10: undefined,
    forecastEnsP25: undefined,
    forecastEnsP90: undefined,
    forecastEnsP75: undefined,
  }))

  void caudalChartData.value

  // ── Request definitions por tipo de estación ──────────────────────────────
  const caudalRequestsByType = computed<Record<'default' | 'E', ForecastRequestDef[]>>(() => ({
    default: [
      {
        key: 'forecastHarmonie',
        predictionType: 'Q.NAM.harmonie',
        simulationDate: selectedHarmonieCaudalDate.value,
      },
      {
        key: 'forecastEpsat',
        predictionType: 'Q.NAM.ens',
        simulationDate: selectedEpsCaudalDate.value,
      },
      {
        key: 'forecastEnsP10',
        predictionType: 'Q.NAM.ens',
        simulationDate: selectedEpsCaudalDate.value,
        percentile: '10',
      },
      {
        key: 'forecastEnsP25',
        predictionType: 'Q.NAM.ens',
        simulationDate: selectedEpsCaudalDate.value,
        percentile: '25',
      },
      {
        key: 'forecastEnsP75',
        predictionType: 'Q.NAM.ens',
        simulationDate: selectedEpsCaudalDate.value,
        percentile: '75',
      },
      {
        key: 'forecastEnsP90',
        predictionType: 'Q.NAM.ens',
        simulationDate: selectedEpsCaudalDate.value,
        percentile: '90',
      },
    ],
    E: [
      {
        key: 'forecastHarmonie',
        predictionType: 'I.NAM.harmonie',
        simulationDate: selectedHarmonieCaudalDate.value,
      },
      {
        key: 'forecastEpsat',
        predictionType: 'I.NAM.ens.medio',
        simulationDate: selectedEpsCaudalDate.value,
      },
      {
        key: 'forecastEnsP10',
        predictionType: 'I.NAM.ens',
        simulationDate: selectedEpsCaudalDate.value,
        percentile: '10',
      },
      {
        key: 'forecastEnsP25',
        predictionType: 'I.NAM.ens',
        simulationDate: selectedEpsCaudalDate.value,
        percentile: '25',
      },
      {
        key: 'forecastEnsP75',
        predictionType: 'I.NAM.ens',
        simulationDate: selectedEpsCaudalDate.value,
        percentile: '75',
      },
      {
        key: 'forecastEnsP90',
        predictionType: 'I.NAM.ens',
        simulationDate: selectedEpsCaudalDate.value,
        percentile: '90',
      },
    ],
  }))

  // ── Fetch available dates ─────────────────────────────────────────────────
  async function getAvailableDates(code: string) {
    const selectedCodeType = codeType.value === 'E' ? 'E' : 'default'
    const observedCaudalType: PredictionTypeName =
      selectedCodeType === 'E' ? 'FICT99.historical' : 'FICT98.historical'
    const harmonieCaudalType: PredictionTypeName =
      selectedCodeType === 'E' ? 'I.NAM.harmonie' : 'Q.NAM.harmonie'
    const epsCaudalTypes: PredictionTypeName[] =
      selectedCodeType === 'E' ? ['I.NAM.ens.medio', 'I.NAM.ens'] : ['Q.NAM.ens']

    try {
      const [
        observedCaudalResponse,
        harmonieCaudalResponse,
        harmoniePrecipResponse,
        ...epsResponses
      ] = await Promise.all([
        getAvailablePredictionsService(code, observedCaudalType),
        getAvailablePredictionsService(code, harmonieCaudalType),
        getAvailablePredictionsService(code, 'P.harmonie.forecast'),
        ...epsCaudalTypes.map((type) => getAvailablePredictionsService(code, type)),
      ])

      observedCaudalDates.value = toDateList(observedCaudalResponse)
      harmonieCaudalDates.value = toDateList(harmonieCaudalResponse)
      harmoniePrecipDates.value = toDateList(harmoniePrecipResponse)
      epsCaudalDates.value = Array.from(new Set(epsResponses.flatMap(toDateList))).sort((a, b) =>
        b.localeCompare(a)
      )
    } catch (err) {
      console.error('Error loading available dates:', err)
      observedCaudalDates.value = []
      harmonieCaudalDates.value = []
      harmoniePrecipDates.value = []
      epsCaudalDates.value = []
      epsPrecipDates.value = []
    }
  }

  // ── Refresh caudal predictions ────────────────────────────────────────────
  let fetchRequestId = 0
  let isFullReloading = false
  let skipNextDateWatch = false

  async function refreshCaudalPredictions(requestId: number) {
    const code = props.normalizedStationCode
    if (!code) return

    const historicalCaudalType: PredictionTypeName =
      codeType.value === 'E' ? 'FICT99.historical' : 'FICT98.historical'

    const historicalEnd = new Date().toISOString()
    const historicalStart = new Date(
      Date.now() - HISTORICAL_RANGE_DAYS * 24 * 60 * 60 * 1000
    ).toISOString()

    try {
      const requests =
        codeType.value === 'E' ? caudalRequestsByType.value.E : caudalRequestsByType.value.default

      const [caudalData, caudalHistorical] = await Promise.all([
        fetchPredictionBatch(code, requests),
        getHistoricalPredictionService(code, historicalCaudalType, historicalStart, historicalEnd),
      ])
      if (requestId !== fetchRequestId) return
      applyForecastData(caudalRefs, caudalData)
      caudalRefs.historical.value = caudalHistorical

      if (props.isEmbalse) {
        const [outflow, volume] = await Promise.all([
          getHistoricalPredictionService(
            code,
            'FICT95.historical',
            historicalStart,
            historicalEnd
          ),
          getHistoricalPredictionService(
            code,
            'VICT01.historical',
            historicalStart,
            historicalEnd
          ),
        ])
        if (requestId !== fetchRequestId) return
        caudalOutflowHistorical.value = outflow
        embalseVolumeHistorical.value = volume
      } else {
        caudalOutflowHistorical.value = undefined
        embalseVolumeHistorical.value = undefined
      }
    } catch (err) {
      console.error('Error loading caudal predictions:', err)
      if (requestId !== fetchRequestId) return
      clearForecasts(caudalRefs)
      caudalOutflowHistorical.value = undefined
      embalseVolumeHistorical.value = undefined
    }
  }

  // ── Watchers ──────────────────────────────────────────────────────────────
  watch(
    [() => props.normalizedStationCode, codeType],
    async ([code]) => {
      isFullReloading = true
      clearForecasts(caudalRefs)
      caudalOutflowHistorical.value = undefined
      embalseVolumeHistorical.value = undefined
      observedCaudalDates.value = []
      harmonieCaudalDates.value = []
      harmoniePrecipDates.value = []
      epsCaudalDates.value = []
      epsPrecipDates.value = []
      selectedObservedCaudalDate.value = ''
      selectedHarmonieCaudalDate.value = ''
      selectedEpsCaudalDate.value = ''

      if (!code) {
        loadingCaudales.value = false
        isFullReloading = false
        return
      }

      const requestId = ++fetchRequestId
      loadingCaudales.value = true
      try {
        await getAvailableDates(code)
        if (requestId !== fetchRequestId) return

        skipNextDateWatch = true
        selectedObservedCaudalDate.value = pickDefaultDate('', observedCaudalDates.value)
        selectedHarmonieCaudalDate.value = pickDefaultDate('', harmonieCaudalDates.value)
        selectedEpsCaudalDate.value = pickDefaultDate('', epsCaudalDates.value)

        await refreshCaudalPredictions(requestId)
      } finally {
        isFullReloading = false
        if (requestId === fetchRequestId) loadingCaudales.value = false
      }
    },
    { immediate: true }
  )

  watch(
    [selectedHarmonieCaudalDate, selectedEpsCaudalDate],
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
        await refreshCaudalPredictions(requestId)
      } finally {
        loadingHarmoniePredict.value = false
        loadingEpsPredict.value = false
      }
    }
  )

  let resguardosRequestId = 0

  watch(
    [() => props.isEmbalse, () => props.normalizedStationCode],
    async ([isEmbalseStation, stationCode]) => {
      resguardosApiData.value = undefined

      if (!isEmbalseStation || !stationCode) return

      const requestId = ++resguardosRequestId
      loadingResguardos.value = true

      try {
        const response = await getResguardosByStationService(stationCode)
        if (requestId !== resguardosRequestId) return
        resguardosApiData.value = response
      } catch (error) {
        if (requestId !== resguardosRequestId) return
        resguardosApiData.value = undefined
        console.error('Error loading resguardos data:', error)
      } finally {
        if (requestId === resguardosRequestId) {
          loadingResguardos.value = false
        }
      }
    },
    { immediate: true }
  )

  watch(
    [
      loadingCaudales,
      loadingHarmoniePredict,
      loadingEpsPredict,
      selectedEmbalseChartTab,
      () => props.isEmbalse,
    ],
    () => {
      nextTick(updateSummaryHeights)
    }
  )
</script>

<style scoped>
  .summary-container-card {
    min-height: 0;
    overflow: hidden;
  }
</style>
