<template>
  <div class="time-controls">
    <v-card elevation="8" class="pa-4 bg-primary opacity-90 time-card">
      <!-- TOP: TIME DISPLAY -->
      <div class="d-flex align-center justify-space-between mb-2">
        <div class="time-main">
          {{ formattedDate }}
        </div>

        <div class="time-sub">
          {{ formattedHour }}
        </div>
      </div>

      <!-- CONTROLS -->
      <div class="d-flex align-center ga-2">
        <!-- BACK -->
        <v-btn icon size="small" @click="stepBack">
          <v-icon>mdi-skip-previous</v-icon>
        </v-btn>

        <!-- PLAY -->
        <v-btn icon size="small" @click="togglePlay">
          <v-icon>
            {{ playing ? 'mdi-pause' : 'mdi-play' }}
          </v-icon>
        </v-btn>

        <!-- FORWARD -->
        <v-btn icon size="small" @click="stepForward">
          <v-icon>mdi-skip-next</v-icon>
        </v-btn>

        <!-- SLIDER -->
        <v-slider
          v-model="timeIndex"
          :max="timeline.length - 1"
          :step="1"
          hide-details
          density="compact"
          color="white"
          track-color="green"
          thumb-color="white"
          class="timeline-slider mr-5 ml-5"
          @start="onSliderStart"
          @end="onSliderEnd"
        />
      </div>

      <!-- RANGE -->
      <div class="d-flex justify-space-between timeline-range mt-1">
        <span>{{ startLabel }}</span>
        <span>{{ endLabel }}</span>
      </div>
    </v-card>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref, watch, onUnmounted } from 'vue'
  import { addHours } from 'date-fns'
  import { useLayersStore } from '@/stores/layersStore'
  import { dynamicLayersConfig } from '@/config/layers.config'
  import {
    dateFormattedFromDate,
    dateFormattedWithHoursAndMinutesFromDate,
    HourFormattedFromDate,
  } from '@/utils/dates'

  const layersStore = useLayersStore()
  const DEBUG_TIME = true

  function debugLog(message: string, payload?: unknown) {
    if (!DEBUG_TIME) return
    if (payload === undefined) {
      return
    }
  }

  const rangeLayerIds = new Set(
    dynamicLayersConfig
      .filter((config) => config.temporalControlMode === 'range')
      .map((config) => config.id)
  )

  const timeIndex = ref(0)
  const playing = ref(false)
  const isUserSliding = ref(false)
  let timeUpdateTimer: number | null = null
  let playRunId = 0
  const playStepMs = 2000

  // ==============================
  // 🕒 Capas temporales activas
  // ==============================

  const temporalLayers = computed(() =>
    Object.values(layersStore.layers).filter(
      (layer) => layer.visible && layer.temporal && !rangeLayerIds.has(layer.id)
    )
  )

  // ==============================
  // 🕒 Construir timeline
  // ==============================

  const timeline = computed(() => {
    const firstLayer = temporalLayers.value[0]

    if (!firstLayer?.temporal) return []

    const { start, end, stepHours } = firstLayer.temporal

    const times: Date[] = []

    let current = new Date(start)
    const endDate = new Date(end)

    while (current <= endDate) {
      times.push(new Date(current))
      current = addHours(current, stepHours)
    }

    debugLog('Timeline rebuilt', {
      length: times.length,
      stepHours,
      startIso: times[0]?.toISOString(),
      endIso: times[times.length - 1]?.toISOString(),
      startLocal: times[0]?.toString(),
      endLocal: times[times.length - 1]?.toString(),
    })

    return times
  })

  // ==============================
  // 📅 Tiempo actual
  // ==============================

  const currentTime = computed(() => timeline.value[timeIndex.value])

  const formattedDate = computed(() => {
    const t = currentTime.value
    if (!t) return ''
    return dateFormattedFromDate(t)
  })

  const formattedHour = computed(() => {
    const t = currentTime.value
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

  function applyCurrentTime(t: Date | undefined) {
    if (!t) return

    const nextIso = t.toISOString()

    debugLog('applyCurrentTime', {
      index: timeIndex.value,
      local: t.toString(),
      iso: nextIso,
      layerIds: temporalLayers.value.map((layer) => layer.id),
    })

    temporalLayers.value.forEach((layer) => {
      if (layer.params?.time === nextIso) {
        debugLog('skip setTimeParams (already equal)', {
          layerId: layer.id,
          time: layer.params.time,
        })
        return
      }

      layersStore.setTimeParams(layer.id, {
        time: nextIso,
      })
    })
  }

  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms)
    })
  }

  function allTemporalLayersLoadedForTime(targetIso: string): boolean {
    if (!temporalLayers.value.length) {
      return true
    }

    return temporalLayers.value.every(
      (layer) =>
        layer.temporalLoadState?.loadedTime === targetIso &&
        layer.temporalLoadState.loading !== true
    )
  }

  function waitForTemporalLayersLoaded(targetIso: string, runId: number): Promise<void> {
    if (allTemporalLayersLoadedForTime(targetIso)) {
      return Promise.resolve()
    }

    return new Promise((resolve) => {
      const stop = watch(
        () =>
          temporalLayers.value.map(
            (layer) =>
              `${layer.id}:${layer.temporalLoadState?.loadedTime ?? ''}:${layer.temporalLoadState?.loading ? '1' : '0'}`
          ),
        () => {
          if (runId !== playRunId) {
            stop()
            resolve()
            return
          }

          if (allTemporalLayersLoadedForTime(targetIso)) {
            stop()
            resolve()
          }
        },
        { immediate: true }
      )
    })
  }

  watch(currentTime, (t) => {
    debugLog('watch currentTime', {
      index: timeIndex.value,
      local: t?.toString(),
      iso: t?.toISOString(),
      playing: playing.value,
    })

    if (playing.value) {
      if (timeUpdateTimer) {
        clearTimeout(timeUpdateTimer)
        timeUpdateTimer = null
      }

      applyCurrentTime(t)
      return
    }

    if (timeUpdateTimer) {
      clearTimeout(timeUpdateTimer)
      timeUpdateTimer = null
    }

    timeUpdateTimer = window.setTimeout(() => {
      applyCurrentTime(t)
      timeUpdateTimer = null
    }, 250)
  })

  watch(
    timeline,
    (value) => {
      if (!value.length) return
      if (timeIndex.value > value.length - 1) {
        debugLog('clamp timeIndex after timeline rebuild', {
          previousIndex: timeIndex.value,
          nextIndex: value.length - 1,
        })
        timeIndex.value = value.length - 1
      }
    },
    { immediate: true }
  )

  function onSliderStart() {
    isUserSliding.value = true
    debugLog('slider start', {
      index: timeIndex.value,
      playing: playing.value,
    })

    if (playing.value) {
      stopPlay()
      debugLog('stopPlay because user started dragging slider')
    }
  }

  function onSliderEnd() {
    isUserSliding.value = false
    debugLog('slider end', {
      index: timeIndex.value,
      local: currentTime.value?.toString(),
      iso: currentTime.value?.toISOString(),
    })
  }

  async function runPlayLoop(runId: number) {
    while (playing.value && runId === playRunId) {
      if (!timeline.value.length) {
        break
      }

      const nextIndex = timeIndex.value >= timeline.value.length - 1 ? 0 : timeIndex.value + 1
      const stepStartedAt = Date.now()

      debugLog('runPlayLoop step', {
        runId,
        currentIndex: timeIndex.value,
        nextIndex,
      })

      timeIndex.value = nextIndex

      const targetTime = timeline.value[nextIndex]
      if (targetTime) {
        await waitForTemporalLayersLoaded(targetTime.toISOString(), runId)
      }

      if (!playing.value || runId !== playRunId) {
        break
      }

      const elapsed = Date.now() - stepStartedAt
      const remainingDelay = Math.max(0, playStepMs - elapsed)

      if (remainingDelay > 0) {
        await sleep(remainingDelay)
      }
    }

    if (runId === playRunId) {
      playing.value = false
    }
  }

  function stopPlay() {
    playing.value = false
    playRunId += 1

    if (timeUpdateTimer) {
      clearTimeout(timeUpdateTimer)
      timeUpdateTimer = null
    }
  }

  // ==============================
  // ⏯ Play
  // ==============================

  function togglePlay() {
    if (playing.value) {
      stopPlay()
      return
    }

    playing.value = true
    const runId = ++playRunId
    void runPlayLoop(runId)
  }

  onUnmounted(() => {
    stopPlay()
  })

  function stepForward() {
    if (timeIndex.value < timeline.value.length - 1) timeIndex.value++
  }

  function stepBack() {
    if (timeIndex.value > 0) timeIndex.value--
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
    /* background: rgba(30, 30, 30, 0.75); */
    border-radius: 14px;
  }

  .time-main {
    font-size: 18px;
    font-weight: 600;
    color: white;
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
