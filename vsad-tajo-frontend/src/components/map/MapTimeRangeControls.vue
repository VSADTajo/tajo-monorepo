<template>
  <div class="time-controls">
    <v-card elevation="8" class="pa-4 bg-primary opacity-90 time-card">
      <div class="d-flex align-center justify-space-between mb-2 time-summary">
        <div class="time-block time-block-start">
          <div class="time-main">{{ formattedStartDate }}</div>
          <div class="time-sub">{{ formattedStartHour }}</div>
        </div>

        <div class="time-block time-block-end text-right">
          <div class="time-main">{{ formattedEndDate }}</div>
          <div class="time-sub">{{ formattedEndHour }}</div>
        </div>
      </div>

      <div class="d-flex align-center ga-2">
        <v-btn
          icon
          size="small"
          title="From -1h"
          :disabled="isFromBackDisabled"
          @click="stepFromBack"
        >
          <v-icon>mdi-skip-previous</v-icon>
        </v-btn>

        <v-btn
          icon
          size="small"
          title="From +1h"
          :disabled="isFromForwardDisabled"
          @click="stepFromForward"
        >
          <v-icon>mdi-skip-next</v-icon>
        </v-btn>

        <v-range-slider
          v-model="timeRange"
          :max="timeline.length - 1"
          :step="1"
          hide-details
          density="compact"
          color="white"
          track-color="green"
          thumb-color="white"
          class="timeline-slider mr-5 ml-5"
          @end="onSliderEnd"
        />

        <v-btn icon size="small" title="To -1h" :disabled="isToBackDisabled" @click="stepToBack">
          <v-icon>mdi-skip-previous</v-icon>
        </v-btn>

        <v-btn
          icon
          size="small"
          title="To +1h"
          :disabled="isToForwardDisabled"
          @click="stepToForward"
        >
          <v-icon>mdi-skip-next</v-icon>
        </v-btn>
      </div>

      <div class="d-flex justify-space-between timeline-range mt-1">
        <span>{{ startLabel }}</span>
        <span>{{ endLabel }}</span>
      </div>
    </v-card>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { addHours } from 'date-fns'
  import { useLayersStore } from '@/stores/layersStore'
  import { dynamicLayersConfig } from '@/config/layers.config'
  import {
    dateFormattedFromDate,
    dateFormattedWithHoursAndMinutesFromDate,
    HourFormattedFromDate,
  } from '@/utils/dates'

  const layersStore = useLayersStore()

  const rangeLayerIds = new Set(
    dynamicLayersConfig
      .filter((config) => config.temporalControlMode === 'range')
      .map((config) => config.id)
  )

  const timeRange = ref<[number, number]>([0, 0])
  let timeRangeInitialized = false

  function toIsoWithoutMilliseconds(value: Date): string {
    return value.toISOString().replace(/\.\d{3}Z$/, 'Z')
  }

  const temporalRangeLayers = computed(() =>
    Object.values(layersStore.layers).filter(
      (layer) => layer.visible && layer.temporal && rangeLayerIds.has(layer.id)
    )
  )

  const timeline = computed(() => {
    const firstLayer = temporalRangeLayers.value[0]

    if (!firstLayer?.temporal) return []

    const { start, end, stepHours } = firstLayer.temporal
    const times: Date[] = []

    let current = new Date(start)
    const endDate = new Date(end)

    while (current <= endDate) {
      times.push(new Date(current))
      current = addHours(current, stepHours)
    }

    return times
  })

  const currentStartTime = computed(() => timeline.value[timeRange.value[0]])
  const currentEndTime = computed(() => timeline.value[timeRange.value[1]])

  const formattedStartDate = computed(() => {
    const t = currentStartTime.value
    if (!t) return ''
    return dateFormattedFromDate(t)
  })

  const formattedEndDate = computed(() => {
    const t = currentEndTime.value
    if (!t) return ''
    return dateFormattedFromDate(t)
  })

  const formattedStartHour = computed(() => {
    const t = currentStartTime.value
    if (!t) return ''
    return HourFormattedFromDate(t)
  })

  const formattedEndHour = computed(() => {
    const t = currentEndTime.value
    if (!t) return ''
    return HourFormattedFromDate(t)
  })

  const startLabel = computed(() => {
    if (!timeline.value.length) return ''
    return dateFormattedWithHoursAndMinutesFromDate(timeline.value[0])
  })

  const endLabel = computed(() => {
    if (!timeline.value.length) return ''
    return dateFormattedWithHoursAndMinutesFromDate(timeline.value[timeline.value.length - 1])
  })

  const isFromBackDisabled = computed(() => !timeline.value.length || timeRange.value[0] <= 0)
  const isFromForwardDisabled = computed(
    () => !timeline.value.length || timeRange.value[0] >= timeRange.value[1]
  )
  const isToBackDisabled = computed(
    () => !timeline.value.length || timeRange.value[1] <= timeRange.value[0]
  )
  const isToForwardDisabled = computed(
    () => !timeline.value.length || timeRange.value[1] >= timeline.value.length - 1
  )

  function syncTimeRangeToStore() {
    const [startIndex, endIndex] = timeRange.value
    const startTime = timeline.value[startIndex]
    const endTime = timeline.value[endIndex]

    if (!startTime || !endTime) return

    const from = toIsoWithoutMilliseconds(startTime)
    const to = toIsoWithoutMilliseconds(endTime)

    temporalRangeLayers.value.forEach((layer) => {
      if (layer.params?.from === from && layer.params?.to === to) {
        return
      }

      layersStore.setTimeParams(layer.id, {
        from,
        to,
      })
    })
  }

  function onSliderEnd() {
    syncTimeRangeToStore()
  }

  watch(
    timeline,
    (currentTimeline) => {
      if (!currentTimeline.length) {
        timeRange.value = [0, 0]
        timeRangeInitialized = false
        return
      }

      const maxIndex = currentTimeline.length - 1

      if (!timeRangeInitialized) {
        timeRange.value = [0, maxIndex]
        timeRangeInitialized = true
        return
      }

      const start = Math.max(0, Math.min(timeRange.value[0], maxIndex))
      const end = Math.max(start, Math.min(timeRange.value[1], maxIndex))

      if (start !== timeRange.value[0] || end !== timeRange.value[1]) {
        timeRange.value = [start, end]
      }
    },
    { immediate: true }
  )

  watch(
    () =>
      temporalRangeLayers.value.map((l) => ({
        from: l.params?.from,
        to: l.params?.to,
      })),
    (ranges) => {
      const value = ranges.find(
        (v): v is { from: string; to: string } =>
          typeof v.from === 'string' &&
          typeof v.to === 'string' &&
          v.from.length > 0 &&
          v.to.length > 0
      )
      if (!value) return

      const startIso = value.from
      const endIso = value.to

      const startMs = new Date(startIso).getTime()
      const endMs = new Date(endIso).getTime()

      const startIndex = timeline.value.findIndex((t) => t.getTime() === startMs)
      const endIndex = timeline.value.findIndex((t) => t.getTime() === endMs)

      if (startIndex === -1 || endIndex === -1) return

      if (timeRange.value[0] !== startIndex || timeRange.value[1] !== endIndex) {
        timeRange.value = [startIndex, endIndex]
      }
    },
    { immediate: true }
  )

  function stepFromBack() {
    if (!timeline.value.length) return

    const [startIndex, endIndex] = timeRange.value
    if (startIndex <= 0) return

    timeRange.value = [startIndex - 1, endIndex]
    syncTimeRangeToStore()
  }

  function stepFromForward() {
    if (!timeline.value.length) return

    const [startIndex, endIndex] = timeRange.value
    if (startIndex >= endIndex) return

    timeRange.value = [startIndex + 1, endIndex]
    syncTimeRangeToStore()
  }

  function stepToForward() {
    if (!timeline.value.length) return

    const [startIndex, endIndex] = timeRange.value
    if (endIndex >= timeline.value.length - 1) return

    timeRange.value = [startIndex, endIndex + 1]
    syncTimeRangeToStore()
  }

  function stepToBack() {
    if (!timeline.value.length) return

    const [startIndex, endIndex] = timeRange.value
    if (endIndex <= startIndex) return

    timeRange.value = [startIndex, endIndex - 1]
    syncTimeRangeToStore()
  }
</script>

<style scoped>
  .time-controls {
    position: absolute;
    bottom: 25px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1000;
    width: 720px;
  }

  .time-card {
    backdrop-filter: blur(10px);
    border-radius: 14px;
  }

  .time-main {
    font-size: 18px;
    font-weight: 600;
    color: white;
  }

  .time-block {
    display: flex;
    flex-direction: row;
    align-items: baseline;
    gap: 8px;
    min-width: 0;
  }

  .time-block-end {
    align-items: flex-end;
  }

  .time-summary {
    gap: 12px;
  }

  .time-sub {
    font-size: 14px;
    color: #ccc;
  }

  .timeline-slider {
    flex-grow: 1;
    margin-left: 8px;
    margin-right: 8px;
  }

  .timeline-range {
    font-size: 11px;
    color: #aaa;
  }
</style>
