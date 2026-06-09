<template>
  <div ref="chartDiv" style="width: 100%; height: 550px"></div>
</template>

<script setup lang="ts">
  import { computed, onMounted, onBeforeUnmount, ref, watch, nextTick } from 'vue'
  import * as am5 from '@amcharts/amcharts5'
  import * as am5xy from '@amcharts/amcharts5/xy'
  import am5themes_Animated from '@amcharts/amcharts5/themes/Animated'

  import type { ForecastNAM, TimeseriePoint } from '@/types/Forecast'
  import type { TelemetryRecord } from '@/types/Precipitation'
  import { buildForecastSeries } from '@/utils/forecastCharts'

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

  type NormalizedPoint = {
    x: number
    y: number | [number, number]
  }

  const chartDiv = ref<HTMLElement | null>(null)
  let root: am5.Root | null = null

  const builtSeries = computed<BuiltSeries[]>(() => {
    return buildForecastSeries({
      forecastDet: props.forecastDet,
      forecastEns: props.forecastEns,
      observed: props.observed,
      chartType: props.chartType,
      percentileKeys: props.percentileKeys,
      labels: props.labels,
    }) as BuiltSeries[]
  })

  function toTimestamp(value: string | number | Date): number | null {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null
    if (value instanceof Date) {
      const time = value.getTime()
      return Number.isFinite(time) ? time : null
    }
    if (typeof value === 'string') {
      const time = new Date(value).getTime()
      return Number.isFinite(time) ? time : null
    }
    return null
  }

  const normalizedSeries = computed(() => {
    return builtSeries.value.map((serie, index) => {
      const key = `series_${index}`

      const data = serie.data
        .map((point): NormalizedPoint | null => {
          const x = toTimestamp(point.x)
          if (x === null) return null

          if (Array.isArray(point.y)) {
            const low = Number(point.y[0])
            const high = Number(point.y[1])
            if (!Number.isFinite(low) || !Number.isFinite(high)) return null

            return { x, y: [low, high] }
          }

          const y = Number(point.y)
          if (!Number.isFinite(y)) return null

          return { x, y }
        })
        .filter((p): p is NormalizedPoint => p !== null)

      return {
        name: serie.name,
        key,
        data,
        isRange: Array.isArray(data[0]?.y),
      }
    })
  })

  const mergedChartData = computed(() => {
    const map = new Map<number, Record<string, number>>()

    normalizedSeries.value.forEach((serie) => {
      serie.data.forEach((point) => {
        if (!map.has(point.x)) {
          map.set(point.x, { date: point.x })
        }

        const item = map.get(point.x)!
        if (Array.isArray(point.y)) {
          item[`${serie.key}_low`] = point.y[0]
          item[`${serie.key}_high`] = point.y[1]
        } else {
          item[serie.key] = point.y
        }
      })
    })

    return Array.from(map.values()).sort((a, b) => a.date - b.date)
  })

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

  function disposeChart() {
    if (root) {
      root.dispose()
      root = null
    }
  }

  function createChart() {
    if (!chartDiv.value) return

    const data = mergedChartData.value
    if (!data.length) {
      return
    }

    disposeChart()

    root = am5.Root.new(chartDiv.value)
    root.setThemes([am5themes_Animated.new(root)])

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: true,
        panY: false,
        wheelX: 'panX',
        wheelY: 'zoomX',
        pinchZoomX: true,
        layout: root.verticalLayout,
      })
    )

    const xRenderer = am5xy.AxisRendererX.new(root, {
      minGridDistance: 70,
    })

    const xAxis = chart.xAxes.push(
      am5xy.DateAxis.new(root, {
        maxDeviation: 0.2,
        baseInterval: { timeUnit: 'hour', count: 1 },
        renderer: xRenderer,
        tooltip: am5.Tooltip.new(root, {}),
      })
    )

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererY.new(root, {}),
        numberFormat: '#,###.0',
      })
    )

    yAxis.children.unshift(
      am5.Label.new(root, {
        text: props.unit,
        rotation: -90,
        centerX: am5.p50,
        centerY: am5.p50,
        y: am5.p50,
      })
    )

    const legend = chart.children.push(
      am5.Legend.new(root, {
        x: am5.p50,
        centerX: am5.p50,
      })
    )

    const legendItems: am5.Series[] = []

    normalizedSeries.value.forEach((serie, index) => {
      if (!serie.data.length) return

      const color = am5.color(getColor(index))
      const strokeWidth = getStrokeWidth(index)
      const opacity = getOpacity(index)

      if (serie.isRange) {
        const rangeSeries = chart.series.push(
          am5xy.LineSeries.new(root!, {
            name: serie.name,
            xAxis,
            yAxis,
            valueXField: 'date',
            valueYField: `${serie.key}_high`,
            openValueYField: `${serie.key}_low`,
            stroke: color,
            fill: color,
            connect: false,
            tooltip: am5.Tooltip.new(root!, {
              labelText: `[bold]{name}[/]\n{openValueY} - {valueY} ${props.unit}`,
            }),
          })
        )

        rangeSeries.strokes.template.setAll({
          strokeOpacity: 0,
        })

        rangeSeries.fills.template.setAll({
          visible: true,
          fillOpacity: opacity,
        })

        rangeSeries.data.setAll(data)
        legendItems.push(rangeSeries)
      } else {
        const lineSeries = chart.series.push(
          am5xy.LineSeries.new(root!, {
            name: serie.name,
            xAxis,
            yAxis,
            valueXField: 'date',
            valueYField: serie.key,
            stroke: color,
            fill: color,
            connect: false,
            tooltip: am5.Tooltip.new(root!, {
              labelText: `[bold]{name}[/]\n{valueX.formatDate('dd/MM/yyyy HH:mm')}\n{valueY.formatNumber('#,###.0')} ${props.unit}`,
            }),
          })
        )

        lineSeries.strokes.template.setAll({
          strokeWidth,
        })

        lineSeries.data.setAll(data)

        lineSeries.bullets.push(() =>
          am5.Bullet.new(root!, {
            sprite: am5.Circle.new(root!, {
              radius: 3,
              fill: color,
            }),
          })
        )

        legendItems.push(lineSeries)
      }
    })

    legend.data.setAll(legendItems)

    chart.set(
      'cursor',
      am5xy.XYCursor.new(root, {
        behavior: 'zoomX',
        xAxis,
      })
    )

    const scrollbarX = am5xy.XYChartScrollbar.new(root, {
      orientation: 'horizontal',
      height: 50,
    })

    chart.set('scrollbarX', scrollbarX)

    xAxis.data.setAll(data)

    chart.appear(1000, 100)
  }

  onMounted(async () => {
    await nextTick()
    createChart()
  })

  onBeforeUnmount(() => {
    disposeChart()
  })

  watch(
    () => [
      props.forecastDet,
      props.forecastEns,
      props.observed,
      props.unit,
      props.chartType,
      props.percentileKeys,
      props.labels,
      props.extraOptions,
    ],
    async () => {
      await nextTick()
      createChart()
    },
    { deep: true }
  )
</script>
