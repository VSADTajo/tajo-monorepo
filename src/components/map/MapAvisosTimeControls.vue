<template>
  <div class="avisos-time-controls" :class="{ 'avisos-time-controls--stacked': stacked }">
    <v-card elevation="8" class="pa-4 bg-primary opacity-90 avisos-time-card">
      <div class="d-flex align-center justify-space-between mb-3 ga-4 flex-wrap">
        <div>
          <div class="avisos-time-title">Avisos AEMET</div>
          <div class="avisos-time-subtitle">
            {{ selectedTipoLabel }}
          </div>
        </div>

        <div class="avisos-time-current">
          Intervalo seleccionado: {{ selectedDayLabel }} {{ selectedIntervalLabel }} hs
        </div>
      </div>

      <div class="days-grid">
        <div v-for="day in days" :key="day.key" class="day-column">
          <div class="day-title">{{ day.title }} {{ day.dateLabel }}</div>

          <div class="intervals-row">
            <button
              v-for="interval in day.intervals"
              :key="interval.key"
              type="button"
              class="interval-pill"
              :class="{
                'interval-pill--active': interval.isSelected,
                'interval-pill--active-neutral': interval.isSelected && !interval.topLevel,
                'interval-pill--current': interval.isCurrent,
                'interval-pill--amarillo': interval.topLevel === 'amarillo',
                'interval-pill--naranja': interval.topLevel === 'naranja',
                'interval-pill--rojo': interval.topLevel === 'rojo',
              }"
              @click="selectInterval(interval.startIso)"
            >
              {{ interval.label }}
            </button>
          </div>
        </div>
      </div>
    </v-card>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useAvisosStore } from '@/stores/avisosStore'

  withDefaults(
    defineProps<{
      stacked?: boolean
    }>(),
    {
      stacked: false,
    }
  )

  const avisosStore = useAvisosStore()

  type IntervalView = {
    key: string
    startIso: string
    label: string
    isSelected: boolean
    isCurrent: boolean
    topLevel: AvisoLevel
  }

  type DayView = {
    key: string
    title: string
    dateLabel: string
    intervals: IntervalView[]
  }

  type AvisoLevel = 'amarillo' | 'naranja' | 'rojo' | null

  const levelPriority: Record<Exclude<AvisoLevel, null>, number> = {
    amarillo: 1,
    naranja: 2,
    rojo: 3,
  }

  function startOfDay(date: Date): Date {
    const next = new Date(date)
    next.setHours(0, 0, 0, 0)
    return next
  }

  function addDays(date: Date, days: number): Date {
    const next = new Date(date)
    next.setDate(next.getDate() + days)
    return next
  }

  function addHours(date: Date, hours: number): Date {
    const next = new Date(date)
    next.setHours(next.getHours() + hours)
    return next
  }

  function formatDayDate(date: Date): string {
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: '2-digit',
    }).format(date)
  }

  function formatHour(date: Date): string {
    return new Intl.DateTimeFormat('es-ES', {
      hour: '2-digit',
      hour12: false,
    }).format(date)
  }

  function formatIntervalLabel(start: Date, end: Date): string {
    return `${formatHour(start)}-${formatHour(end)}`
  }

  function getTopAvisoLevelForInterval(start: Date, end: Date): AvisoLevel {
    const intervalStart = start.getTime()
    const intervalEnd = end.getTime()

    let maxLevel: AvisoLevel = null

    avisosStore.avisos.forEach((feature) => {
      const properties = feature.properties as Record<string, unknown>
      const effective = Date.parse(String(properties.effective ?? ''))
      const expires = Date.parse(String(properties.expires ?? ''))

      if (!Number.isFinite(effective) || !Number.isFinite(expires)) return

      const overlapsInterval = effective < intervalEnd && expires > intervalStart
      if (!overlapsInterval) return

      const level = String(properties.level ?? '').toLowerCase()
      if (level !== 'amarillo' && level !== 'naranja' && level !== 'rojo') return

      if (!maxLevel || levelPriority[level] > levelPriority[maxLevel]) {
        maxLevel = level
      }
    })

    return maxLevel
  }

  function getCurrentSixHourIntervalStart(date = new Date()): Date {
    const next = new Date(date)
    next.setMinutes(0, 0, 0)
    next.setHours(Math.floor(next.getHours() / 6) * 6)
    return next
  }

  const currentIntervalStart = computed(() => getCurrentSixHourIntervalStart())

  const selectedTipoLabel = computed(() => avisosStore.selectedTipo ?? 'Sin tipo seleccionado')

  const selectedIntervalLabel = computed(() => {
    const start = new Date(avisosStore.selectedIntervalStart)
    const end = addHours(start, 6)
    return formatIntervalLabel(start, end)
  })

  const selectedDayLabel = computed(() => {
    const date = new Date(avisosStore.selectedIntervalStart)
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: '2-digit',
    }).format(date)
  })

  const days = computed<DayView[]>(() => {
    const today = startOfDay(new Date())
    const currentStartIso = currentIntervalStart.value.toISOString()

    return [
      { key: 'today', title: 'Hoy', date: today },
      { key: 'tomorrow', title: 'Mañana', date: addDays(today, 1) },
      { key: 'after-tomorrow', title: 'Pasado mañana', date: addDays(today, 2) },
    ].map((day) => ({
      key: day.key,
      title: day.title,
      dateLabel: formatDayDate(day.date),
      intervals: [0, 6, 12, 18].map((hour) => {
        const start = addHours(day.date, hour)
        const end = addHours(start, 6)
        const startIso = start.toISOString()
        const topLevel = getTopAvisoLevelForInterval(start, end)

        return {
          key: `${day.key}-${hour}`,
          startIso,
          label: formatIntervalLabel(start, end),
          isSelected: avisosStore.selectedIntervalStart === startIso,
          isCurrent: currentStartIso === startIso,
          topLevel,
        }
      }),
    }))
  })

  function selectInterval(startIso: string): void {
    avisosStore.setSelectedInterval(startIso)
  }
