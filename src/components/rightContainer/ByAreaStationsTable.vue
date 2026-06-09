<template>
  <v-card class="bg-background" elevation="0">
    <v-card-title class="d-flex flex-wrap align-center justify-space-between ga-2 py-2 px-0">
      <div class="d-flex align-center ga-2">
        <span class="text-subtitle-1 font-weight-bold pl-4">Estaciones</span>
        <v-progress-circular
          v-if="loadingPredictions"
          size="16"
          width="2"
          indeterminate
          color="primary"
        />
      </div>

      <v-btn-toggle
        v-model="selectedSeries"
        mandatory
        density="compact"
        color="primary"
        variant="outlined"
      >
        <v-btn value="caudal" size="small">Caudal</v-btn>
        <v-btn value="precipitacion" size="small">Precipitación</v-btn>
      </v-btn-toggle>

      <v-btn-toggle
        v-model="selectedProvider"
        mandatory
        density="compact"
        color="primary"
        variant="outlined"
      >
        <v-btn value="harmonie" size="small">Harmonie</v-btn>
        <v-btn value="eps" size="small">EPS</v-btn>
        <v-btn value="p10" size="small">P10</v-btn>
        <v-btn value="p25" size="small">P25</v-btn>
        <v-btn value="p75" size="small">P75</v-btn>
        <v-btn value="p90" size="small">P90</v-btn>
      </v-btn-toggle>
    </v-card-title>

    <v-divider class="mb-3" />

    <v-data-table
      :headers="headers"
      :items="rows"
      :items-per-page="-1"
      :loading="loading || loadingPredictions"
      loading-text="Cargando estaciones..."
      item-value="codigo"
      density="compact"
      class="stations-table"
      hover
      fixed-header
      height="380"
      :row-props="getRowProps"
      @click:row="onRowClick"
    >
      <template #item.nombre="{ item }">
        <span class="font-weight-medium">{{ item.nombre }}</span>
      </template>

      <template #item.codigo="{ item }">
        <span class="text-medium-emphasis">{{ item.codigo }}</span>
      </template>

      <template #item.tipo="{ item }">
        <v-chip
          :color="tipoColor(item.tipo)"
          size="x-small"
          variant="tonal"
          class="font-weight-bold"
        >
          {{ item.tipoDisplay || '?' }}
        </v-chip>
      </template>

      <template #item.h1="{ item }">
        <span :class="cellClass('h1', item.h1, item)">{{ formatValue(item.h1) }}</span>
      </template>
      <template #item.h2="{ item }">
        <span :class="cellClass('h2', item.h2, item)">{{ formatValue(item.h2) }}</span>
      </template>
      <template #item.h4="{ item }">
        <span :class="cellClass('h4', item.h4, item)">{{ formatValue(item.h4) }}</span>
      </template>
      <template #item.h8="{ item }">
        <span :class="cellClass('h8', item.h8, item)">{{ formatValue(item.h8) }}</span>
      </template>
      <template #item.h12="{ item }">
        <span :class="cellClass('h12', item.h12, item)">{{ formatValue(item.h12) }}</span>
      </template>
      <template #item.h24="{ item }">
        <span :class="cellClass('h24', item.h24, item)">{{ formatValue(item.h24) }}</span>
      </template>

      <template #bottom>
        <div class="d-flex justify-end px-4 py-2 text-caption text-medium-emphasis">
          <span>{{ rows.length }} estaciones en total</span>
        </div>
      </template>
    </v-data-table>
  </v-card>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import type {
    DataStationPrediction,
    PredictionTypeName,
    StationPrediction,
  } from '@/types/Predictions'
  import { useSubcuencaSelectionBus } from '@/composables/useSubcuencaSelectionBus'
  import type { StationData } from '@/utils/stationsToGeoJSON'
  import { getAvailablePredictionsService, getPredictionsService } from '@/services/predictions'
  import {
    aforosWithCaudalPredictions,
    embalsesWithCaudalPredictions,
  } from '@/constants/predictionsAvailableData'
  import { SAIH_TYPE_COLORS } from '@/utils/saihStations'
  import {
    extractAccumulatedHorizonValues,
    PRECIP_HORIZON_META,
    type PrecipHorizonKey,
  } from './utils/precipAccumulation'
  import {
    DEFAULT_PRECIP_THRESHOLDS_GRAVE,
    DEFAULT_PRECIP_THRESHOLDS_LEVE,
    DEFAULT_PRECIP_THRESHOLDS_MEDIO,
    type PrecipThresholdLevel,
    type PrecipThresholdMap,
  } from './utils/precipThresholds'

  const emit = defineEmits<{
    (e: 'update:selectedStationCode', value: string | null): void
  }>()

  type DataSeries = 'caudal' | 'precipitacion'
  type DataProvider = 'harmonie' | 'eps' | 'p10' | 'p25' | 'p75' | 'p90'

  type HorizonValues = {
    h1: number | null
    h2: number | null
    h4: number | null
    h8: number | null
    h12: number | null
    h24: number | null
  }

  type StationForecastRow = HorizonValues & {
    nombre: string
    codigo: string
    tipo: string
    tipoDisplay: string
    hasCaudal: boolean
    umbral1: number | null
    umbral2: number | null
    umbral3: number | null
    precipThresholdsLeve: PrecipThresholdMap
    precipThresholdsMedio: PrecipThresholdMap
    precipThresholdsGrave: PrecipThresholdMap
  }

  type PredictionRequest = {
    type: PredictionTypeName
    percentile?: string
  }

  const props = withDefaults(
    defineProps<{
      stations: StationData[]
      loading?: boolean
      selectedStationCode?: string | null
    }>(),
    {
      loading: false,
      selectedStationCode: null,
    }
  )

  const selectedSeries = ref<DataSeries>('caudal')
  const selectedProvider = ref<DataProvider>('eps')
  const selectedRowCode = ref<string | null>(null)
  const loadingPredictions = ref(false)
  const predictionsByStation = ref<Record<string, HorizonValues>>({})
  const selectionBus = useSubcuencaSelectionBus()
  let fetchRequestId = 0

  const stationsWithCaudal = new Set([
    ...aforosWithCaudalPredictions,
    ...embalsesWithCaudalPredictions,
  ])

  function stationHasCaudal(station: StationData): boolean {
    return stationsWithCaudal.has(station.stationCode.trim().toUpperCase())
  }

  function getNumericThreshold(
    station: StationData,
    keys: Array<'umbralCaudal1' | 'umbralCaudal2' | 'umbralCaudal3'>
  ): number | null {
    if (!station.threshold) return null
    for (const key of keys) {
      const raw = station.threshold[key]
      if (typeof raw === 'number' && Number.isFinite(raw)) return raw
    }
    return null
  }

  function readNumber(keys: string[], source?: Record<string, unknown>): number | null {
    if (!source) return null

    for (const key of keys) {
      const raw = source[key]
      if (raw == null) continue
      if (typeof raw === 'number' && Number.isFinite(raw)) return raw
      if (typeof raw === 'string') {
        const parsed = Number.parseFloat(raw.trim().replace(',', '.'))
        if (Number.isFinite(parsed)) return parsed
      }
    }

    return null
  }

  function readThresholdMapFromNested(
    source: Record<string, unknown> | undefined,
    keys: string[]
  ): Partial<PrecipThresholdMap> {
    if (!source) return {}

    for (const key of keys) {
      const nested = source[key]
      if (!nested || typeof nested !== 'object') continue

      const asRecord = nested as Record<string, unknown>
      const out: Partial<PrecipThresholdMap> = {}

      for (const { key: horizonKey } of PRECIP_HORIZON_META) {
        const value = readNumber([horizonKey], asRecord)
        if (value != null) out[horizonKey] = value
      }

      if (Object.keys(out).length > 0) return out
    }

    return {}
  }

  function thresholdKeysFor(
    horizon: { key: PrecipHorizonKey; hours: number },
    level: PrecipThresholdLevel
  ): string[] {
    const suffixByLevel: Record<PrecipThresholdLevel, string[]> = {
      leve: ['leve', 'amarillo', '1'],
      medio: ['medio', 'naranja', '2'],
      grave: ['grave', 'rojo', '3', '2'],
    }

    const suffix = suffixByLevel[level]

    return [
      `umbral_precip_${horizon.key}_${suffix[0]}`,
      `umbral_precip_${horizon.key}_${suffix[1]}`,
      `umbral_precip_${horizon.hours}h_${suffix[0]}`,
      `umbral_precip_${horizon.hours}h_${suffix[1]}`,
      `umbral_lluvia_${horizon.hours}h_${suffix[0]}`,
      `umbral_lluvia_${horizon.hours}h_${suffix[1]}`,
      `precip_${horizon.key}_${suffix[0]}`,
      `precip_${horizon.key}_${suffix[1]}`,
      `${horizon.key}_${suffix[0]}`,
      `${horizon.key}_${suffix[1]}`,
      ...suffix
        .slice(2)
        .flatMap((legacy) => [
          `umbral_precip_${horizon.hours}h_${legacy}`,
          `umbral_lluvia_${horizon.hours}h_${legacy}`,
          `${horizon.key}_${legacy}`,
        ]),
    ]
  }

  function getPrecipThresholds(
    station: StationData,
    level: PrecipThresholdLevel
  ): PrecipThresholdMap {
    const thresholdSource =
      station.threshold && typeof station.threshold === 'object'
        ? (station.threshold as Record<string, unknown>)
        : undefined

    const nested = readThresholdMapFromNested(
      thresholdSource,
      level === 'leve'
        ? ['thresholdsLeve', 'thresholds_leve', 'umbralesLeve', 'umbralLeve']
        : level === 'medio'
          ? ['thresholdsMedio', 'thresholds_medio', 'umbralesMedio', 'umbralMedio']
          : ['thresholdsGrave', 'thresholds_grave', 'umbralesGrave', 'umbralGrave']
    )

    const result =
      level === 'leve'
        ? { ...DEFAULT_PRECIP_THRESHOLDS_LEVE }
        : level === 'medio'
          ? { ...DEFAULT_PRECIP_THRESHOLDS_MEDIO }
          : { ...DEFAULT_PRECIP_THRESHOLDS_GRAVE }

    for (const horizon of PRECIP_HORIZON_META) {
      if (horizon.hours === 0) continue
      const value = readNumber(thresholdKeysFor(horizon, level), thresholdSource)
      if (value != null) result[horizon.key] = value
    }

    return { ...result, ...nested }
  }

  const baseRows = computed<Omit<StationForecastRow, keyof HorizonValues>[]>(() =>
    props.stations.map((station) => ({
      nombre: station.name,
      codigo: station.stationCode,
      tipo: station.tipoCod ?? '',
      tipoDisplay: station.stationType ?? station.tipoCod ?? '',
      hasCaudal: stationHasCaudal(station),
      umbral1: getNumericThreshold(station, ['umbralCaudal1']),
      umbral2: getNumericThreshold(station, ['umbralCaudal2']),
      umbral3: getNumericThreshold(station, ['umbralCaudal3']),
      precipThresholdsLeve: getPrecipThresholds(station, 'leve'),
      precipThresholdsMedio: getPrecipThresholds(station, 'medio'),
      precipThresholdsGrave: getPrecipThresholds(station, 'grave'),
    }))
  )

  const rows = computed<StationForecastRow[]>(() =>
    baseRows.value.map((base) => ({
      ...base,
      ...(predictionsByStation.value[base.codigo] ?? emptyHorizons()),
    }))
  )

  const headers = computed(() => [
    { title: 'Estación', key: 'nombre', sortable: true, width: 200 },
    { title: 'Código', key: 'codigo', sortable: true, width: 90 },
    { title: 'Tipo', key: 'tipo', sortable: true, width: 80 },
    { title: '+1h', key: 'h1', align: 'end' as const, sortable: true, width: 70 },
    { title: '+2h', key: 'h2', align: 'end' as const, sortable: true, width: 70 },
    { title: '+4h', key: 'h4', align: 'end' as const, sortable: true, width: 70 },
    { title: '+8h', key: 'h8', align: 'end' as const, sortable: true, width: 70 },
    { title: '+12h', key: 'h12', align: 'end' as const, sortable: true, width: 75 },
    { title: '+24h', key: 'h24', align: 'end' as const, sortable: true, width: 75 },
  ])

  // ── Prediction fetching ──────────────────────────────────────────────────────

  function emptyHorizons(): HorizonValues {
    return { h1: null, h2: null, h4: null, h8: null, h12: null, h24: null }
  }

  function providerPercentile(provider: DataProvider): string | undefined {
    if (provider === 'p10') return '10'
    if (provider === 'p25') return '25'
    if (provider === 'p75') return '75'
    if (provider === 'p90') return '90'
    return undefined
  }

  function predictionRequestFor(station: StationData): PredictionRequest {
    const provider = selectedProvider.value
    const percentile = providerPercentile(provider)

    if (selectedSeries.value === 'precipitacion') {
      if (provider === 'harmonie') return { type: 'P.harmonie.forecast' }
      return { type: 'P.ens.forecast', percentile }
    }

    const isEmbalse = (station.tipoCod ?? '').toUpperCase() === 'E'
    if (provider === 'harmonie') {
      return { type: isEmbalse ? 'I.NAM.harmonie' : 'Q.NAM.harmonie' }
    }

    if (isEmbalse) {
      return percentile ? { type: 'I.NAM.ens', percentile } : { type: 'I.NAM.ens.medio' }
    }

    return { type: 'Q.NAM.ens', percentile }
  }

  function toDateList(
    response: Awaited<ReturnType<typeof getAvailablePredictionsService>>
  ): string[] {
    const fromSimulation = (response.simulationDates ?? [])
      .map((item) => item.simulationDate)
      .filter((v): v is string => Boolean(v))
    const fromDates = (response.dates ?? []).filter((v): v is string => Boolean(v))
    return Array.from(new Set([...fromSimulation, ...fromDates])).sort((a, b) => b.localeCompare(a))
  }

  const TWO_HOURS_MS = 2 * 60 * 60 * 1000
  const HORIZON_HOURS = [1, 2, 4, 8, 12, 24] as const

  function extractHorizonValues(prediction?: StationPrediction): HorizonValues {
    const result = emptyHorizons()

    if (!prediction?.results?.length) {
      return result
    }

    const startMs = new Date(prediction.results[0].date).getTime()

    const keyMap: Record<number, keyof HorizonValues> = {
      1: 'h1',
      2: 'h2',
      4: 'h4',
      8: 'h8',
      12: 'h12',
      24: 'h24',
    }

    for (const hours of HORIZON_HOURS) {
      const targetMs = startMs + hours * 60 * 60 * 1000

      let closest: { value: number } | null = null
      let minDiff = Infinity

      for (const r of prediction.results) {
        const rMs = new Date(r.date).getTime()
        const diff = Math.abs(rMs - targetMs)

        if (diff < minDiff) {
          minDiff = diff
          closest = r
        }
      }

      if (closest) {
        result[keyMap[hours]] = Number(closest.value)
      }
    }

    return result
  }

  function extractPrecipAccumulatedHorizonValues(prediction?: StationPrediction): HorizonValues {
    const accumulated = extractAccumulatedHorizonValues(prediction)

    return {
      h1: accumulated.h1,
      h2: accumulated.h2,
      h4: accumulated.h4,
      h8: accumulated.h8,
      h12: accumulated.h12,
      h24: accumulated.h24,
    }
  }

  async function fetchForStation(station: StationData): Promise<HorizonValues> {
    if (selectedSeries.value === 'caudal' && !stationHasCaudal(station)) {
      return emptyHorizons()
    }

    try {
      const request = predictionRequestFor(station)
      const datesResponse = await getAvailablePredictionsService(station.stationCode, request.type)
      const dates = toDateList(datesResponse)
      if (!dates.length) return emptyHorizons()

      const prediction = await getPredictionsService(
        station.stationCode,
        request.type,
        dates[0],
        request.percentile
      )

      if (selectedSeries.value === 'precipitacion') {
        return extractPrecipAccumulatedHorizonValues(prediction)
      }
      return extractHorizonValues(prediction)
    } catch {
      return emptyHorizons()
    }
  }

  async function refreshPredictions() {
    if (!props.stations.length) {
      predictionsByStation.value = {}
      return
    }

    const requestId = ++fetchRequestId
    loadingPredictions.value = true

    try {
      const results = await Promise.all(
        props.stations.map(async (station) => {
          const horizons = await fetchForStation(station)
          return [station.stationCode, horizons] as const
        })
      )

      if (requestId !== fetchRequestId) return

      predictionsByStation.value = Object.fromEntries(results)
    } finally {
      if (requestId === fetchRequestId) {
        loadingPredictions.value = false
      }
    }
  }

  // ── Watches ──────────────────────────────────────────────────────────────────

  watch(
    () => props.stations,
    () => {
      selectedRowCode.value = null
      emitSelection(null)
      void refreshPredictions()
    },
    { immediate: true, deep: true }
  )

  watch([selectedSeries, selectedProvider], () => {
    void refreshPredictions()
    if (selectedRowCode.value) {
      const row = rows.value.find((r) => r.codigo === selectedRowCode.value) ?? null
      emitSelection(row)
    }
  })

  watch(
    () => props.selectedStationCode,
    (code) => {
      if (code !== selectedRowCode.value) {
        selectedRowCode.value = code ?? null
        const row = rows.value.find((r) => r.codigo === code) ?? null
        emitSelection(row)
      }
    }
  )

  // ── Selection & chart ────────────────────────────────────────────────────────

  function toChartData(row: StationForecastRow): DataStationPrediction {
    const horizonResults = HORIZON_HOURS.map((h, i) => ({
      id: i + 1,
      date: new Date(Date.now() + h * 60 * 60 * 1000).toISOString(),
      value: (row[`h${h}` as keyof HorizonValues] as number | null) ?? 0,
      flag: 0,
    })).filter((r) => r.value !== 0)

    const buildPred = (typeName: string, percentile?: string): StationPrediction => ({
      id: `${typeName}-${row.codigo}`,
      stationId: row.codigo,
      stationName: row.nombre,
      predictionTypeName: typeName,
      simulationDate: new Date().toISOString(),
      predictionDate: new Date().toISOString(),
      percentile,
      predictionProvider: 'subcuenca',
      predictedBy: 'subcuenca-table',
      results: horizonResults,
    })

    const isEmbalse = row.tipo.toUpperCase() === 'E'

    const provider = selectedProvider.value
    const percentile = providerPercentile(provider)

    if (selectedSeries.value === 'caudal') {
      const epsType =
        provider === 'harmonie'
          ? isEmbalse
            ? 'I.NAM.ens.medio'
            : 'Q.NAM.ens'
          : isEmbalse
            ? percentile
              ? 'I.NAM.ens'
              : 'I.NAM.ens.medio'
            : 'Q.NAM.ens'

      return {
        forecastHarmonie: buildPred(isEmbalse ? 'I.NAM.harmonie' : 'Q.NAM.harmonie'),
        forecastEpsat: buildPred(epsType, percentile),
      }
    }

    return {
      forecastHarmonie: buildPred('P.harmonie.forecast'),
      forecastEpsat: buildPred('P.ens.forecast', percentile),
    }
  }

  function emitSelection(row: StationForecastRow | null) {
    selectionBus.emit({
      series: selectedSeries.value,
      station: row ? { codigo: row.codigo, nombre: row.nombre } : null,
      data: row ? toChartData(row) : null,
    })
  }

  function extractRow(payload: unknown): StationForecastRow | null {
    if (!payload || typeof payload !== 'object') return null

    const maybeRow = payload as {
      codigo?: unknown
      item?: { raw?: unknown; codigo?: unknown }
    }

    const directCode = maybeRow.codigo
    if (typeof directCode === 'string') {
      return rows.value.find((r) => r.codigo === directCode) ?? null
    }

    const nestedRaw = maybeRow.item?.raw
    if (nestedRaw && typeof nestedRaw === 'object') {
      const code = (nestedRaw as { codigo?: unknown }).codigo
      if (typeof code === 'string') return rows.value.find((r) => r.codigo === code) ?? null
    }

    const nestedCode = maybeRow.item?.codigo
    if (typeof nestedCode === 'string') {
      return rows.value.find((r) => r.codigo === nestedCode) ?? null
    }

    return null
  }

  function onRowClick(_: Event, payload: unknown) {
    const row = extractRow(payload)
    if (!row) return

    const willSelect = selectedRowCode.value !== row.codigo
    selectedRowCode.value = willSelect ? row.codigo : null
    emit('update:selectedStationCode', willSelect ? row.codigo : null)
    emitSelection(willSelect ? row : null)
  }

  function getRowProps(payload: unknown): { class: string; style: string } {
    const row = extractRow(payload)
    const isSelected = row ? selectedRowCode.value === row.codigo : false

    return {
      class: isSelected ? 'stations-table__row--selected' : '',
      style: 'cursor: pointer;',
    }
  }

  // ── Formatting & colors ──────────────────────────────────────────────────────

  function tipoColor(tipo: string): string {
    return SAIH_TYPE_COLORS[tipo.toUpperCase()] ?? '#6c757d'
  }

  function cellClass(
    horizon: 'h1' | 'h2' | 'h4' | 'h8' | 'h12' | 'h24',
    value: number | null,
    row: StationForecastRow
  ): string {
    if (value == null) return ''

    if (selectedSeries.value === 'precipitacion') {
      const grave = row.precipThresholdsGrave[horizon]
      const medio = row.precipThresholdsMedio[horizon]
      const leve = row.precipThresholdsLeve[horizon]
      if (grave != null && value >= grave) return 'cell-red'
      if (medio != null && value >= medio) return 'cell-orange'
      if (leve != null && value >= leve) return 'cell-yellow'
      return ''
    }

    if (row.umbral3 != null && value >= row.umbral3) return 'cell-red'
    if (row.umbral2 != null && value >= row.umbral2) return 'cell-orange'
    if (row.umbral1 != null && value >= row.umbral1) return 'cell-yellow'
    return ''
  }

  function formatValue(value: number | null): string {
    if (value == null) return '--'
    if (selectedSeries.value === 'precipitacion') return value.toFixed(1)
    return value.toFixed(2)
  }
</script>

<style scoped>
  .stations-table :deep(.v-data-table__th),
  .stations-table :deep(.v-data-table__td) {
    white-space: nowrap;
  }

  .stations-table :deep(.stations-table__row--selected td) {
    background: rgba(var(--v-theme-primary), 0.12);
  }

  .cell-yellow {
    background: #fde68a;
    color: #7c2d12;
    font-weight: 700;
    border-radius: 4px;
    padding: 1px 5px;
  }

  .cell-orange {
    background: #fdba74;
    color: #7c2d12;
    font-weight: 700;
    border-radius: 4px;
    padding: 1px 5px;
  }

  .cell-red {
    background: #f87171;
    color: #7f1d1d;
    font-weight: 700;
    border-radius: 4px;
    padding: 1px 5px;
  }
</style>
