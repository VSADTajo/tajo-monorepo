<template>
  <div class="precipitations-chart">
    <div v-if="loading" class="chart-loading-state" :style="{ height: `${chartHeight}px` }">
      <v-skeleton-loader type="image" class="h-100 w-100" />
    </div>
    <apexchart
      v-else-if="hasRenderableSeries"
      :height="chartHeight"
      :options="chartOptions"
      :series="series"
    />
    <div v-else class="chart-empty-state" :style="{ height: `${chartHeight}px` }">
      Sin datos para mostrar
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import type { ApexOptions } from 'apexcharts'
  import type { DataStationPrediction, Point, RangePoint, SeriesItem } from '@/types/Predictions'
  import { dateFormattedWithHours } from '@/utils/dates'

  const props = defineProps<{
    data: DataStationPrediction
    height?: number
    loading?: boolean
    mode?: 'all' | 'precipitations' | 'accumulated'
  }>()

  const chartHeight = computed(() => props.height ?? 550)

  function normalizePredictionResults(prediction?: DataStationPrediction['forecastHarmonie']) {
    if (!prediction?.results?.length) return null

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
      .filter((item): item is { date: string; value: number | null } => item !== null)
  }

  const historicalData = computed(() => {
    return normalizePredictionResults(props.data.historical)
  })

  // Extraer fechas y valores de det
  const HarmonieData = computed(() => {
    return normalizePredictionResults(props.data.forecastHarmonie)
  })

  // Extraer fechas y valores de ens
  const epsatData = computed(() => {
    return normalizePredictionResults(props.data.forecastEpsat)
  })

  // Extraer fechas y valores de p10
  const p10Data = computed(() => {
    return normalizePredictionResults(props.data.forecastEnsP10)
  })

  // Extraer fechas y valores de p75
  const p75Data = computed(() => {
    return normalizePredictionResults(props.data.forecastEnsP75)
  })

  const p25Data = computed(() => {
    return normalizePredictionResults(props.data.forecastEnsP25)
  })

  // Extraer fechas y valores de p75
  const p90Data = computed(() => {
    return normalizePredictionResults(props.data.forecastEnsP90)
  })

  // Todas las fechas únicas ordenadas
  const allDates = computed(() => {
    const dateSet = new Set<string>()
    historicalData.value?.forEach((d) => dateSet.add(d.date))
    HarmonieData.value?.forEach((d) => dateSet.add(d.date))
    epsatData.value?.forEach((d) => dateSet.add(d.date))
    p10Data.value?.forEach((d) => dateSet.add(d.date))
    p75Data.value?.forEach((d) => dateSet.add(d.date))
    p25Data.value?.forEach((d) => dateSet.add(d.date))
    p90Data.value?.forEach((d) => dateSet.add(d.date))
    return Array.from(dateSet).sort()
  })

  // Categorías formateadas para el eje X (una por cada fecha)
  const xLabels = computed(() =>
    allDates.value.map((date) => dateFormattedWithHours(new Date(date).getTime()))
  )

  const observedEndLabel = computed(() => {
    if (!historicalData.value?.length) return null

    const lastObserved = [...historicalData.value]
      .reverse()
      .find((item) => Number.isFinite(item.value))

    if (!lastObserved) return null

    const index = allDates.value.lastIndexOf(lastObserved.date)
    if (index < 0) return null

    return xLabels.value[index] ?? null
  })

  const observedEndDate = computed(() => {
    if (!historicalData.value?.length) return null

    const lastObserved = [...historicalData.value]
      .reverse()
      .find((item) => Number.isFinite(item.value))

    return lastObserved?.date ?? null
  })

  const observedEndXAnnotation = computed(() => {
    if (!observedEndLabel.value) return []

    return [
      {
        x: observedEndLabel.value,
        borderColor: '#455A64',
        strokeDashArray: 4,
        label: {
          text: 'Tº',
          orientation: 'horizontal',
          style: {
            background: '#455A64',
            color: '#fff',
            fontSize: '10px',
          },
        },
      },
    ]
  })

  function hasFiniteValue(values: Array<number | null>): boolean {
    return values.some((value) => Number.isFinite(value))
  }

  function hasFiniteRange(values: Array<[number | null, number | null] | null>): boolean {
    return values.some(
      (range) =>
        Array.isArray(range) &&
        range.length === 2 &&
        Number.isFinite(range[0]) &&
        Number.isFinite(range[1])
    )
  }

  function computeObservedCumulative(): Array<number | null> {
    const observedMap = new Map((historicalData.value ?? []).map((d) => [d.date, d.value]))
    let running = 0

    return allDates.value.map((date) => {
      const value = observedMap.get(date)
      if (!Number.isFinite(value)) return null
      running += value as number
      return running
    })
  }

  const observedCumulativeValues = computed(() => computeObservedCumulative())

  const observedCumulativeEnd = computed(() => {
    for (let i = observedCumulativeValues.value.length - 1; i >= 0; i--) {
      const value = observedCumulativeValues.value[i]
      if (Number.isFinite(value)) {
        return {
          date: allDates.value[i],
          value: value as number,
        }
      }
    }

    return null
  })

  function computeForecastCumulativeValues(
    source: Array<{ date: string; value: number | null }> | null | undefined
  ): Array<number | null> {
    const sourceMap = new Map((source ?? []).map((d) => [d.date, d.value]))
    const startDate = observedEndDate.value
    let running = observedCumulativeEnd.value?.value ?? 0

    return allDates.value.map((date) => {
      if (startDate && date < startDate) {
        return null
      }

      const value = sourceMap.get(date)
      if (!Number.isFinite(value)) {
        return null
      }

      running += value as number
      return running
    })
  }

  function computeForecastCumulativeRange(
    lowSource: Array<{ date: string; value: number | null }> | null | undefined,
    highSource: Array<{ date: string; value: number | null }> | null | undefined
  ): Array<[number | null, number | null] | null> {
    const lowValues = computeForecastCumulativeValues(lowSource)
    const highValues = computeForecastCumulativeValues(highSource)

    return allDates.value.map((_, index) => {
      const low = lowValues[index] ?? null
      const high = highValues[index] ?? null
      return Number.isFinite(low) && Number.isFinite(high) ? [low, high] : null
    })
  }

  const allSeries = computed<SeriesItem[]>(() => {
    if (allDates.value.length === 0) return []

    const result: SeriesItem[] = []
    const labels = xLabels.value

    // Observado
    if (historicalData.value) {
      const historicalMap = new Map(historicalData.value.map((d) => [d.date, d.value]))
      const values = allDates.value.map((date) => historicalMap.get(date) ?? null)
      if (hasFiniteValue(values)) {
        result.push({
          name: 'Precipitación Observada',
          type: 'bar',
          data: allDates.value.map((date, i) => ({
            x: labels[i],
            y: values[i],
          })),
        })
      }
    }

    // Harmonie
    if (HarmonieData.value) {
      const detMap = new Map(HarmonieData.value.map((d) => [d.date, d.value]))
      const values = allDates.value.map((date) => detMap.get(date) ?? null)
      if (hasFiniteValue(values)) {
        result.push({
          name: 'Predicción Det. Harmonie',
          type: 'bar',
          data: allDates.value.map((date, i) => ({
            x: labels[i],
            y: values[i],
          })),
        })
      }
    }

    // EPS
    if (epsatData.value) {
      const epsatMap = new Map(epsatData.value.map((d) => [d.date, d.value]))
      const values = allDates.value.map((date) => epsatMap.get(date) ?? null)
      if (hasFiniteValue(values)) {
        result.push({
          name: 'Predicción Prob. EPS',
          type: 'bar',
          data: allDates.value.map((date, i) => ({
            x: labels[i],
            y: values[i],
          })),
        })
      }
    }

    // P10-P90 RangeArea (must come before bars so it renders behind)
    if (p10Data.value && p90Data.value) {
      const p10Map = new Map(p10Data.value.map((d) => [d.date, d.value]))
      const p90Map = new Map(p90Data.value.map((d) => [d.date, d.value]))
      const ranges: Array<[number | null, number | null] | null> = allDates.value.map((date) => {
        const low = p10Map.get(date) ?? null
        const high = p90Map.get(date) ?? null
        return Number.isFinite(low) && Number.isFinite(high) ? [low, high] : null
      })
      if (hasFiniteRange(ranges)) {
        result.push({
          name: 'Percentiles P10-P90',
          type: 'rangeArea',
          data: allDates.value.map((date, i) => ({
            x: labels[i],
            y: ranges[i],
          })),
        })
      }
    }

    // P25-P75 RangeArea
    if (p25Data.value && p75Data.value) {
      const p25Map = new Map(p25Data.value.map((d) => [d.date, d.value]))
      const p75Map = new Map(p75Data.value.map((d) => [d.date, d.value]))
      const ranges: Array<[number | null, number | null] | null> = allDates.value.map((date) => {
        const low = p25Map.get(date) ?? null
        const high = p75Map.get(date) ?? null
        return Number.isFinite(low) && Number.isFinite(high) ? [low, high] : null
      })
      if (hasFiniteRange(ranges)) {
        result.push({
          name: 'Percentiles P25-P75',
          type: 'rangeArea',
          data: allDates.value.map((date, i) => ({
            x: labels[i],
            y: ranges[i],
          })),
        })
      }
    }

    // Acumulado observado (eje derecho)
    if (historicalData.value) {
      const values = observedCumulativeValues.value
      if (hasFiniteValue(values)) {
        result.push({
          name: 'Acumulado Observado',
          type: 'bar',
          yAxisIndex: props.mode === 'accumulated' ? 0 : 1,
          data: allDates.value.map((date, i) => ({
            x: labels[i],
            y: values[i],
          })),
        })
      }
    }

    // Acumulados de prediccion (eje derecho, arrancan desde fin observado)
    const cumulativeForecastSeries: Array<{
      name: string
      source: Array<{ date: string; value: number | null }> | null | undefined
    }> = [
      { name: 'Acumulado Det. Harmonie', source: HarmonieData.value },
      { name: 'Acumulado EPS Medio', source: epsatData.value },
    ]

    cumulativeForecastSeries.forEach((serie) => {
      const values = computeForecastCumulativeValues(serie.source)
      if (!hasFiniteValue(values)) return

      result.push({
        name: serie.name,
        type: 'bar',
        yAxisIndex: props.mode === 'accumulated' ? 0 : 1,
        data: allDates.value.map((date, i) => ({
          x: labels[i],
          y: values[i],
        })),
      })
    })

    if (p10Data.value && p90Data.value) {
      const ranges = computeForecastCumulativeRange(p10Data.value, p90Data.value)
      if (hasFiniteRange(ranges)) {
        result.push({
          name: 'Acumulado Percentiles P10-P90',
          type: 'rangeArea',
          yAxisIndex: props.mode === 'accumulated' ? 0 : 1,
          data: allDates.value.map((date, i) => ({
            x: labels[i],
            y: ranges[i],
          })),
        })
      }
    }

    if (p25Data.value && p75Data.value) {
      const ranges = computeForecastCumulativeRange(p25Data.value, p75Data.value)
      if (hasFiniteRange(ranges)) {
        result.push({
          name: 'Acumulado Percentiles P25-P75',
          type: 'rangeArea',
          yAxisIndex: props.mode === 'accumulated' ? 0 : 1,
          data: allDates.value.map((date, i) => ({
            x: labels[i],
            y: ranges[i],
          })),
        })
      }
    }

    return result
  })

  const series = computed<SeriesItem[]>(() => {
    const mode = props.mode ?? 'all'
    if (mode === 'all') return allSeries.value

    if (mode === 'accumulated') {
      return allSeries.value.filter((serie) => serie.name.startsWith('Acumulado '))
    }

    return allSeries.value.filter((serie) => !serie.name.startsWith('Acumulado '))
  })

  const hasRenderableSeries = computed(() => series.value.length > 0)

  function getSeriesColor(name: string): string {
    function darkenHex(hex: string, amount: number): string {
      const safeHex = hex.replace('#', '')
      const value = Number.parseInt(safeHex, 16)
      if (!Number.isFinite(value)) return hex

      const r = Math.max(0, Math.min(255, Math.round(((value >> 16) & 0xff) * (1 - amount))))
      const g = Math.max(0, Math.min(255, Math.round(((value >> 8) & 0xff) * (1 - amount))))
      const b = Math.max(0, Math.min(255, Math.round((value & 0xff) * (1 - amount))))

      return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
    }

    const baseColors: Record<string, string> = {
      'Precipitación Observada': '#2E7D32',
      'Predicción Det. Harmonie': '#1565C0',
      'Predicción Prob. EPS': '#FF9800',
      'Percentiles P10-P90': '#D3D3D3',
      'Percentiles P25-P75': '#696969',
    }

    const cumulativePairs: Record<string, string> = {
      'Acumulado Observado': 'Precipitación Observada',
      'Acumulado Det. Harmonie': 'Predicción Det. Harmonie',
      'Acumulado EPS Medio': 'Predicción Prob. EPS',
      'Acumulado Percentiles P10-P90': 'Percentiles P10-P90',
      'Acumulado Percentiles P25-P75': 'Percentiles P25-P75',
    }

    if (cumulativePairs[name]) {
      const pairColor = baseColors[cumulativePairs[name]] ?? '#9E9E9E'
      return darkenHex(pairColor, 0.22)
    }

    if (baseColors[name]) {
      return baseColors[name]
    }

    switch (name) {
      default:
        return '#9E9E9E'
    }
  }

  function getSeriesFillOpacity(name: string): number {
    if (
      name === 'Percentiles P10-P90' ||
      name === 'Percentiles P25-P75' ||
      name === 'Acumulado Percentiles P10-P90' ||
      name === 'Acumulado Percentiles P25-P75'
    ) {
      return 0.35
    }
    return 1
  }

  function getSeriesStrokeWidth(name: string): number {
    if (name === 'Precipitación Observada') return 2
    if (
      name === 'Percentiles P10-P90' ||
      name === 'Percentiles P25-P75' ||
      name === 'Acumulado Percentiles P10-P90' ||
      name === 'Acumulado Percentiles P25-P75'
    ) {
      return 1
    }
    if (name.startsWith('Acumulado ')) return 2
    return 0
  }

  // Colores dinámicos en el mismo orden de series
  const dynamicColors = computed(() => {
    return series.value.map((serie) => getSeriesColor(serie.name))
  })

  // Opacidad de relleno por serie (rangeArea necesita opacidad explícita)
  const dynamicFillOpacity = computed(() => {
    return series.value.map((serie) => getSeriesFillOpacity(serie.name))
  })

  // Ancho de trazo por serie
  const dynamicStrokeWidth = computed(() => {
    return series.value.map((serie) => getSeriesStrokeWidth(serie.name))
  })

  const dynamicStrokeCurve = computed(() =>
    series.value.map((serie) => (serie.type === 'bar' ? 'straight' : 'smooth'))
  )

  function organizeLegendRows(rootEl: HTMLElement): void {
    const legendRoot = rootEl.querySelector('.apexcharts-legend') as HTMLElement | null
    if (!legendRoot) return

    const legendSeries = Array.from(
      rootEl.querySelectorAll('.apexcharts-legend-series')
    ) as HTMLElement[]

    const nonAccum: HTMLElement[] = []
    const accum: HTMLElement[] = []
    let firstAccumMarked = false

    legendSeries.forEach((item) => {
      const label = item.querySelector('.apexcharts-legend-text')?.textContent?.trim() ?? ''
      item.classList.remove(
        'legend-series--nonaccum',
        'legend-series--accum',
        'legend-series--accum-break'
      )

      if (label.startsWith('Acumulado')) {
        item.classList.add('legend-series--accum')
        if (!firstAccumMarked) {
          item.classList.add('legend-series--accum-break')
          firstAccumMarked = true
        }
        accum.push(item)
      } else {
        item.classList.add('legend-series--nonaccum')
        nonAccum.push(item)
      }
    })

    // Flatten Apex internal groups and enforce deterministic row order.
    ;[...nonAccum, ...accum].forEach((item) => {
      legendRoot.appendChild(item)
    })

    rootEl.querySelectorAll('.apexcharts-legend-group').forEach((group) => {
      if (group.childElementCount === 0) {
        group.remove()
      }
    })
  }

  const chartOptions = computed<ApexOptions>(() => ({
    chart: {
      type: 'line',
      stacked: false,
      height: chartHeight.value,
      zoom: { enabled: true, type: 'xy', autoScaleYaxis: false, allowMouseWheelZoom: false },
      toolbar: { show: true },
      events: {
        mounted: (chartContext: { el: HTMLElement }) => {
          try {
            const el = chartContext.el as HTMLElement
            // remove any SVG <title> that shows native 'Chart' tooltip
            el.querySelectorAll('svg title').forEach((t) => t.remove())
            // remove any nodes that contain the exact text 'Chart'
            el.querySelectorAll('*').forEach((n) => {
              if (n.textContent === 'Chart') n.remove()
            })
            // also clear title attribute if present
            if (el.getAttribute('title')) el.removeAttribute('title')

            organizeLegendRows(el)
          } catch {
            // ignore
          }
        },
        updated: (chartContext: { el: HTMLElement }) => {
          try {
            organizeLegendRows(chartContext.el as HTMLElement)
          } catch {
            // ignore
          }
        },
      },
    },
    colors: dynamicColors.value,
    fill: {
      opacity: dynamicFillOpacity.value,
    },
    stroke: {
      curve: dynamicStrokeCurve.value,
      lineCap: 'round',
      width: dynamicStrokeWidth.value,
    },
    legend: {
      position: 'bottom' as const,
      clusterGroupedSeries: false,
    },
    dataLabels: {
      enabled: false,
    },
    xaxis: {
      type: 'category',
      tickPlacement: (allDates.value.length > 1 ? 'on' : 'between') as 'on' | 'between',
      tickAmount: allDates.value.length > 1 ? Math.min(8, allDates.value.length) : undefined,
      labels: {
        rotate: 0,
        rotateAlways: false,
        hideOverlappingLabels: true,
      },
    },
    yaxis:
      props.mode === 'accumulated'
        ? [
            {
              min: 0,
              title: {
                text: 'mm acumulado',
              },
              labels: {
                formatter: (value: number) => Number(value).toFixed(1),
              },
            },
          ]
        : props.mode === 'precipitations'
          ? [
              {
                min: 0,
                title: {
                  text: 'mm',
                },
                labels: {
                  formatter: (value: number) => Number(value).toFixed(1),
                },
              },
            ]
          : [
              {
                min: 0,
                title: {
                  text: 'mm',
                },
                labels: {
                  formatter: (value: number) => Number(value).toFixed(1),
                },
              },
              {
                min: 0,
                opposite: true,
                title: {
                  text: 'mm acumulado',
                },
                labels: {
                  formatter: (value: number) => Number(value).toFixed(1),
                },
              },
            ],
    annotations: {
      xaxis: observedEndXAnnotation.value,
    },
    tooltip: {
      enabled: true,
      shared: true,
      intersect: false,
      followCursor: true,
      // hide the small x-axis tooltip and auxiliary fixed tooltip
      x: { show: false },
      fixed: { enabled: false },
      onDatasetHover: { highlightDataSeries: false },
      custom: ({
        dataPointIndex,
        w,
      }: {
        dataPointIndex: number
        w: { config?: { series?: SeriesItem[] }; globals?: { colors?: string[] } }
      }) => {
        const cfgSeries = (w.config?.series ?? []) as SeriesItem[]
        // Try to get formatted date from any series' x value (handles hidden/disabled series)
        let dateFormatted = ''
        for (let si = 0; si < cfgSeries.length; si++) {
          const pt = cfgSeries[si]?.data?.[dataPointIndex]
          // pt can be a number or an object like Point/RangePoint — guard before accessing `x`
          if (pt && typeof pt === 'object' && 'x' in pt) {
            const candidate = (pt as { x?: unknown }).x
            if (candidate !== undefined && candidate !== null) {
              dateFormatted = String(candidate)
              break
            }
          }
        }
        // Fallback: build from allDates if no x found
        if (!dateFormatted) {
          const rawDate = allDates.value?.[dataPointIndex]
          dateFormatted = rawDate ? dateFormattedWithHours(new Date(rawDate).getTime()) : ''
        }

        let rows = ''
        cfgSeries.forEach((s: SeriesItem, idx: number) => {
          const point = s.data?.[dataPointIndex] as Point | RangePoint | number | null
          if (point === null || point === undefined) return
          let raw: number | [number | null, number | null] | null
          if (typeof point === 'object' && 'y' in point) raw = (point as Point | RangePoint).y
          else raw = point
          if (raw === null || raw === undefined) return

          const name = s.name ?? `Serie ${idx + 1}`
          const color = w.globals?.colors?.[idx] ?? '#ccc'
          const dot = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};margin-right:8px;"></span>`

          if (Array.isArray(raw) && raw.length === 2) {
            const a = Number(raw[0])
            const b = Number(raw[1])
            if (Number.isFinite(a) && Number.isFinite(b)) {
              rows += `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee;">
                  <span style="display:flex;align-items:center;">${dot}${name}</span>
                  <strong style="margin-left:16px;">${Math.min(a, b).toFixed(2)} - ${Math.max(a, b).toFixed(2)} mm</strong>
                </div>`
            }
          } else {
            const val = Number(raw)
            if (Number.isFinite(val)) {
              rows += `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee;">
                  <span style="display:flex;align-items:center;">${dot}${name}</span>
                  <strong style="margin-left:16px;">${val.toFixed(2)} mm</strong>
                </div>`
            }
          }
        })

        return `
          <div style="min-width:280px;border-radius:10px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.15);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;pointer-events:none;">
            <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;padding:10px 14px;font-weight:600;">
              ${dateFormatted}
            </div>
            <div style="background:#fff;color:#333;padding:8px 14px;">
              ${rows || '<div style="padding:4px 0;color:#999;">Sin datos</div>'}
            </div>
          </div>`
      },
    },
  }))
