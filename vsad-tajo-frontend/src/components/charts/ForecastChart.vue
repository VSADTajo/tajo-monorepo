<template>
  <apexchart :type="chartType" height="550" :options="chartOptions" :series="series" />
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import type { ApexOptions } from 'apexcharts'
  import type { ApexTooltipContext, ForecastNAM, TimeseriePoint } from '@/types/Forecast'
  import { buildForecastSeries } from '@/utils/forecastCharts'
  import type { TelemetryRecord } from '@/types/Precipitation'
  import { dateFormattedWithHours, dateFormattedWithHoursAndMinutes } from '@/utils/dates'

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
    extraOptions?: ApexOptions
  }>()

  const series = computed(() =>
    buildForecastSeries({
      forecastDet: props.forecastDet,
      forecastEns: props.forecastEns,
      observed: props.observed,
      chartType: props.chartType,
      percentileKeys: props.percentileKeys,
      labels: props.labels,
    })
  )

  const baseOptions: ApexOptions = {
    chart: {
      zoom: { enabled: true },
      toolbar: { show: true },
    },

    stroke: {
      curve: 'smooth',
    },

    yaxis: [
      {
        title: { text: props.unit },
        decimalsInFloat: 1,
        labels: {
          formatter: (value: number) => value.toFixed(1),
        },
      },
    ],

    tooltip: {
      shared: true,
      intersect: false,
      followCursor: true,

      custom({ seriesIndex, dataPointIndex, w }: ApexTooltipContext) {
        const x = w.globals.seriesX[seriesIndex][dataPointIndex]
        const date = dateFormattedWithHoursAndMinutes(x)

        let html = `
      <div style="font-size:12px;min-width:180px">
      <div style="background:#f2f2f2;padding:6px 8px;font-weight:600;border-bottom:1px solid #ddd">
      ${date}
      </div>
      `

        w.config.series.forEach((s: { name: string; data: TimeseriePoint[] }) => {
          const point = s.data.find((d) => d.x === x)
          if (!point) return

          let text = ''

          if (Array.isArray(point.y)) {
            text = `${point.y[0].toFixed(1)} - ${point.y[1].toFixed(1)} ${props.unit}`
          } else {
            text = `${point.y.toFixed(1)} ${props.unit}`
          }

          html += `
        <div style="display:flex;justify-content:space-between;padding:4px 8px">
        <span>${s.name}</span>
        <span style="font-weight:600">${text}</span>
        </div>
        `
        })

        html += `</div>`
        return html
      },
    },

    xaxis: {
      type: 'datetime',
      tooltip: { enabled: false },
      labels: {
        formatter: (value: string) => {
          return dateFormattedWithHours(Number(value))
        },
      },
    },
  }

  const chartOptions = computed(() => ({
    ...baseOptions,
    ...props.extraOptions,
  }))
</script>
