<template>
  <v-card class="pa-2 bg-background" elevation="2">
    <template v-if="selectedAviso">
      <v-card-title class="d-flex justify-space-between align-start pa-6" :style="headerStyle">
        <div>
          <div class="text-h6 font-weight-bold" style="color: white">
            {{ displayArea }}
          </div>
          <div class="text-caption" style="color: rgba(255, 255, 255, 0.9)">Aviso AEMET</div>
        </div>

        <v-btn
          icon="mdi-close"
          variant="text"
          size="small"
          style="color: white"
          @click="closeDrawer"
        />
      </v-card-title>

      <v-card-text>
        <!-- Chip severidad -->
        <div class="d-flex align-center ga-2 mb-4">
          <span class="text-body-2 font-weight-medium">Severidad:</span>
          <v-chip :color="severityChipColor" variant="tonal" size="small" class="font-weight-bold">
            {{ severityLabel }}
          </v-chip>
        </div>

        <!-- Gráfica de barras -->
        <v-card variant="outlined" class="pa-2">
          <div class="text-subtitle-2 font-weight-bold px-2 pb-1">Nivel por intervalo (72h)</div>
          <apexchart type="bar" height="260" :options="chartOptions" :series="chartSeries" />
        </v-card>
      </v-card-text>
    </template>

    <v-card-text v-else class="d-flex align-center justify-center" style="height: 240px">
      <div class="text-medium-emphasis">No se encontró información del aviso seleccionado.</div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useAvisosStore } from '@/stores/avisosStore'
  import type { ApexOptions } from 'apexcharts'

  const route = useRoute()
  const router = useRouter()
  const avisosStore = useAvisosStore()

  // ── helpers de tiempo (mismo patrón que MapAvisosTimeControls) ────────────

  function startOfDay(date: Date): Date {
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    return d
  }

  function addHours(date: Date, hours: number): Date {
    const d = new Date(date)
    d.setHours(d.getHours() + hours)
    return d
  }

  function addDays(date: Date, days: number): Date {
    const d = new Date(date)
    d.setDate(d.getDate() + days)
    return d
  }

  function formatSlotLabel(start: Date): string {
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      hour12: false,
    }).format(start)
  }

  /** Genera los 12 slots de 6h: hoy, mañana, pasado mañana (4 slots × 3 días) */
  const slots = computed(() => {
    const today = startOfDay(new Date())
    const result: { start: Date; end: Date; label: string }[] = []

    for (let day = 0; day < 3; day++) {
      const dayStart = addDays(today, day)
      for (const hour of [0, 6, 12, 18]) {
        const start = addHours(dayStart, hour)
        const end = addHours(start, 6)
        result.push({ start, end, label: formatSlotLabel(start) })
      }
    }

    return result
  })

  // ── nivel → valor numérico para el eje Y ─────────────────────────────────

  const levelToValue: Record<string, number> = {
    verde: 1,
    amarillo: 2,
    naranja: 3,
    rojo: 4,
  }

  const levelToColor: Record<string, string> = {
    verde: '#22c55e',
    amarillo: '#facc15',
    naranja: '#f97316',
    rojo: '#ef4444',
  }

  const levelLabels: Record<number, string> = {
    0: 'Sin aviso',
    1: 'Verde',
    2: 'Amarillo',
    3: 'Naranja',
    4: 'Rojo',
  }

  // ── aviso seleccionado ────────────────────────────────────────────────────

  const avisoQuery = computed(() => {
    const value = route.query.aviso
    return typeof value === 'string' ? value : undefined
  })

  const selectedAviso = computed(() => {
    if (!avisoQuery.value) return null
    return (
      avisosStore.avisos.find((feature) => {
        const areaDesc = String(feature.properties?.areaDesc ?? '').trim()
        return areaDesc === avisoQuery.value
      }) ?? null
    )
  })

  const displayArea = computed(() => String(selectedAviso.value?.properties?.areaDesc ?? 'Aviso'))

  // ── severity chip ─────────────────────────────────────────────────────────

  const severityLabel = computed(() => {
    const s = selectedAviso.value?.properties?.severity
    return s ? String(s) : 'N/A'
  })

  const severityChipColor = computed(() => {
    switch (severityLabel.value.toLowerCase()) {
      case 'extreme':
        return 'error'
      case 'severe':
        return 'deep-orange'
      case 'moderate':
        return 'warning'
      case 'minor':
        return 'success'
      default:
        return 'default'
    }
  })

  // ── datos de gráfica ──────────────────────────────────────────────────────

  /** Para cada slot devuelve el nivel máximo del aviso actual que solape */
  const slotValues = computed(() => {
    const aviso = selectedAviso.value
    if (!aviso) return slots.value.map(() => 0)

    const props = aviso.properties as Record<string, unknown>
    const avisoEffective = Date.parse(String(props.effective ?? ''))
    const avisoExpires = Date.parse(String(props.expires ?? ''))
    const avisoLevel = String(props.level ?? '').toLowerCase()
    const numericLevel = levelToValue[avisoLevel] ?? 0

    return slots.value.map(({ start, end }) => {
      const slotStart = start.getTime()
      const slotEnd = end.getTime()
      const overlaps =
        Number.isFinite(avisoEffective) &&
        Number.isFinite(avisoExpires) &&
        avisoEffective < slotEnd &&
        avisoExpires > slotStart
      return overlaps ? numericLevel : 0
    })
  })

  /** Color de cada barra según el valor */
  const barColors = computed(() =>
    slotValues.value.map((v) => {
      const level = Object.entries(levelToValue).find(([, val]) => val === v)?.[0] ?? ''
      return levelToColor[level] ?? '#e5e7eb'
    })
  )

  const chartSeries = computed(() => [
    {
      name: 'Nivel',
      data: slotValues.value,
    },
  ])

  const chartOptions = computed<ApexOptions>(() => ({
    chart: {
      type: 'bar',
      toolbar: { show: false },
      animations: { enabled: false },
    },
    plotOptions: {
      bar: {
        distributed: true,
        borderRadius: 4,
        columnWidth: '70%',
      },
    },
    colors: barColors.value,
    dataLabels: { enabled: false },
    legend: { show: false },
    xaxis: {
      categories: slots.value.map((s) => s.label),
      labels: {
        rotate: -45,
        style: { fontSize: '10px' },
      },
    },
    yaxis: {
      min: 0,
      max: 4,
      tickAmount: 4,
      labels: {
        formatter: (val: number) => levelLabels[Math.round(val)] ?? '',
        style: { fontSize: '11px' },
      },
    },
    tooltip: {
      y: {
        formatter: (val: number) => levelLabels[Math.round(val)] ?? 'Sin aviso',
      },
    },
    grid: {
      borderColor: '#e0e0e0',
    },
  }))

  // ── estilo encabezado ─────────────────────────────────────────────────────

  const headerStyle = computed(() => ({
    background: 'linear-gradient(135deg, #0f4c81 0%, #0b365c 100%)',
    margin: '-8px -8px 0 -8px',
  }))

  function closeDrawer() {
    const queryObj = { ...route.query }
    delete queryObj.aviso
    router.replace({ query: queryObj })
  }
</script>
