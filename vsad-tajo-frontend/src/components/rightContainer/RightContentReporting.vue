<template>
  <v-card class="pa-4 bg-background" elevation="2">
    <v-progress-linear v-if="loading" indeterminate />

    <template v-if="route.query.reportingPoint">
      <v-card-title class="d-flex justify-space-between align-start">
        <div>
          <div class="text-h6 font-weight-bold">
            {{ route.query.reportingPoint }}
          </div>
        </div>

        <v-btn icon="mdi-close" variant="text" size="small" @click="closeDrawer" />
      </v-card-title>

      <v-divider class="my-3" />

      <v-card-text>
        <v-sheet elevation="2">
          <v-tabs v-model="tab" color="primary">
            <v-tab value="basica">Informacion Básica</v-tab>
            <v-tab value="graficas">Gráficas</v-tab>
            <v-tab value="tablas">Tablas</v-tab>
          </v-tabs>

          <v-divider></v-divider>

          <v-tabs-window v-model="tab">
            <v-tabs-window-item value="basica" class="overflow-y-auto" style="height: 73vh">
              <div class="pa-4" v-html="basicInfoHtml" />
            </v-tabs-window-item>
            <v-tabs-window-item value="graficas" class="overflow-y-auto" style="height: 73vh">
              <v-progress-linear v-if="chartsLoading" indeterminate color="primary" class="mt-2" />
              <div ref="chartsContainerRef" class="pa-4" v-html="chartsHtml" />
            </v-tabs-window-item>
            <v-tabs-window-item value="tablas" class="overflow-y-auto" style="height: 73vh">
              <div class="pa-4" v-html="tablesHtml" />
            </v-tabs-window-item>
          </v-tabs-window>
        </v-sheet>
      </v-card-text>
    </template>
  </v-card>
</template>

<script lang="ts" setup>
  import { useReportingPointStore } from '@/stores/reportingPointsStore'
  import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'

  const tab = ref('basica')

  const route = useRoute()
  const router = useRouter()

  const reportingPointStore = useReportingPointStore()

  const loading = ref(false)
  const chartsLoading = ref(false)
  const chartsContainerRef = ref<HTMLElement | null>(null)

  let clearImageListeners: (() => void) | null = null

  const parsedDoc = computed(() => {
    const html = reportingPointStore.html
    if (!html) return null

    return new DOMParser().parseFromString(html, 'text/html')
  })

  function getSectionHtml(selector: string) {
    const el = parsedDoc.value?.querySelector(selector)
    return el?.outerHTML ?? ''
  }

  const basicInfoHtml = computed(() => {
    return [
      getSectionHtml('#reportingpoints-point-information'),
      getSectionHtml('#reportingpoints-station-information'),
      getSectionHtml('#reportingpoints-point-forecast'),
    ]
      .filter(Boolean)
      .join('')
  })

  const chartsHtml = computed(() => {
    const doc = parsedDoc.value
    if (!doc) return ''

    const section = doc.querySelector('#plots-and-tables')
    if (!section) return ''

    section.querySelectorAll('hr').forEach((el) => el.remove())

    const helpLink = section.querySelector('a.btn')
    helpLink?.parentElement?.remove()

    return section.outerHTML
  })

  const tablesHtml = computed(() => {
    const doc = parsedDoc.value
    if (!doc) return ''

    const section = doc.querySelector('.efas-tables-html')
    if (!section) return ''

    section.querySelectorAll('td, th').forEach((cell) => {
      const style = cell.getAttribute('style') || ''

      if (style.includes('#None')) {
        cell.removeAttribute('style')
        cell.classList.add('cell-label')
      } else if (style.includes('#FFFFFF') || style.includes('#ffffff')) {
        cell.classList.add('cell-clear')
      } else if (style.includes('#666666')) {
        cell.classList.add('cell-disabled')
      }
    })

    return section.outerHTML
  })

  async function trackChartsImagesLoading() {
    clearImageListeners?.()
    clearImageListeners = null

    await nextTick()

    const container = chartsContainerRef.value
    if (!container) {
      chartsLoading.value = false
      return
    }

    const images = Array.from(container.querySelectorAll('img'))
    const pendingImages = images.filter((img) => !img.complete)

    if (!pendingImages.length) {
      chartsLoading.value = false
      return
    }

    chartsLoading.value = true

    let remaining = pendingImages.length

    const listeners = pendingImages.map((img) => {
      const done = () => {
        remaining -= 1
        if (remaining <= 0) {
          chartsLoading.value = false
          clearImageListeners?.()
          clearImageListeners = null
        }
      }

      img.addEventListener('load', done)
      img.addEventListener('error', done)

      return { img, done }
    })

    clearImageListeners = () => {
      listeners.forEach(({ img, done }) => {
        img.removeEventListener('load', done)
        img.removeEventListener('error', done)
      })
    }
  }

  watch([chartsHtml, tab], async ([_, activeTab]) => {
    if (activeTab !== 'graficas') {
      chartsLoading.value = false
      clearImageListeners?.()
      clearImageListeners = null
      return
    }

    await trackChartsImagesLoading()
  })

  onBeforeUnmount(() => {
    clearImageListeners?.()
    clearImageListeners = null
  })

  function closeDrawer() {
    if (!route.query.reportingPoint) return

    reportingPointStore.clearReportingPoint()

    const query = { ...route.query }
    delete query.reportingPoint

    router.replace({ query })
  }
