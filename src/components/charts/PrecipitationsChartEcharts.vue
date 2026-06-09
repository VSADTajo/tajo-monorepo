<template>
  <div>
    <div v-if="hasRenderableSeries" ref="chartContainer" class="chart-container" />
    <div v-else class="chart-empty-state" style="height: 350px">Sin datos para mostrar</div>
  </div>
</template>

<script setup lang="ts">
  import { computed, watch, onMounted, ref, nextTick } from 'vue'
  import * as echarts from 'echarts'
  import type { ECharts, EChartsOption } from 'echarts'
  import type { DataStationPrediction } from '@/types/Predictions'
  import { dateFormattedWithHours } from '@/utils/dates'

  const props = defineProps<{
    data: DataStationPrediction
  }>()

  const chartContainer = ref<HTMLDivElement>()
  let echartsInstance: ECharts | null = null

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

  const historicalData = computed(() => normalizePredictionResults(props.data.historical))
  const HarmonieData = computed(() => normalizePredictionResults(props.data.forecastHarmonie))
  const epsatData = computed(() => normalizePredictionResults(props.data.forecastEpsat))
  const p10Data = computed(() => normalizePredictionResults(props.data.forecastEnsP10))
  const p75Data = computed(() => normalizePredictionResults(props.data.forecastEnsP75))
  const p25Data = computed(() => normalizePredictionResults(props.data.forecastEnsP25))
  const p90Data = computed(() => normalizePredictionResults(props.data.forecastEnsP90))

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

  const xLabels = computed(() =>
    allDates.value.map((date) => dateFormattedWithHours(new Date(date).getTime()))
  )

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

  interface SeriesConfig {
    name: string
    type: 'line' | 'bar' | 'scatter'
    data: (number | null)[]
    color?: string
    fillColor?: string
    opacity?: number
    lineWidth?: number
    areaOpacity?: number
  }

  interface RangeSeriesConfig {
    name: string
    type: 'custom'
    data: Array<[number | null, number | null] | null>
    color?: string
    opacity?: number
  }

  const series = computed<(SeriesConfig | RangeSeriesConfig)[]>(() => {
    const result: (SeriesConfig | RangeSeriesConfig)[] = []

    // Observado
    if (historicalData.value) {
      const historicalMap = new Map(historicalData.value.map((d) => [d.date, d.value]))
      const values = allDates.value.map((date) => historicalMap.get(date) ?? null)
      if (hasFiniteValue(values)) {
        result.push({
          name: 'Observado',
          type: 'line',
          data: values,
          color: '#2E7D32',
          lineWidth: 2,
        })
      }
    }

    // P10-P90 RangeArea
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
          type: 'custom',
          data: ranges,
          color: '#D3D3D3',
          opacity: 0.35,
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
          type: 'custom',
          data: ranges,
          color: '#696969',
          opacity: 0.35,
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
          data: values,
          color: '#1565C0',
          opacity: 1,
        })
      }
    }

    // EPS
    if (epsatData.value) {
      const epsatMap = new Map(epsatData.value.map((d) => [d.date, d.value]))
      const values = allDates.value.map((date) => epsatMap.get(date) ?? null)
      if (hasFiniteValue(values)) {
        result.push({
          name: 'Predicción Det. EPS',
          type: 'bar',
          data: values,
          color: '#FF9800',
          opacity: 1,
        })
      }
    }

    return result
  })

  const hasRenderableSeries = computed(() => series.value.length > 0)

  const chartOptions = computed<EChartsOption>(() => {
    const echartsSeriesConfig: EChartsOption['series'] = []

    series.value.forEach((s) => {
      if (s.type === 'custom') {
        // Range areas (percentiles) using candlestick
        const rangeData = (s as RangeSeriesConfig).data
          .map((range) => {
            if (!range) return null
            const [low, high] = range
            return [low, high, low, high]
          })
          .filter((r) => r !== null) as Array<[number, number, number, number]>

        echartsSeriesConfig.push({
          name: s.name,
          type: 'candlestick',
          data: rangeData,
          itemStyle: {
            color: s.color,
            borderColor: s.color,
            opacity: s.opacity || 0.35,
          },
        })
      } else if (s.type === 'line' || s.type === 'bar') {
        echartsSeriesConfig.push({
          name: s.name,
          type: s.type,
          data: s.data,
          itemStyle: {
            color: s.color,
            opacity: s.opacity || 1,
          },
          lineStyle: {
            color: s.color,
            width: (s as SeriesConfig).lineWidth || 2,
          },
          areaStyle: s.type === 'line' ? { opacity: 0 } : undefined,
          symbol: 'none',
          smooth: s.type === 'line',
        })
      }
    })

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
          lineStyle: {
            color: '#888',
            width: 1,
            type: 'dashed',
          },
        },
        formatter: (params) => {
          if (!Array.isArray(params)) return ''

          const param = params[0] as unknown as Record<string, unknown>
          if (!param) return ''

          const dateIndex = param.dataIndex as number
          const dateFormatted = xLabels.value[dateIndex] || ''

          let rows = ''
          params.forEach((p) => {
            const p_typed = p as unknown as Record<string, unknown>
            if (!p_typed.value || p_typed.value === '-') return

            const name = p_typed.seriesName
            const color = p_typed.color || '#ccc'
            const dot = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};margin-right:8px;"></span>`
            const value = Number(p_typed.value)

            if (Number.isFinite(value)) {
              rows += `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee;">
                  <span style="display:flex;align-items:center;">${dot}${name}</span>
                  <strong style="margin-left:16px;">${value.toFixed(2)} mm</strong>
                </div>`
            }
          })

          return `
            <div style="min-width:280px;border-radius:10px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.15);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;">
              <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;padding:10px 14px;font-weight:600;">
                ${dateFormatted}
              </div>
              <div style="background:#fff;color:#333;padding:8px 14px;">
                ${rows || '<div style="padding:4px 0;color:#999;">Sin datos</div>'}
              </div>
            </div>`
        },
      },
      legend: {
        bottom: 0,
        textStyle: {
          fontSize: 12,
        },
      },
      grid: {
        left: '60px',
        right: '20px',
        top: '20px',
        bottom: '60px',
        containLabel: false,
      },
      xAxis: {
        type: 'category',
        data: xLabels.value,
        boundaryGap: true,
      },
      yAxis: {
        type: 'value',
        min: 0,
        name: 'mm',
        nameLocation: 'end',
        nameTextStyle: {
          fontSize: 12,
        },
      },
      series: echartsSeriesConfig,
      animation: true,
      animationDuration: 300,
    }
  })

  function initChart() {
    if (!chartContainer.value) return

    if (!echartsInstance) {
      echartsInstance = echarts.init(chartContainer.value)
      window.addEventListener('resize', () => echartsInstance?.resize())
    }

    if (hasRenderableSeries.value) {
      echartsInstance.setOption(chartOptions.value)
    }
  }

  onMounted(() => {
    nextTick(() => {
      initChart()
    })
  })

  watch(
    () => chartOptions.value,
    () => {
      initChart()
    }
  )
</script>

<style scoped>
  .chart-container {
    width: 100%;
    height: 350px;
  }

  .chart-empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(0, 0, 0, 0.6);
    font-size: 0.875rem;
  }
</style>
