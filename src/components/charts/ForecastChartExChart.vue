<template>
  <VChart :option="chartOption" autoresize style="width: 100%; height: 550px" />
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import VChart from 'vue-echarts'
  import { use } from 'echarts/core'
  import { CanvasRenderer } from 'echarts/renderers'
  import { LineChart, BarChart, CustomChart } from 'echarts/charts'
  import {
    GridComponent,
    TooltipComponent,
    LegendComponent,
    DataZoomComponent,
    ToolboxComponent,
  } from 'echarts/components'

  import type { EChartsOption, SeriesOption } from 'echarts'
  import type { ForecastNAM, TimeseriePoint } from '@/types/Forecast'
  import type { TelemetryRecord } from '@/types/Precipitation'
  import { buildForecastSeries } from '@/utils/forecastCharts'
  import { dateFormattedWithHours, dateFormattedWithHoursAndMinutes } from '@/utils/dates'

  use([
    CanvasRenderer,
    LineChart,
    BarChart,
    CustomChart,
    GridComponent,
    TooltipComponent,
    LegendComponent,
    DataZoomComponent,
    ToolboxComponent,
  ])

  const props = defineProps<{
    forecastDet: ForecastNAM
    forecastEns: ForecastNAM
    observed?: TelemetryRecord[]
    unit: string
    chartType: 'line' | 'bar'
    percentileKeys: {
      median: string
      p90: string
      p75: string
      p25: string
      p10: string
    }
    labels: {
      observed: string
      p1090: string
      p2575: string
      eps: string
      harmonie: string
    }
    extraOptions?: {
      colors?: string[]
      fill?: {
        opacity?: number[]
      }
      stroke?: {
        width?: number[]
      }
    }
  }>()

  type BuiltSeries = {
    name: string
    data: TimeseriePoint[]
  }

  const builtSeries = computed<BuiltSeries[]>(
    () =>
      buildForecastSeries({
        forecastDet: props.forecastDet,
        forecastEns: props.forecastEns,
        observed: props.observed,
        chartType: props.chartType,
        percentileKeys: props.percentileKeys,
        labels: props.labels,
      }) as BuiltSeries[]
  )

  function toTimestamp(value: string | number | Date): number | null {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null
    if (value instanceof Date) {
      const t = value.getTime()
      return Number.isFinite(t) ? t : null
    }
    if (typeof value === 'string') {
      const t = new Date(value).getTime()
      return Number.isFinite(t) ? t : null
    }
    return null
  }

  function getColor(index: number) {
    const fallback = ['#90CAF9', '#42A5F5', '#1565C0', '#25733a']
    return props.extraOptions?.colors?.[index] ?? fallback[index] ?? '#000000'
  }

  function getStrokeWidth(index: number) {
    return props.extraOptions?.stroke?.width?.[index] ?? 2
  }

  function getOpacity(index: number) {
    return props.extraOptions?.fill?.opacity?.[index] ?? 1
  }

  const normalizedSeries = computed(() => {
    return builtSeries.value.map((serie, index) => ({
      key: `series_${index}`,
      name: serie.name,
      color: getColor(index),
      strokeWidth: getStrokeWidth(index),
      opacity: getOpacity(index),
      data: serie.data
        .map((point) => {
          const x = toTimestamp(point.x)
          if (x === null) return null

          if (Array.isArray(point.y)) {
            const low = Number(point.y[0])
            const high = Number(point.y[1])
            if (!Number.isFinite(low) || !Number.isFinite(high)) return null
            return { x, y: [low, high] as [number, number] }
          }

          const y = Number(point.y)
          if (!Number.isFinite(y)) return null
          return { x, y }
        })
        .filter(Boolean),
    }))
  })

  const chartSeries = computed<SeriesOption[]>(() => {
    const result: SeriesOption[] = []

    normalizedSeries.value.forEach((serie) => {
      const first = serie.data[0]
      if (!first) return

      if (Array.isArray(first.y)) {
        const rangeData = serie.data.filter(
          (p): p is { x: number; y: [number, number] } => p !== null && Array.isArray(p.y)
        )

        const lowData = rangeData.map((p) => [p.x, p.y[0]] as [number, number])
        const bandData = rangeData.map((p) => [p.x, p.y[1] - p.y[0]] as [number, number])

        result.push({
          name: `${serie.name}__base`,
          type: 'line',
          stack: serie.key,
          symbol: 'none',
          lineStyle: { opacity: 0 },
          areaStyle: { opacity: 0 },
          emphasis: { disabled: true },
          tooltip: { show: false },
          data: lowData,
        })

        result.push({
          name: serie.name,
          type: 'line',
          stack: serie.key,
          symbol: 'none',
          lineStyle: { opacity: 0 },
          areaStyle: {
            opacity: serie.opacity,
            color: serie.color,
          },
          data: bandData.map(([_x, y], i) => ({
            value: [lowData[i][0], y],
            rangeStart: lowData[i][1],
            rangeEnd: lowData[i][1] + y,
          })),
        })
      } else {
        const lineData = serie.data.filter(
          (p): p is { x: number; y: number } => p !== null && !Array.isArray(p.y)
        )

        result.push({
          name: serie.name,
          type: props.chartType === 'bar' ? 'bar' : 'line',
          smooth: props.chartType === 'line',
          symbol: props.chartType === 'line' ? 'circle' : 'none',
          symbolSize: 6,
          lineStyle: {
            width: serie.strokeWidth,
            color: serie.color,
          },
          itemStyle: {
            color: serie.color,
          },
          data: lineData.map((p) => [p.x, p.y] as [number, number]),
        })
      }
    })

    return result
  })

  const chartOption = computed<EChartsOption>(() => ({
    color: normalizedSeries.value.map((s) => s.color),
    animation: true,
    grid: {
      left: 60,
      right: 30,
      top: 60,
      bottom: 90,
    },
    legend: {
      top: 10,
    },
    toolbox: {
      feature: {
        dataZoom: {},
        restore: {},
        saveAsImage: {},
      },
    },
    tooltip: {
      trigger: 'axis',
      confine: true,
      formatter(params: any) {
        if (!params?.length) return ''

        const axisValue = params[0].axisValue
        const date = dateFormattedWithHoursAndMinutes(Number(axisValue))

        let html = `
        <div style="font-size:12px;min-width:180px">
          <div style="background:#f2f2f2;padding:6px 8px;font-weight:600;border-bottom:1px solid #ddd">
            ${date}
          </div>
      `

        for (const item of params) {
          if (item.seriesName?.endsWith('__base')) continue

          let text = ''

          if (item.data && typeof item.data === 'object' && 'rangeStart' in item.data) {
            text = `${Number(item.data.rangeStart).toFixed(1)} - ${Number(item.data.rangeEnd).toFixed(1)} ${props.unit}`
          } else {
            const value = Array.isArray(item.value) ? item.value[1] : item.value
            text = `${Number(value).toFixed(1)} ${props.unit}`
          }

          html += `
          <div style="display:flex;justify-content:space-between;padding:4px 8px;gap:12px">
            <span>${item.seriesName}</span>
            <span style="font-weight:600">${text}</span>
          </div>
        `
        }

        html += `</div>`
        return html
      },
    },
    xAxis: {
      type: 'time',
      axisLabel: {
        formatter(value: number) {
          return dateFormattedWithHours(Number(value))
        },
      },
    },
    yAxis: {
      type: 'value',
      name: props.unit,
      axisLabel: {
        formatter(value: number) {
          return Number(value).toFixed(1)
        },
      },
    },
    dataZoom: [
      {
        type: 'inside',
        xAxisIndex: 0,
      },
      {
        type: 'slider',
        xAxisIndex: 0,
        bottom: 20,
      },
    ],
    series: chartSeries.value,
  }))
</script>