</script>

<style lang="scss" scoped>
  :deep(#reportingpoints-point-information),
  :deep(#reportingpoints-station-information),
  :deep(#reportingpoints-point-forecast) {
    margin-bottom: 24px;
    padding: 16px;
    border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    text-align: center;
    border-radius: 16px;
    background: rgb(var(--v-theme-surface));
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
    overflow-x: auto;
  }

  :deep(#reportingpoints-point-information h5),
  :deep(#reportingpoints-station-information h5),
  :deep(#reportingpoints-point-forecast h5) {
    margin-bottom: 12px;
    font-size: 1rem;
    text-align: center;
    font-weight: 700;
    color: rgb(var(--v-theme-on-surface));
  }

  :deep(#reportingpoints-point-information .table),
  :deep(#reportingpoints-station-information .table),
  :deep(#reportingpoints-point-forecast .table) {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    text-align: center;
    background: rgb(var(--v-theme-surface));
    border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    border-radius: 12px;
    overflow: hidden;
  }

  :deep(#reportingpoints-point-information thead th),
  :deep(#reportingpoints-station-information thead th),
  :deep(#reportingpoints-point-forecast thead th) {
    background: rgb(var(--v-theme-primary)) !important;
    color: rgb(var(--v-theme-on-primary)) !important;
    font-size: 0.8rem;
    font-weight: 700;
    text-align: center;
    padding: 12px 14px;
    white-space: nowrap;
  }

  :deep(#reportingpoints-point-information tbody td),
  :deep(#reportingpoints-station-information tbody td),
  :deep(#reportingpoints-point-forecast tbody td) {
    padding: 12px 14px;
    font-size: 0.92rem;
    text-align: center;
    color: rgb(var(--v-theme-on-surface));
    border-bottom: 1px solid rgba(var(--v-border-color), 0.08);
    white-space: nowrap;
    vertical-align: middle;
  }

  :deep(#reportingpoints-point-information tbody tr:hover),
  :deep(#reportingpoints-station-information tbody tr:hover),
  :deep(#reportingpoints-point-forecast tbody tr:hover) {
    background: rgba(var(--v-theme-primary), 0.04);
  }

  :deep(#reportingpoints-point-forecast img) {
    display: block;
    width: 22px;
    height: 22px;
    object-fit: contain;
    margin: 0 auto;
  }

  //   CHART
  :deep(#reportingpoints-point-information h5),
  :deep(#reportingpoints-station-information h5),
  :deep(#reportingpoints-point-forecast h5),
  :deep(#plots-and-tables h5) {
    margin-bottom: 12px;
    font-size: 1rem;
    text-align: center;
    font-weight: 700;
    color: rgb(var(--v-theme-on-surface));
  }

  //////////////TABLAS////////////////////////////
  ///
  ///
  :deep(.efas-tables-html) {
    display: flex;
    flex-direction: column;
    gap: 20px;
    color: rgb(var(--v-theme-on-surface));
  }

  :deep(.efas-tables-html .overflow-x-auto) {
    overflow-x: auto;
    overflow-y: hidden;
    margin-top: 0.5rem;
    padding: 14px;
    border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
    border-radius: 16px;
    background: rgb(var(--v-theme-surface));
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06);
  }

  :deep(.efas-tables-html h5) {
    margin: 0 0 12px 0;
    font-size: 1rem;
    text-align: center;
    font-weight: 700;
    color: rgb(var(--v-theme-on-surface));
  }

  :deep(.efas-tables-html table) {
    width: max-content;
    min-width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    background: transparent;
  }

  :deep(.efas-tables-html thead tr:first-child td),
  :deep(.efas-tables-html thead tr:first-child th) {
    position: sticky;
    top: 0;
    z-index: 2;
    background: rgb(var(--v-theme-surface-variant));
    color: rgb(var(--v-theme-on-surface));
    font-weight: 700;
  }

  :deep(.efas-tables-html th),
  :deep(.efas-tables-html td) {
    border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
    padding: 8px 10px;
    text-align: center;
    vertical-align: middle;
    font-size: 0.85rem;
    line-height: 1.2;
    white-space: nowrap;
    min-width: 42px;
  }

  :deep(.efas-tables-html thead td:first-child),
  :deep(.efas-tables-html thead th:first-child),
  :deep(.efas-tables-html tbody td:first-child) {
    position: sticky;
    left: 0;
    z-index: 1;
    min-width: 180px;
    text-align: left;
    font-weight: 600;
    background: rgb(var(--v-theme-surface));
  }

  :deep(.efas-tables-html thead tr:first-child td:first-child),
  :deep(.efas-tables-html thead tr:first-child th:first-child) {
    z-index: 3;
    background: rgb(var(--v-theme-surface-variant));
  }

  :deep(.efas-tables-html tbody tr:nth-child(even) td:not(:first-child)) {
    filter: brightness(0.99);
  }

  :deep(.efas-tables-html tbody tr:hover td) {
    box-shadow: inset 0 0 0 9999px rgba(var(--v-theme-primary), 0.05);
  }

  :deep(.efas-tables-html td[style*='#None']) {
    background-color: rgb(var(--v-theme-surface)) !important;
  }

  :deep(.efas-tables-html td[style*='#FFFFFF']),
  :deep(.efas-tables-html td[style*='#ffffff']) {
    color: rgb(var(--v-theme-on-surface));
  }

  :deep(.efas-tables-html td[style*='#666666']) {
    color: transparent;
  }

  :deep(.efas-tables-html::-webkit-scrollbar),
  :deep(.efas-tables-html .overflow-x-auto::-webkit-scrollbar) {
    height: 10px;
  }

  :deep(.efas-tables-html::-webkit-scrollbar-thumb),
  :deep(.efas-tables-html .overflow-x-auto::-webkit-scrollbar-thumb) {
    background: rgba(var(--v-theme-on-surface), 0.22);
    border-radius: 999px;
  }

  :deep(.efas-tables-html::-webkit-scrollbar-track),
  :deep(.efas-tables-html .overflow-x-auto::-webkit-scrollbar-track) {
    background: transparent;
  }

  :deep(.efas-tables-html thead td:first-child),
  :deep(.efas-tables-html thead th:first-child),
  :deep(.efas-tables-html tbody td:first-child) {
    position: sticky;
    left: 0;
    z-index: 1;
    min-width: 180px;
    text-align: left;
    font-weight: 600;
    background: rgb(var(--v-theme-surface));
  }
</style>
