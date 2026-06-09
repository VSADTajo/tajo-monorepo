<template>
  <v-card class="bg-surface" elevation="2">
    <v-card-title class="text-subtitle-1 font-weight-bold">
      Resguardos y Volúmenes Mínimos
    </v-card-title>
    <v-divider />

    <v-card-text class="pa-2">
      <div class="mb-3">
        <v-btn-toggle
          v-model="selectedKind"
          mandatory
          class="w-100"
          variant="outlined"
          density="compact"
        >
          <v-btn value="resguardo" size="small" class="flex-grow-1">Resguardo</v-btn>
          <v-btn value="minimo" size="small" class="flex-grow-1">Vol minimo</v-btn>
        </v-btn-toggle>
      </div>

      <div class="d-flex align-center justify-space-between mb-1 mt-2">
        <div class="text-caption text-medium-emphasis font-weight-bold">{{ selectedTitle }}</div>
        <div class="d-flex ga-1">
          <v-btn
            icon="mdi-pencil"
            size="x-small"
            variant="text"
            :disabled="!selectedPeriod"
            @click="openEditDialog(selectedKind)"
          />
          <v-btn
            icon="mdi-plus"
            size="x-small"
            variant="text"
            @click="openAddDialog(selectedKind)"
          />
        </div>
      </div>

      <v-row>
        <v-col cols="7" class="text-caption text-medium-emphasis align-center">
          {{ selectedCurrentValueLabel }}
        </v-col>
        <v-col cols="5" class="text-right font-weight-medium pr-2 align-center">
          <v-chip size="small" variant="flat">{{ selectedValueLabel }}</v-chip>
        </v-col>
      </v-row>
      <v-row>
        <v-col cols="5" class="text-caption text-medium-emphasis align-center">
          Inicio vigencia
        </v-col>
        <v-col cols="7" class="text-right font-weight-medium align-center">
          {{ selectedStartLabel }}
        </v-col>
      </v-row>
      <v-row>
        <v-col cols="5" class="text-caption text-medium-emphasis align-center">Fin vigencia</v-col>
        <v-col cols="7" class="text-right font-weight-medium align-center">
          {{ selectedEndLabel }}
        </v-col>
      </v-row>
    </v-card-text>

    <v-dialog v-model="dialogOpen" max-width="460">
      <v-card>
        <v-card-title class="text-subtitle-1 font-weight-bold">{{ dialogTitle }}</v-card-title>
        <v-divider />
        <v-card-text class="pt-4">
          <v-text-field
            v-model.number="dialogValue"
            type="number"
            step="0.1"
            variant="outlined"
            density="compact"
            label="Valor"
            suffix="hm3"
          />
          <v-text-field
            v-model="dialogStartDate"
            class="mt-4"
            type="date"
            variant="outlined"
            density="compact"
            label="Inicio"
          />
          <v-text-field
            v-model="dialogEndDate"
            class="mt-4"
            type="date"
            variant="outlined"
            density="compact"
            label="Fin"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialogOpen = false">Cancelar</v-btn>
          <v-btn color="primary" @click="saveDialog">Guardar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<script lang="ts" setup>
  import { computed, ref, watch } from 'vue'
  import { formatDate } from '@/utils/dates'
  import type { StationPrediction } from '@/types/Predictions'

  type PeriodKind = 'resguardo' | 'minimo'
  type EditMode = 'edit' | 'add'
  type PeriodItem = {
    id: string
    startDate: string
    endDate: string
    value: number
  }

  const props = defineProps<{
    resguardoPrediction?: StationPrediction
    volumenMinimoPrediction?: StationPrediction
  }>()

  const emit = defineEmits<{
    (event: 'update:resguardo-prediction', value: StationPrediction | undefined): void
    (event: 'update:volumen-minimo-prediction', value: StationPrediction | undefined): void
  }>()

  const resguardoPeriods = ref<PeriodItem[]>([])
  const minimoPeriods = ref<PeriodItem[]>([])

  const dialogOpen = ref(false)
  const selectedKind = ref<PeriodKind>('resguardo')
  const dialogKind = ref<PeriodKind>('resguardo')
  const dialogMode = ref<EditMode>('edit')
  const dialogTargetId = ref<string | null>(null)
  const dialogValue = ref<number>(0)
  const dialogStartDate = ref('')
  const dialogEndDate = ref('')

  function toDateInput(value?: string): string {
    if (!value) return ''
    const date = new Date(value)
    if (!Number.isFinite(date.getTime())) return ''
    return date.toISOString().slice(0, 10)
  }

  function toIso(value: string): string {
    return value ? new Date(`${value}T00:00:00`).toISOString() : new Date().toISOString()
  }

  function predictionToPeriods(prediction?: StationPrediction): PeriodItem[] {
    const items = [...(prediction?.results ?? [])].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )

    if (!items.length) return []

    const periods: PeriodItem[] = []
    for (let i = 0; i < items.length; i += 2) {
      const start = items[i]
      const end = items[i + 1] ?? items[i]
      periods.push({
        id: `${start.id}-${end.id}-${i}`,
        startDate: toDateInput(start.date),
        endDate: toDateInput(end.date),
        value: Number.isFinite(Number(end.value)) ? Number(end.value) : 0,
      })
    }

    return periods.sort((a, b) => a.endDate.localeCompare(b.endDate))
  }

  function periodsToPrediction(
    periods: PeriodItem[],
    base: StationPrediction | undefined,
    fallbackType: string,
    fallbackId: string
  ): StationPrediction | undefined {
    if (!periods.length && !base) return undefined

    const sorted = [...periods].sort((a, b) => a.startDate.localeCompare(b.startDate))
    const results = sorted.flatMap((period, index) => [
      {
        id: index * 2 + 1,
        date: toIso(period.startDate),
        value: Number(period.value),
        flag: 0,
      },
      {
        id: index * 2 + 2,
        date: toIso(period.endDate || period.startDate),
        value: Number(period.value),
        flag: 0,
      },
    ])

    return {
      id: base?.id ?? fallbackId,
      stationId: base?.stationId ?? '',
      stationName: base?.stationName ?? '',
      predictionTypeName: base?.predictionTypeName ?? fallbackType,
      simulationDate: base?.simulationDate ?? results[0]?.date ?? new Date().toISOString(),
      predictionDate: new Date().toISOString(),
      predictionProvider: base?.predictionProvider ?? 'mock',
      predictedBy: base?.predictedBy ?? 'ui-edit',
      results,
    }
  }

  function syncFromProps(): void {
    resguardoPeriods.value = predictionToPeriods(props.resguardoPrediction)
    minimoPeriods.value = predictionToPeriods(props.volumenMinimoPrediction)
  }

  watch(
    () => [props.resguardoPrediction, props.volumenMinimoPrediction],
    () => {
      syncFromProps()
    },
    { immediate: true }
  )

  const currentResguardoPeriod = computed(() => {
    const items = resguardoPeriods.value
    return items.length ? items[items.length - 1] : undefined
  })

  const currentMinimoPeriod = computed(() => {
    const items = minimoPeriods.value
    return items.length ? items[items.length - 1] : undefined
  })

  const selectedPeriod = computed(() =>
    selectedKind.value === 'resguardo' ? currentResguardoPeriod.value : currentMinimoPeriod.value
  )

  const selectedTitle = computed(() =>
    selectedKind.value === 'resguardo' ? 'Resguardo' : 'Volumen minimo'
  )

  const selectedCurrentValueLabel = computed(() =>
    selectedKind.value === 'resguardo' ? 'Resguardo actual' : 'Volumen minimo actual'
  )

  const lastResguardoLabel = computed(() => {
    const value = currentResguardoPeriod.value?.value
    if (value == null || !Number.isFinite(value)) return '--'
    return `${value.toFixed(1)} hm3`
  })

  const lastVolumenMinimoLabel = computed(() => {
    const value = currentMinimoPeriod.value?.value
    if (value == null || !Number.isFinite(value)) return '--'
    return `${value.toFixed(1)} hm3`
  })

  const validityStartResguardoLabel = computed(() =>
    currentResguardoPeriod.value?.startDate
      ? formatDate(currentResguardoPeriod.value.startDate)
      : '--'
  )

  const validityEndResguardoLabel = computed(() =>
    currentResguardoPeriod.value?.endDate ? formatDate(currentResguardoPeriod.value.endDate) : '--'
  )

  const validityStartMinimoLabel = computed(() =>
    currentMinimoPeriod.value?.startDate ? formatDate(currentMinimoPeriod.value.startDate) : '--'
  )

  const validityEndMinimoLabel = computed(() =>
    currentMinimoPeriod.value?.endDate ? formatDate(currentMinimoPeriod.value.endDate) : '--'
  )

  const selectedValueLabel = computed(() =>
    selectedKind.value === 'resguardo' ? lastResguardoLabel.value : lastVolumenMinimoLabel.value
  )

  const selectedStartLabel = computed(() =>
    selectedKind.value === 'resguardo'
      ? validityStartResguardoLabel.value
      : validityStartMinimoLabel.value
  )

  const selectedEndLabel = computed(() =>
    selectedKind.value === 'resguardo'
      ? validityEndResguardoLabel.value
      : validityEndMinimoLabel.value
  )

  const dialogTitle = computed(() => {
    const base = dialogKind.value === 'resguardo' ? 'Resguardo' : 'Volumen minimo'
    return dialogMode.value === 'edit' ? `Editar ${base}` : `Anadir ${base}`
  })

  function openEditDialog(kind: PeriodKind): void {
    const target = kind === 'resguardo' ? currentResguardoPeriod.value : currentMinimoPeriod.value
    if (!target) return

    dialogKind.value = kind
    dialogMode.value = 'edit'
    dialogTargetId.value = target.id
    dialogValue.value = target.value
    dialogStartDate.value = target.startDate
    dialogEndDate.value = target.endDate
    dialogOpen.value = true
  }

  function openAddDialog(kind: PeriodKind): void {
    const target = kind === 'resguardo' ? currentResguardoPeriod.value : currentMinimoPeriod.value
    const today = new Date().toISOString().slice(0, 10)

    dialogKind.value = kind
    dialogMode.value = 'add'
    dialogTargetId.value = null
    dialogValue.value = target?.value ?? 0
    dialogStartDate.value = target?.startDate ?? today
    dialogEndDate.value = target?.endDate ?? today
    dialogOpen.value = true
  }

  function emitKind(kind: PeriodKind): void {
    if (kind === 'resguardo') {
      emit(
        'update:resguardo-prediction',
        periodsToPrediction(
          resguardoPeriods.value,
          props.resguardoPrediction,
          'resguardo.hydrologicalYear.mock',
          'resguardo-edit'
        )
      )
      return
    }

    emit(
      'update:volumen-minimo-prediction',
      periodsToPrediction(
        minimoPeriods.value,
        props.volumenMinimoPrediction,
        'volumen.minimo.hydrologicalYear.mock',
        'minimo-edit'
      )
    )
  }

  function saveDialog(): void {
    const startDate = dialogStartDate.value
    const endDate = dialogEndDate.value || dialogStartDate.value
    const safeValue = Number.isFinite(dialogValue.value) ? Number(dialogValue.value) : 0

    const item: PeriodItem = {
      id: dialogTargetId.value ?? `${dialogKind.value}-${Date.now()}`,
      startDate,
      endDate,
      value: safeValue,
    }

    const targetRef = dialogKind.value === 'resguardo' ? resguardoPeriods : minimoPeriods

    if (dialogMode.value === 'edit' && dialogTargetId.value) {
      targetRef.value = targetRef.value.map((period) =>
        period.id === dialogTargetId.value ? item : period
      )
    } else {
      targetRef.value = [...targetRef.value, item]
    }

    targetRef.value.sort((a, b) => a.startDate.localeCompare(b.startDate))

    emitKind(dialogKind.value)
    dialogOpen.value = false
  }
</script>