</script>

<style>
  .chart-loading-state {
    display: flex;
    align-items: stretch;
    justify-content: stretch;
  }

  .chart-empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(0, 0, 0, 0.6);
    font-size: 0.875rem;
  }

  /* Oculta el pequeño tooltip nativo del eje X que aparece bajo el gráfico */
  .apexcharts-xaxistooltip {
    display: none !important;
  }

  .precipitations-chart .apexcharts-legend {
    display: flex !important;
    flex-wrap: wrap !important;
    gap: 8px 12px;
    align-items: center;
    justify-content: center;
    overflow-x: hidden !important;
    overflow-y: hidden !important;
    white-space: normal;
  }

  .precipitations-chart .apexcharts-legend-group {
    display: contents !important;
  }

  .precipitations-chart .apexcharts-legend-series {
    display: flex !important;
    align-items: center;
    margin: 0 !important;
    width: auto !important;
    min-height: 28px;
    min-width: max-content;
  }

  .precipitations-chart .apexcharts-legend-series.legend-series--nonaccum {
    order: 1;
  }

  .precipitations-chart .apexcharts-legend-series.legend-series--accum {
    order: 2;
  }

  .precipitations-chart .apexcharts-legend-series.legend-series--accum-break {
    flex-basis: 100%;
    margin-left: 0 !important;
  }

  .precipitations-chart .apexcharts-legend-text {
    white-space: nowrap !important;
    line-height: 1.2;
  }

  .precipitations-chart .apexcharts-tooltip {
    pointer-events: none !important;
  }

  .precipitations-chart .apexcharts-tooltip * {
    pointer-events: none !important;
  }
</style>