</script>

<style scoped>
  .avisos-time-controls {
    position: absolute;
    bottom: 25px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1000;
    width: min(760px, calc(100% - 48px));
  }

  .avisos-time-controls--stacked {
    bottom: 165px;
  }

  .avisos-time-card {
    backdrop-filter: blur(10px);
    border-radius: 14px;
  }

  .avisos-time-title {
    font-size: 18px;
    font-weight: 600;
    color: white;
  }

  .avisos-time-subtitle,
  .avisos-time-current,
  .day-date {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.8);
  }

  .days-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
  }

  .day-column {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .day-title {
    font-size: 14px;
    font-weight: 700;
    color: white;
  }

  .intervals-row {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
  }

  .interval-pill {
    border: 1px solid rgba(255, 255, 255, 0.45);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.92);
    font-size: 12px;
    font-weight: 600;
    padding: 8px 6px;
    transition:
      background-color 0.2s ease,
      transform 0.2s ease,
      border-color 0.2s ease;
  }

  .interval-pill:hover {
    background: rgba(255, 255, 255, 0.24);
  }

  .interval-pill--amarillo {
    background: #ffd54f;
    border-color: #ffd54f;
    color: #2f2f2f;
  }

  .interval-pill--naranja {
    background: #fb8c00;
    border-color: #fb8c00;
    color: #ffffff;
  }

  .interval-pill--rojo {
    background: #e53935;
    border-color: #e53935;
    color: #ffffff;
  }

  .interval-pill--current {
    border-color: rgba(255, 255, 255, 0.75);
  }

  .interval-pill--active {
    border-width: 2px;
    border-color: white;
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.08);
    transform: translateY(-1px);
  }

  .interval-pill--active-neutral {
    background: white;
    color: rgb(var(--v-theme-primary));
    border-color: white;
  }

  @media (max-width: 960px) {
    .avisos-time-controls,
    .avisos-time-controls--stacked {
      bottom: 16px;
      width: calc(100% - 24px);
    }

    .days-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
